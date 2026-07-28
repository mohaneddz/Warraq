-- Warraq Supabase schema — part 3: shared library settings + business-rule functions/triggers.
-- Circulation rules and library profile are now shared across every device (desktop app +
-- future website), so they live here instead of per-device Tauri Store preferences.
create table library_settings (
  id smallint primary key default 1 check (id = 1),
  library_name text not null default 'Mustapha Bacha Hospital Library',
  library_short_name text not null default 'Warraq',
  library_address text not null default '',
  library_city text not null default '',
  library_phone text not null default '',
  library_email text not null default '',
  library_website text not null default '',
  library_hours text not null default '',
  library_description text not null default '',
  timezone text not null default 'Africa/Algiers',
  date_format text not null default 'dd/MM/yyyy',
  currency text not null default 'DZD',
  loan_days integer not null default 14,
  loan_limit integer not null default 3,
  renew_limit integer not null default 2,
  reservation_hold_days integer not null default 3,
  reservation_external_days integer not null default 7,
  reservation_internal_days integer not null default 1,
  self_renewal_allowed boolean not null default false,
  grace_period_enabled boolean not null default false,
  grace_period_days integer not null default 0,
  fines_enabled boolean not null default false,
  fine_per_day numeric not null default 0,
  max_fine_amount numeric not null default 0,
  fine_currency text not null default 'DZD',
  fines_payment_method text not null default 'cash',
  notify_overdue boolean not null default true,
  notify_due_soon boolean not null default true,
  notify_due_soon_days integer not null default 2,
  notify_ready boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into library_settings (id) values (1);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_books_updated_at before update on books for each row execute function set_updated_at();
create trigger trg_copies_updated_at before update on copies for each row execute function set_updated_at();
create trigger trg_members_updated_at before update on members for each row execute function set_updated_at();
create trigger trg_shelves_updated_at before update on shelves for each row execute function set_updated_at();
create trigger trg_rooms_updated_at before update on rooms for each row execute function set_updated_at();
create trigger trg_publishers_updated_at before update on publishers for each row execute function set_updated_at();
create trigger trg_authors_updated_at before update on authors for each row execute function set_updated_at();
create trigger trg_fines_updated_at before update on fines for each row execute function set_updated_at();
create trigger trg_library_settings_updated_at before update on library_settings for each row execute function set_updated_at();

create or replace function is_staff(uid uuid default auth.uid()) returns boolean as $$
  select exists(select 1 from profiles where id = uid and status = 'active');
$$ language sql stable security definer set search_path = public;

create or replace function is_admin(uid uuid default auth.uid()) returns boolean as $$
  select exists(select 1 from profiles where id = uid and status = 'active' and role = 'admin');
$$ language sql stable security definer set search_path = public;

create or replace function current_actor() returns text as $$
  select coalesce((select username from profiles where id = auth.uid()), 'system');
$$ language sql stable security definer set search_path = public;

-- Structural eligibility rules enforced server-side (backstop for every future client,
-- not just this desktop app): visitors/banned members can't create external reservations,
-- and single-copy items can't be reserved externally.
create or replace function enforce_reservation_rules() returns trigger as $$
declare
  v_role member_role;
  v_banned boolean;
  v_copy_count integer;
begin
  select role, reservation_banned into v_role, v_banned from members where id = new.member_id;
  if v_banned then
    raise exception 'this member is banned from making reservations';
  end if;
  if new.scope = 'external' and v_role = 'visitor' then
    raise exception 'visitors cannot make external reservations';
  end if;
  if new.scope = 'external' then
    select count(*) into v_copy_count from copies where book_id = new.book_id;
    if v_copy_count <= 1 then
      raise exception 'single-copy items cannot be reserved externally';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_enforce_reservation_rules before insert on reservations
for each row execute function enforce_reservation_rules();

-- Promotes the oldest queued reservation(s) to "ready" for every available copy of a book
-- (or every book with available copies, when p_book_id is null). Mirrors what the old
-- client-side syncReservationQueue() did at app boot, now done atomically in Postgres.
create or replace function advance_reservation_queue(p_book_id uuid default null) returns void as $$
declare
  v_hold_days integer;
  v_copy record;
  v_res_id uuid;
begin
  select reservation_hold_days into v_hold_days from library_settings where id = 1;

  for v_copy in
    select c.id as copy_id, c.book_id
    from copies c
    where c.status = 'available' and (p_book_id is null or c.book_id = p_book_id)
  loop
    select id into v_res_id from reservations
    where book_id = v_copy.book_id and status = 'queued'
    order by position asc, requested_at asc
    limit 1;

    continue when v_res_id is null;

    update reservations
    set status = 'ready', copy_id = v_copy.copy_id, expires_at = now() + (v_hold_days || ' days')::interval
    where id = v_res_id;

    update copies set status = 'reserved', updated_at = now() where id = v_copy.copy_id;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function checkout(p_copy_id uuid, p_member_id uuid, p_scope reservation_scope default 'external')
returns loans as $$
declare
  v_member members;
  v_copy copies;
  v_days integer;
  v_settings library_settings;
  v_loan loans;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  select * into v_member from members where id = p_member_id for update;
  if v_member is null then raise exception 'member not found'; end if;
  if v_member.status <> 'active' then raise exception 'member is not active'; end if;
  if v_member.reservation_banned and p_scope = 'external' then
    raise exception 'this member is banned from external loans';
  end if;

  select * into v_copy from copies where id = p_copy_id for update;
  if v_copy is null then raise exception 'copy not found'; end if;
  if v_copy.status <> 'available' then raise exception 'copy is not available'; end if;

  if p_scope = 'external' and v_member.role = 'visitor' then
    raise exception 'visitors cannot take items externally';
  end if;
  if p_scope = 'external' and (select count(*) from copies where book_id = v_copy.book_id) <= 1 then
    raise exception 'single-copy items cannot be borrowed externally';
  end if;

  select * into v_settings from library_settings where id = 1;
  v_days := case when p_scope = 'internal' then coalesce(v_settings.reservation_internal_days, 1)
                 else coalesce(v_settings.reservation_external_days, 7) end;

  insert into loans (copy_id, member_id, scope, due_at, issued_by, condition_out)
  values (p_copy_id, p_member_id, p_scope, now() + (v_days || ' days')::interval, auth.uid(), v_copy.condition)
  returning * into v_loan;

  update copies set status = 'on-loan', updated_at = now() where id = p_copy_id;

  insert into audit_logs(actor, action, entity_type, entity_id, after_json)
  values (current_actor(), 'checkout', 'loan', v_loan.id::text, to_jsonb(v_loan));

  return v_loan;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function return_copies(p_copy_ids uuid[], p_condition_in text default null)
returns void as $$
declare
  v_copy_id uuid;
  v_book_id uuid;
  v_loan loans;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  foreach v_copy_id in array p_copy_ids loop
    select * into v_loan from loans where copy_id = v_copy_id and returned_at is null for update;
    if v_loan is null then continue; end if;

    update loans set returned_at = now(), received_by = auth.uid(), condition_in = p_condition_in
    where id = v_loan.id;

    select book_id into v_book_id from copies where id = v_copy_id;

    update copies set status = 'available', updated_at = now() where id = v_copy_id;

    insert into audit_logs(actor, action, entity_type, entity_id, after_json)
    values (current_actor(), 'return', 'loan', v_loan.id::text, jsonb_build_object('copy_id', v_copy_id));

    perform advance_reservation_queue(v_book_id);
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function accept_reservation(p_reservation_id uuid, p_reason text default null)
returns reservations as $$
declare
  v_res reservations;
  v_available_copy uuid;
  v_hold_days integer;
  v_next_position integer;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  select * into v_res from reservations where id = p_reservation_id for update;
  if v_res is null then raise exception 'reservation not found'; end if;
  if v_res.status <> 'pending' then raise exception 'reservation is not pending'; end if;

  select id into v_available_copy from copies
  where book_id = v_res.book_id and status = 'available' limit 1;

  select reservation_hold_days into v_hold_days from library_settings where id = 1;

  if v_available_copy is not null then
    update copies set status = 'reserved', updated_at = now() where id = v_available_copy;
    update reservations
    set status = 'ready', copy_id = v_available_copy, reserved_at = now(),
        expires_at = now() + (v_hold_days || ' days')::interval,
        decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason
    where id = p_reservation_id
    returning * into v_res;
  else
    select coalesce(max(position), 0) + 1 into v_next_position
    from reservations where book_id = v_res.book_id and status = 'queued';

    update reservations
    set status = 'queued', position = v_next_position, reserved_at = now(),
        decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason
    where id = p_reservation_id
    returning * into v_res;
  end if;

  insert into audit_logs(actor, action, entity_type, entity_id, after_json)
  values (current_actor(), 'accept_reservation', 'reservation', v_res.id::text, to_jsonb(v_res));

  return v_res;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function decline_reservation(p_reservation_id uuid, p_reason text default null)
returns reservations as $$
declare
  v_res reservations;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  update reservations
  set status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason
  where id = p_reservation_id and status in ('pending','queued','ready')
  returning * into v_res;

  if v_res is null then raise exception 'reservation not found or already decided'; end if;

  if v_res.copy_id is not null then
    update copies set status = 'available', updated_at = now() where id = v_res.copy_id;
    perform advance_reservation_queue(v_res.book_id);
  end if;

  insert into audit_logs(actor, action, entity_type, entity_id, after_json)
  values (current_actor(), 'decline_reservation', 'reservation', v_res.id::text, to_jsonb(v_res));

  return v_res;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function fulfil_reservation(p_reservation_id uuid)
returns loans as $$
declare
  v_res reservations;
  v_loan loans;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  select * into v_res from reservations where id = p_reservation_id for update;
  if v_res is null or v_res.status <> 'ready' or v_res.copy_id is null then
    raise exception 'reservation is not ready for pickup';
  end if;

  v_loan := checkout(v_res.copy_id, v_res.member_id, v_res.scope);

  update reservations set status = 'fulfilled', fulfilled_at = now() where id = p_reservation_id;

  return v_loan;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function ban_member(p_member_id uuid, p_reason text)
returns members as $$
declare
  v_member members;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  update members
  set reservation_banned = true, ban_reason = p_reason, banned_at = now(), banned_by = auth.uid()
  where id = p_member_id
  returning * into v_member;

  insert into audit_logs(actor, action, entity_type, entity_id, after_json)
  values (current_actor(), 'ban_member', 'member', v_member.id::text, to_jsonb(v_member));

  return v_member;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function unban_member(p_member_id uuid)
returns members as $$
declare
  v_member members;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  update members
  set reservation_banned = false, ban_reason = null, banned_at = null, banned_by = null
  where id = p_member_id
  returning * into v_member;

  insert into audit_logs(actor, action, entity_type, entity_id, after_json)
  values (current_actor(), 'unban_member', 'member', v_member.id::text, to_jsonb(v_member));

  return v_member;
end;
$$ language plpgsql security definer set search_path = public;
