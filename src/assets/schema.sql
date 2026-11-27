-- Warraq database schema
-- Run this ONCE in a brand new, empty Supabase project: Dashboard > SQL Editor > New query,
-- paste the whole script, press Run. It is the migrations in supabase/migrations joined in order.

-- ============================================================
-- 0001_extensions_enums_core.sql
-- ============================================================
-- Warraq Supabase schema — part 1: extensions, enums, and reference/core tables.
create extension if not exists pgcrypto;

create type item_type as enum ('book','fyp','journal','other');
create type member_role as enum ('visitor','student','staff','medic','other');
create type member_status as enum ('active','suspended','expired','archived');
create type copy_status as enum ('available','on-loan','reserved','repair','lost','archived');
create type shelf_type as enum ('floor','top');
create type staff_role as enum ('admin','staff');
create type staff_status as enum ('active','disabled');

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shelves (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  shelf_type shelf_type not null default 'top',
  code text not null,
  capacity integer not null default 40,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shelves_code_valid check (
    (shelf_type = 'top' and code in ('A','B','C','D','E','F'))
    or (shelf_type = 'floor' and code = '⬤')
  ),
  constraint shelves_room_code_unique unique (room_id, code)
);

create table publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  parent_id uuid references categories(id),
  color text,
  description text
);

create table authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  biography text,
  external_ids text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table books (
  id uuid primary key default gen_random_uuid(),
  item_type item_type not null default 'book',
  isbn10 text,
  isbn13 text,
  title text not null,
  arabic_title text,
  subtitle text,
  description text,
  language text not null default 'French',
  publication_year integer,
  publication_date date,
  edition text,
  page_count integer,
  cover_path text,
  cover_url text,
  publisher_id uuid references publishers(id),
  category_id uuid references categories(id),
  call_number text,
  dewey_code text,
  notes text,
  tags text,
  source text not null default 'manual',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table book_authors (
  book_id uuid not null references books(id) on delete cascade,
  author_id uuid not null references authors(id),
  author_order integer not null default 0,
  primary key (book_id, author_id)
);

create table copies (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  accession_number text not null unique,
  barcode text not null unique,
  shelf_id uuid references shelves(id),
  acquisition_date date,
  acquisition_source text,
  price numeric,
  condition text not null default 'good',
  status copy_status not null default 'available',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  email text,
  role staff_role not null default 'staff',
  status staff_status not null default 'active',
  avatar_path text,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index idx_shelves_room_id on shelves(room_id);
create index idx_books_publisher_id on books(publisher_id);
create index idx_books_category_id on books(category_id);
create index idx_books_archived_at on books(archived_at);
create index idx_books_item_type on books(item_type);
create index idx_books_isbn13 on books(isbn13);
create index idx_copies_book_status on copies(book_id, status);
create index idx_copies_shelf_id on copies(shelf_id);
create index idx_book_authors_author_id on book_authors(author_id);

-- ============================================================
-- 0002_people_circulation.sql
-- ============================================================
-- Warraq Supabase schema — part 2: members, circulation, reservations, and supporting tables.
create type reservation_scope as enum ('internal','external');
create type reservation_status as enum ('pending','queued','ready','fulfilled','cancelled','declined','expired');
create type fine_status as enum ('open','paid','waived');
create type inventory_session_status as enum ('active','paused','completed','cancelled');
create type inventory_scan_result as enum ('found','misplaced','unknown');

create table members (
  id uuid primary key default gen_random_uuid(),
  member_number text not null unique,
  full_name text not null,
  email text,
  phone text,
  department text,
  role member_role not null default 'visitor',
  address text,
  joined_at timestamptz not null default now(),
  expiry_date date,
  status member_status not null default 'active',
  reservation_banned boolean not null default false,
  ban_reason text,
  banned_at timestamptz,
  banned_by uuid references profiles(id),
  notes text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table loans (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references copies(id),
  member_id uuid not null references members(id),
  scope reservation_scope not null default 'external',
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  renewed_count integer not null default 0,
  issued_by uuid references profiles(id),
  received_by uuid references profiles(id),
  condition_out text,
  condition_in text,
  notes text
);
create unique index one_open_loan_per_copy on loans(copy_id) where returned_at is null;
create index idx_loans_member_open on loans(member_id) where returned_at is null;
create index idx_loans_member_id on loans(member_id);
create index idx_loans_copy_id on loans(copy_id);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id),
  member_id uuid not null references members(id),
  copy_id uuid references copies(id),
  scope reservation_scope not null default 'internal',
  status reservation_status not null default 'pending',
  position integer not null default 0,
  requested_at timestamptz not null default now(),
  reserved_at timestamptz,
  expires_at timestamptz,
  fulfilled_at timestamptz,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_reason text
);
create index idx_reservations_member_id on reservations(member_id);
create index idx_reservations_book_id on reservations(book_id);
create index idx_reservations_status on reservations(status);

create table fines (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id),
  member_id uuid not null references members(id),
  amount numeric not null,
  reason text not null,
  status fine_status not null default 'open',
  waived_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_fines_member_id on fines(member_id);
create index idx_fines_loan_id on fines(loan_id);
create index idx_fines_status on fines(status);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text
);

create table book_tags (
  book_id uuid not null references books(id) on delete cascade,
  tag_id uuid not null references tags(id),
  primary key (book_id, tag_id)
);
create index idx_book_tags_tag_id on book_tags(tag_id);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  label text not null,
  local_path text not null,
  mime_type text,
  size integer,
  created_at timestamptz not null default now()
);
create index idx_attachments_book_id on attachments(book_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_created_at on audit_logs(created_at);

create table saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  query_json jsonb not null,
  created_at timestamptz not null default now()
);

create table inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  shelf_id uuid references shelves(id),
  status inventory_session_status not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references profiles(id)
);

create table inventory_scans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references inventory_sessions(id) on delete cascade,
  copy_id uuid references copies(id),
  scanned_barcode text not null,
  result inventory_scan_result not null,
  scanned_at timestamptz not null default now()
);
create index idx_inventory_scans_session_id on inventory_scans(session_id);
create index idx_inventory_scans_copy_id on inventory_scans(copy_id);

create index idx_members_status on members(status);
create index idx_members_archived_at on members(archived_at);
create index idx_members_role on members(role);

-- ============================================================
-- 0003_settings_and_functions.sql
-- ============================================================
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

-- ============================================================
-- 0004_rls.sql
-- ============================================================
-- Warraq Supabase schema — part 4: Row Level Security.
-- Catalog tables (books/authors/categories/publishers/copies/tags) are readable by anyone —
-- the hospital plans a public website reading this same data later. Everything involving a
-- person (members, loans, reservations, fines, audit, staff profiles) requires an
-- authenticated, active staff/admin session (see is_staff()/is_admin() in migration 0003).

alter table rooms enable row level security;
alter table shelves enable row level security;
alter table publishers enable row level security;
alter table categories enable row level security;
alter table authors enable row level security;
alter table books enable row level security;
alter table book_authors enable row level security;
alter table copies enable row level security;
alter table profiles enable row level security;
alter table members enable row level security;
alter table loans enable row level security;
alter table reservations enable row level security;
alter table fines enable row level security;
alter table tags enable row level security;
alter table book_tags enable row level security;
alter table attachments enable row level security;
alter table audit_logs enable row level security;
alter table saved_searches enable row level security;
alter table inventory_sessions enable row level security;
alter table inventory_scans enable row level security;
alter table library_settings enable row level security;

-- Public catalog read access (anon + authenticated).
create policy catalog_public_read on books for select to anon, authenticated using (true);
create policy catalog_authors_public_read on authors for select to anon, authenticated using (true);
create policy catalog_book_authors_public_read on book_authors for select to anon, authenticated using (true);
create policy catalog_categories_public_read on categories for select to anon, authenticated using (true);
create policy catalog_publishers_public_read on publishers for select to anon, authenticated using (true);
create policy catalog_copies_public_read on copies for select to anon, authenticated using (true);
create policy catalog_tags_public_read on tags for select to anon, authenticated using (true);
create policy catalog_book_tags_public_read on book_tags for select to anon, authenticated using (true);

-- Staff-managed writes on catalog tables.
create policy catalog_books_staff_write on books for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_authors_staff_write on authors for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_book_authors_staff_write on book_authors for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_categories_staff_write on categories for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_publishers_staff_write on publishers for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_copies_staff_write on copies for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_tags_staff_write on tags for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_book_tags_staff_write on book_tags for all to authenticated using (is_staff()) with check (is_staff());
create policy attachments_staff_all on attachments for all to authenticated using (is_staff()) with check (is_staff());

-- Internal operations tables: staff-only, no public access at all.
create policy rooms_staff_all on rooms for all to authenticated using (is_staff()) with check (is_staff());
create policy shelves_staff_all on shelves for all to authenticated using (is_staff()) with check (is_staff());
create policy members_staff_all on members for all to authenticated using (is_staff()) with check (is_staff());
create policy loans_staff_all on loans for all to authenticated using (is_staff()) with check (is_staff());
create policy reservations_staff_all on reservations for all to authenticated using (is_staff()) with check (is_staff());
create policy fines_staff_all on fines for all to authenticated using (is_staff()) with check (is_staff());
create policy saved_searches_staff_all on saved_searches for all to authenticated using (is_staff()) with check (is_staff());
create policy inventory_sessions_staff_all on inventory_sessions for all to authenticated using (is_staff()) with check (is_staff());
create policy inventory_scans_staff_all on inventory_scans for all to authenticated using (is_staff()) with check (is_staff());

-- Audit log: staff can read and append, nobody can update/delete (immutable timeline).
create policy audit_logs_staff_read on audit_logs for select to authenticated using (is_staff());
create policy audit_logs_staff_insert on audit_logs for insert to authenticated with check (is_staff());

-- Library-wide settings: any active staff member can read; only admins can change them.
create policy library_settings_staff_read on library_settings for select to authenticated using (is_staff());
create policy library_settings_admin_write on library_settings for update to authenticated using (is_admin()) with check (is_admin());

-- Staff profiles: everyone sees their own profile, admins see/manage everyone.
-- Creation/password-reset/disable happens through the Rust admin commands using the
-- service-role key (which bypasses RLS entirely), never through direct client writes.
create policy profiles_self_or_admin_read on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy profiles_admin_write on profiles for update to authenticated using (is_admin()) with check (is_admin());

-- ============================================================
-- 0005_admin_safeguards.sql
-- ============================================================
-- Warraq Supabase schema — part 5: keep the library from ever locking itself out of admin
-- access, no matter which path a profile row is changed/removed through.
create or replace function assert_not_last_admin() returns trigger as $$
declare
  v_active_admins integer;
begin
  if (TG_OP = 'DELETE' and OLD.role = 'admin' and OLD.status = 'active')
     or (TG_OP = 'UPDATE' and OLD.role = 'admin' and OLD.status = 'active' and (NEW.role <> 'admin' or NEW.status <> 'active')) then
    select count(*) into v_active_admins from profiles where role = 'admin' and status = 'active' and id <> OLD.id;
    if v_active_admins = 0 then
      raise exception 'This is the last active administrator and cannot be demoted, disabled, or deleted.';
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_assert_not_last_admin before update or delete on profiles
for each row execute function assert_not_last_admin();

-- ============================================================
-- 0006_read_models.sql
-- ============================================================
-- Warraq Supabase schema — part 6: read-model views/functions mirroring the old SQLite
-- repository queries, so the TS repository layer stays a thin wrapper instead of
-- re-deriving this join/aggregation logic in PostgREST embedding syntax.

-- security_invoker=true on every view here: by default a Postgres view evaluates RLS
-- using the VIEW OWNER's identity (the migration role, effectively unrestricted), which
-- would silently bypass every RLS policy above. Forcing invoker semantics makes RLS
-- apply based on the actual querying role (anon vs. authenticated+is_staff()), which
-- matters most for loan_details/reservation_details (member PII).
create view book_catalog with (security_invoker = true) as
select
  b.*,
  p.name as publisher,
  cat.name as category,
  (select string_agg(a.name, ', ' order by ba.author_order) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id) as author,
  (select string_agg(t.name, ', ') from book_tags bt join tags t on t.id = bt.tag_id where bt.book_id = b.id) as tag_list,
  (select count(*) from copies where book_id = b.id) as total_copies,
  (select count(*) from copies where book_id = b.id and status = 'available') as available_copies
from books b
left join publishers p on p.id = b.publisher_id
left join categories cat on cat.id = b.category_id;

create or replace function search_books(p_query text default '', p_item_type text default '')
returns setof book_catalog as $$
  select * from book_catalog
  where archived_at is null
    and (p_item_type = '' or item_type::text = p_item_type)
    and (
      p_query = ''
      or title ilike '%' || p_query || '%'
      or arabic_title ilike '%' || p_query || '%'
      or subtitle ilike '%' || p_query || '%'
      or isbn13 ilike '%' || p_query || '%'
      or isbn10 ilike '%' || p_query || '%'
      or author ilike '%' || p_query || '%'
    )
  order by title;
$$ language sql stable set search_path = public;

create view copy_catalog with (security_invoker = true) as
select
  c.*,
  b.title, b.item_type, b.metadata, b.cover_path,
  (select string_agg(a.name, ', ' order by ba.author_order) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id) as author,
  s.code as shelf
from copies c
join books b on b.id = c.book_id
left join shelves s on s.id = c.shelf_id;

create or replace function search_copies(p_query text default '')
returns setof copy_catalog as $$
  select * from copy_catalog
  where p_query = '' or barcode ilike '%' || p_query || '%' or accession_number ilike '%' || p_query || '%' or title ilike '%' || p_query || '%'
  order by title;
$$ language sql stable set search_path = public;

create view loan_details with (security_invoker = true) as
select l.*, b.title, b.item_type, c.barcode, m.full_name as member_name
from loans l
join copies c on c.id = l.copy_id
join books b on b.id = c.book_id
join members m on m.id = l.member_id;

create view reservation_details with (security_invoker = true) as
select
  r.*,
  coalesce(b.title, 'Unknown Title') as title,
  b.subtitle, b.arabic_title,
  (select string_agg(a.name, ', ' order by ba.author_order) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id) as author,
  cat.name as category,
  b.item_type,
  coalesce(b.cover_path, b.cover_url) as cover_path,
  b.isbn13, b.call_number,
  p.name as publisher,
  coalesce(m.full_name, 'Visitor / Guest') as member_name,
  m.member_number, m.email as member_email, m.phone as member_phone, m.department as member_dept, m.role as member_role, m.avatar_path as member_avatar, m.reservation_banned as member_banned,
  cp.barcode as copy_barcode, cp.accession_number as copy_accession, cp.condition as copy_condition, s.code as copy_shelf
from reservations r
left join books b on b.id = r.book_id
left join categories cat on cat.id = b.category_id
left join publishers p on p.id = b.publisher_id
left join members m on m.id = r.member_id
left join copies cp on cp.id = r.copy_id
left join shelves s on s.id = cp.shelf_id;

create or replace function dashboard_metrics()
returns jsonb as $$
  select json_build_object(
    'titles', (select count(*) from books where archived_at is null),
    'copies', (select count(*) from copies where status != 'archived'),
    'onLoan', (select count(*) from loans where returned_at is null),
    'members', (select count(*) from members where status = 'active'),
    'overdue', (select count(*) from loans where returned_at is null and due_at < now()),
    'readyReservations', (select count(*) from reservations where status = 'ready'),
    'recentLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details order by borrowed_at desc limit 5
    ) t),
    'overdueLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details where returned_at is null and due_at < now() order by due_at asc limit 5
    ) t),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'count', coalesce(a.count, 0))), '[]'::jsonb) from (
      select (current_date - g)::text as day from generate_series(0, 6) g
    ) d left join (
      select borrowed_at::date::text as day, count(*) as count from loans where borrowed_at >= now() - interval '6 days' group by borrowed_at::date
    ) a on a.day = d.day),
    'activeDepartments', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select m.department as name, count(l.id) as count from loans l join members m on m.id = l.member_id
      where m.department is not null and m.department != '' group by m.department order by count desc limit 5
    ) t),
    'circulationRhythm', (select coalesce(jsonb_agg(jsonb_build_object(
        'time', label,
        'checkouts', coalesce((select count(*) from loans where borrowed_at::date = current_date and extract(hour from borrowed_at) = hour), 0),
        'returns', coalesce((select count(*) from loans where returned_at is not null and returned_at::date = current_date and extract(hour from returned_at) = hour), 0)
      )), '[]'::jsonb) from (values ('8 AM',8),('10 AM',10),('12 PM',12),('2 PM',14),('4 PM',16),('6 PM',18)) as slots(label, hour)
    )
  );
$$ language sql stable set search_path = public;

grant select on book_catalog, copy_catalog to anon, authenticated;
grant select on loan_details, reservation_details to authenticated;
grant execute on function search_books(text, text), search_copies(text) to anon, authenticated;
grant execute on function dashboard_metrics() to authenticated;

-- ============================================================
-- 0007_function_privileges.sql
-- ============================================================
-- Warraq Supabase schema — part 7: Postgres grants EXECUTE on new functions to PUBLIC by
-- default (unlike tables). RLS on the underlying tables already made every one of these
-- safe for anon to call (is_staff() returns false / RLS returns zero rows), but revoke the
-- default anyway and grant explicitly — least privilege, and it stops dashboard_metrics()
-- from being callable (if uselessly) by anonymous clients.
revoke execute on function
  is_staff(uuid), is_admin(uuid), current_actor(),
  advance_reservation_queue(uuid), checkout(uuid, uuid, reservation_scope),
  return_copies(uuid[], text), accept_reservation(uuid, text), decline_reservation(uuid, text),
  fulfil_reservation(uuid), ban_member(uuid, text), unban_member(uuid), dashboard_metrics()
from public;

grant execute on function
  checkout(uuid, uuid, reservation_scope), return_copies(uuid[], text),
  accept_reservation(uuid, text), decline_reservation(uuid, text), fulfil_reservation(uuid),
  ban_member(uuid, text), unban_member(uuid), dashboard_metrics()
to authenticated;

-- ============================================================
-- 0008_login_helper.sql
-- ============================================================
-- Warraq Supabase schema — part 8: username-based login. profiles.email is always the
-- real Supabase Auth identity (synthesized as <username>@warraq.local when the staff
-- member has no real email — see src-tauri/src/admin.rs), not an optional contact field.
-- Anonymous clients can't read the profiles table (RLS), so login needs a narrow,
-- SECURITY DEFINER lookup that returns nothing but the one email needed to authenticate.
create or replace function resolve_login_email(p_username text) returns text as $$
  select email from profiles where username = lower(trim(p_username)) and status = 'active';
$$ language sql stable security definer set search_path = public;

revoke execute on function resolve_login_email(text) from public;
grant execute on function resolve_login_email(text) to anon, authenticated;

-- ============================================================
-- 0009_self_service_profile.sql
-- ============================================================
-- Warraq Supabase schema — part 9: the only two profile fields a signed-in user may ever
-- touch on themselves (last_login_at, must_change_password) — everything else on
-- `profiles` needs is_admin() per the profiles_admin_write policy in migration 0004.
create or replace function touch_last_login() returns void as $$
  update profiles set last_login_at = now() where id = auth.uid();
$$ language sql security definer set search_path = public;

create or replace function clear_must_change_password() returns void as $$
  update profiles set must_change_password = false where id = auth.uid();
$$ language sql security definer set search_path = public;

revoke execute on function touch_last_login(), clear_must_change_password() from public;
grant execute on function touch_last_login(), clear_must_change_password() to authenticated;

-- ============================================================
-- 0010_shelf_overview.sql
-- ============================================================
create view shelf_overview with (security_invoker = true) as
select s.*, r.name as room,
  (select count(*) from copies where shelf_id = s.id and status != 'archived') as copy_count
from shelves s
join rooms r on r.id = s.room_id;

grant select on shelf_overview to authenticated;

-- Provisions the fixed A-F + floor shelf set for a newly created room, so staff never
-- have to hand-create shelves one at a time — the shelf layout is fixed by design.
create or replace function provision_room_shelves(p_room_id uuid) returns void as $$
begin
  if not is_staff() then raise exception 'not authorized'; end if;
  insert into shelves (room_id, shelf_type, code, capacity)
  select p_room_id, 'top', code, 40 from unnest(array['A','B','C','D','E','F']) as code
  on conflict (room_id, code) do nothing;
  insert into shelves (room_id, shelf_type, code, capacity)
  values (p_room_id, 'floor', '⬤', 120)
  on conflict (room_id, code) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function provision_room_shelves(uuid) from public;
grant execute on function provision_room_shelves(uuid) to authenticated;

-- ============================================================
-- 0011_login_accounts.sql
-- ============================================================
-- Warraq Supabase schema — part 11: login account listing.
-- Allows unauthenticated clients on the login screen to list active staff accounts
-- for account selection. Returns only minimal non-sensitive public profile details.
create or replace function list_login_accounts()
returns table (username text, full_name text, role staff_role, avatar_path text) as $$
  select username, full_name, role, avatar_path
  from profiles
  where status = 'active'
  order by full_name asc;
$$ language sql stable security definer set search_path = public;

revoke execute on function list_login_accounts() from public;
grant execute on function list_login_accounts() to anon, authenticated;

-- ============================================================
-- 0012_shelf_columns.sql
-- ============================================================
-- Replaces the fixed "one room = A-F + floor" shelf layout with a "columns" (bookcases)
-- layer: a room can now hold any number of columns, each freely added, each with its own
-- floor shelf plus whichever A-F rows are chosen for it. Rooms go back to being a bare
-- location — shelves only exist once a column is added to them.

create table columns (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint columns_room_number_unique unique (room_id, number)
);

alter table columns enable row level security;
create policy columns_staff_all on columns for all to authenticated using (is_staff()) with check (is_staff());

-- give every existing room a first column and move its shelves onto it, so no shelf
-- (or the copies placed on it) gets orphaned by this migration
insert into columns (room_id, number)
select id, 1 from rooms;

alter table shelves add column column_id uuid references columns(id) on delete cascade;

update shelves s
set column_id = c.id
from columns c
where c.room_id = s.room_id and c.number = 1;

alter table shelves drop constraint shelves_room_code_unique;
drop index if exists idx_shelves_room_id;
alter table shelves alter column column_id set not null;
-- shelf_overview selects shelves.room_id, so it has to go before the column does; it is
-- recreated below on top of columns.
drop view if exists shelf_overview;
alter table shelves drop column room_id;

alter table shelves add constraint shelves_column_code_unique unique (column_id, code);
create index idx_shelves_column_id on shelves(column_id);

drop function if exists provision_room_shelves(uuid);

create view shelf_overview with (security_invoker = true) as
select s.*, c.room_id as room_id, c.number as column_number, r.name as room,
  (select count(*) from copies where shelf_id = s.id and status != 'archived') as copy_count
from shelves s
join columns c on c.id = s.column_id
join rooms r on r.id = c.room_id;

grant select on shelf_overview to authenticated;

-- Creates a new column in a room with a floor shelf plus the chosen A-F rows.
-- Column numbers auto-increment per room so staff never have to pick one.
create or replace function create_column(p_room_id uuid, p_rows text[])
returns uuid as $$
declare
  v_column_id uuid;
  v_number integer;
  v_row text;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  if p_rows is null or array_length(p_rows, 1) is null then
    raise exception 'Select at least one row (A-F) for the new column.';
  end if;

  foreach v_row in array p_rows loop
    if v_row not in ('A','B','C','D','E','F') then
      raise exception 'Invalid row code: %', v_row;
    end if;
  end loop;

  select coalesce(max(number), 0) + 1 into v_number from columns where room_id = p_room_id;

  insert into columns (room_id, number) values (p_room_id, v_number) returning id into v_column_id;

  insert into shelves (column_id, shelf_type, code, capacity)
  values (v_column_id, 'floor', '⬤', 120);

  insert into shelves (column_id, shelf_type, code, capacity)
  select v_column_id, 'top', code, 40 from unnest(p_rows) as code;

  return v_column_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function create_column(uuid, text[]) from public;
grant execute on function create_column(uuid, text[]) to authenticated;

-- ============================================================
-- 0013_notifications.sql
-- ============================================================
-- Warraq Supabase schema — part 13: staff notification feed.
-- Persisted notifications (distinct from the live overdue-loan reminders computed client-side
-- from dashboard_metrics()). Populated by triggers on events that don't have a natural
-- "live query" source, starting with reservations turning ready for pickup.

create type notification_type as enum ('reservation_ready', 'system');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  type notification_type not null,
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_created_at on notifications(created_at desc);
create index idx_notifications_is_read on notifications(is_read) where not is_read;

alter table notifications enable row level security;
create policy notifications_staff_all on notifications for all to authenticated using (is_staff()) with check (is_staff());

create or replace function notify_reservation_ready() returns trigger as $$
declare
  v_book_title text;
  v_member_name text;
begin
  if new.status = 'ready' and old.status is distinct from 'ready' then
    select title into v_book_title from books where id = new.book_id;
    select full_name into v_member_name from members where id = new.member_id;
    insert into notifications (type, title, body, link, entity_type, entity_id)
    values (
      'reservation_ready',
      coalesce(v_book_title, 'Reservation ready'),
      coalesce(v_member_name, ''),
      '/reservations',
      'reservation',
      new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_notify_reservation_ready
  after update on reservations
  for each row
  execute function notify_reservation_ready();

revoke execute on function notify_reservation_ready() from public;

-- ============================================================
-- 0014_copy_catalog_location.sql
-- ============================================================
-- Surface a copy's full physical location (room + column/bookcase number + shelf row)
-- on copy_catalog, not just the shelf row letter — the column number was previously
-- only available on shelf_overview, so the catalog copy list couldn't disambiguate
-- copies sitting on the same shelf letter in different columns of the same room.
create or replace view copy_catalog with (security_invoker = true) as
select
  c.*,
  b.title, b.item_type, b.metadata, b.cover_path,
  (select string_agg(a.name, ', ' order by ba.author_order) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id) as author,
  s.code as shelf,
  co.number as column_number,
  r.name as room
from copies c
join books b on b.id = c.book_id
left join shelves s on s.id = c.shelf_id
left join columns co on co.id = s.column_id
left join rooms r on r.id = co.room_id;

-- ============================================================
-- 0015_configurable_shelf_rows.sql
-- ============================================================
-- Makes the number of lettered rows per bookcase column a library-wide setting instead of a
-- hardcoded A-F, so staff can grow taller bookcases (more rows) without a schema change.
alter table library_settings add column shelf_row_count integer not null default 6 check (shelf_row_count between 1 and 20);

create or replace function create_column(p_room_id uuid, p_rows text[])
returns uuid as $$
declare
  v_column_id uuid;
  v_number integer;
  v_row text;
  v_max_rows integer;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  if p_rows is null or array_length(p_rows, 1) is null then
    raise exception 'Select at least one row for the new column.';
  end if;

  select shelf_row_count into v_max_rows from library_settings where id = 1;

  foreach v_row in array p_rows loop
    if length(v_row) != 1 or ascii(v_row) < ascii('A') or ascii(v_row) > ascii('A') + v_max_rows - 1 then
      raise exception 'Invalid row code: % (library allows rows A-%)', v_row, chr(ascii('A') + v_max_rows - 1);
    end if;
  end loop;

  select coalesce(max(number), 0) + 1 into v_number from columns where room_id = p_room_id;

  insert into columns (room_id, number) values (p_room_id, v_number) returning id into v_column_id;

  insert into shelves (column_id, shelf_type, code, capacity)
  values (v_column_id, 'floor', '⬤', 120);

  insert into shelves (column_id, shelf_type, code, capacity)
  select v_column_id, 'top', code, 40 from unnest(p_rows) as code;

  return v_column_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- 0016_ground_shelf_code.sql
-- ============================================================
-- The ground/floor shelf is addressed as row "S" alongside the lettered rows (A, B, C…),
-- so a bookcase column reads S + A-F bottom to top. It previously used a "⬤" glyph, which
-- staff can't type when searching or scanning.
update shelves set code = 'S' where shelf_type = 'floor';

-- 'S' is now reserved for the ground row, so lettered rows can only run A..R (18 rows).
alter table library_settings drop constraint library_settings_shelf_row_count_check;
alter table library_settings add constraint library_settings_shelf_row_count_check check (shelf_row_count between 1 and 18);

create or replace function create_column(p_room_id uuid, p_rows text[])
returns uuid as $$
declare
  v_column_id uuid;
  v_number integer;
  v_row text;
  v_max_rows integer;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  if p_rows is null or array_length(p_rows, 1) is null then
    raise exception 'Select at least one row for the new column.';
  end if;

  select shelf_row_count into v_max_rows from library_settings where id = 1;

  foreach v_row in array p_rows loop
    if length(v_row) != 1 or ascii(v_row) < ascii('A') or ascii(v_row) > ascii('A') + v_max_rows - 1 then
      raise exception 'Invalid row code: % (library allows rows A-%)', v_row, chr(ascii('A') + v_max_rows - 1);
    end if;
  end loop;

  select coalesce(max(number), 0) + 1 into v_number from columns where room_id = p_room_id;

  insert into columns (room_id, number) values (p_room_id, v_number) returning id into v_column_id;

  insert into shelves (column_id, shelf_type, code, capacity)
  values (v_column_id, 'floor', 'S', 120);

  insert into shelves (column_id, shelf_type, code, capacity)
  select v_column_id, 'top', code, 40 from unnest(p_rows) as code;

  return v_column_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- 0017_grace_period_and_due_soon.sql
-- ============================================================
-- Grace period was configurable in library_settings but never actually applied: dashboard_metrics
-- flagged a loan overdue the instant it passed due_at, ignoring the grace window. This recreates
-- the read model so a loan only counts as overdue once it is past due_at PLUS the configured grace
-- (when grace is enabled), and it adds a "due soon" feed (loans coming due within
-- notify_due_soon_days) so the matching notification setting has real data to surface.
create or replace function dashboard_metrics()
returns jsonb as $$
  with s as (
    select
      case when grace_period_enabled then coalesce(grace_period_days, 0) else 0 end as grace_days,
      coalesce(notify_due_soon_days, 0) as due_soon_days
    from library_settings where id = 1
  ),
  -- Effective moment a loan becomes overdue = due_at + grace window.
  cutoff as (select now() - make_interval(days => (select grace_days from s)) as overdue_before),
  soon as (select now() + make_interval(days => (select due_soon_days from s)) as due_before)
  select json_build_object(
    'titles', (select count(*) from books where archived_at is null),
    'copies', (select count(*) from copies where status != 'archived'),
    'onLoan', (select count(*) from loans where returned_at is null),
    'members', (select count(*) from members where status = 'active'),
    'overdue', (select count(*) from loans where returned_at is null and due_at < (select overdue_before from cutoff)),
    'readyReservations', (select count(*) from reservations where status = 'ready'),
    'dueSoon', (select count(*) from loans
      where returned_at is null
        and due_at >= (select overdue_before from cutoff)
        and due_at <= (select due_before from soon)),
    'recentLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details order by borrowed_at desc limit 5
    ) t),
    'overdueLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details where returned_at is null and due_at < (select overdue_before from cutoff) order by due_at asc limit 5
    ) t),
    'dueSoonLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details
      where returned_at is null
        and due_at >= (select overdue_before from cutoff)
        and due_at <= (select due_before from soon)
      order by due_at asc limit 10
    ) t),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'count', coalesce(a.count, 0))), '[]'::jsonb) from (
      select (current_date - g)::text as day from generate_series(0, 6) g
    ) d left join (
      select borrowed_at::date::text as day, count(*) as count from loans where borrowed_at >= now() - interval '6 days' group by borrowed_at::date
    ) a on a.day = d.day),
    'activeDepartments', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select m.department as name, count(l.id) as count from loans l join members m on m.id = l.member_id
      where m.department is not null and m.department != '' group by m.department order by count desc limit 5
    ) t),
    'circulationRhythm', (select coalesce(jsonb_agg(jsonb_build_object(
        'time', label,
        'checkouts', coalesce((select count(*) from loans where borrowed_at::date = current_date and extract(hour from borrowed_at) = hour), 0),
        'returns', coalesce((select count(*) from loans where returned_at is not null and returned_at::date = current_date and extract(hour from returned_at) = hour), 0)
      )), '[]'::jsonb) from (values ('8 AM',8),('10 AM',10),('12 PM',12),('2 PM',14),('4 PM',16),('6 PM',18)) as slots(label, hour)
    )
  );
$$ language sql stable set search_path = public;

grant execute on function dashboard_metrics() to authenticated;

-- ============================================================
-- 0018_fix_shelf_code_constraint.sql
-- ============================================================
-- Reproducibility fix: the original shelves_code_valid CHECK (migration 0001) only permitted
-- top codes A-F and the floor code '⬤'. Migration 0015 later allowed up to 18 lettered rows
-- (A-R) and 0016 renamed the floor row to 'S' — but neither updated this constraint, so on a
-- fresh `supabase db reset` create_column() violates the CHECK the instant it inserts an 'S'
-- floor shelf or a row beyond 'F'. Production kept working only because the constraint was
-- dropped by hand (never captured as a migration), leaving the tracked schema unreproducible.
--
-- This aligns the constraint with the current shelf model: floor = 'S', lettered rows A-R.
-- Idempotent and safe to run whether or not the old constraint still exists.

-- Any floor shelves still carrying the legacy glyph (if 0016's UPDATE never applied) become 'S'.
update shelves set code = 'S' where shelf_type = 'floor' and code <> 'S';

alter table shelves drop constraint if exists shelves_code_valid;

alter table shelves add constraint shelves_code_valid check (
  (shelf_type = 'top' and code ~ '^[A-R]$')
  or (shelf_type = 'floor' and code = 'S')
);

-- ============================================================
-- 0019_circulation_rules.sql
-- ============================================================
-- Make the configured circulation rules actually take effect.
--
--   * checkout() dated loans by the RESERVATION-hold settings (reservation_external_days /
--     reservation_internal_days), so the "Loan period" (loan_days) setting did nothing for new
--     loans while renewals used it — a renewed loan contradicted its original term. External
--     take-home loans now use loan_days; internal in-library loans keep the short internal window.
--   * loan_limit was never enforced — a member could take out unlimited copies. checkout() now
--     rejects an external loan once the member already holds loan_limit open external loans.
--   * renew_limit was never enforced (renewals were a direct client-side UPDATE). renewals now go
--     through a server-side renew_loan() RPC that caps them at renew_limit and extends by the same
--     period rule as a fresh loan.

create or replace function checkout(p_copy_id uuid, p_member_id uuid, p_scope reservation_scope default 'external')
returns loans as $$
declare
  v_member members;
  v_copy copies;
  v_days integer;
  v_settings library_settings;
  v_loan loans;
  v_open_external integer;
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

  -- Cap the number of items a member may have out at once. Only take-home (external) loans count:
  -- internal loans are short in-library use and shouldn't consume the borrowing allowance.
  if p_scope = 'external' then
    select count(*) into v_open_external
    from loans where member_id = p_member_id and returned_at is null and scope = 'external';
    if v_open_external >= coalesce(v_settings.loan_limit, 3) then
      raise exception 'member has reached the loan limit of %', coalesce(v_settings.loan_limit, 3);
    end if;
  end if;

  -- External loans run for the configured loan period; internal loans keep the short in-library window.
  v_days := case when p_scope = 'internal' then coalesce(v_settings.reservation_internal_days, 1)
                 else coalesce(v_settings.loan_days, 14) end;

  insert into loans (copy_id, member_id, scope, due_at, issued_by, condition_out)
  values (p_copy_id, p_member_id, p_scope, now() + (v_days || ' days')::interval, auth.uid(), v_copy.condition)
  returning * into v_loan;

  update copies set status = 'on-loan', updated_at = now() where id = p_copy_id;

  insert into audit_logs(actor, action, entity_type, entity_id, after_json)
  values (current_actor(), 'checkout', 'loan', v_loan.id::text, to_jsonb(v_loan));

  return v_loan;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function renew_loan(p_loan_id uuid)
returns loans as $$
declare
  v_loan loans;
  v_settings library_settings;
  v_days integer;
  v_base timestamptz;
begin
  if not is_staff() then raise exception 'not authorized'; end if;

  select * into v_loan from loans where id = p_loan_id for update;
  if v_loan is null then raise exception 'loan not found'; end if;
  if v_loan.returned_at is not null then raise exception 'this loan has already been returned'; end if;

  select * into v_settings from library_settings where id = 1;
  if v_loan.renewed_count >= coalesce(v_settings.renew_limit, 2) then
    raise exception 'renewal limit of % reached for this loan', coalesce(v_settings.renew_limit, 2);
  end if;

  v_days := case when v_loan.scope = 'internal' then coalesce(v_settings.reservation_internal_days, 1)
                 else coalesce(v_settings.loan_days, 14) end;
  -- Extend from the later of the current due date or now, so an early renewal doesn't shorten the term.
  v_base := greatest(v_loan.due_at, now());

  update loans
  set due_at = v_base + (v_days || ' days')::interval, renewed_count = renewed_count + 1
  where id = p_loan_id
  returning * into v_loan;

  insert into audit_logs(actor, action, entity_type, entity_id, after_json)
  values (current_actor(), 'renew', 'loan', v_loan.id::text, to_jsonb(v_loan));

  return v_loan;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function renew_loan(uuid) from public;
grant execute on function renew_loan(uuid) to authenticated;

-- ============================================================
-- 0020_fix_fulfil_reservation_copy_status.sql
-- ============================================================
-- Warraq Supabase schema — part 20: fix fulfil_reservation rejecting ready holds.
-- accept_reservation() marks the held copy 'reserved', but checkout() only accepts
-- copies with status 'available' — so fulfil_reservation() (mark as picked up)
-- always failed with "copy is not available". Flip the copy back to available
-- immediately before handing off to checkout(), which sets it to 'on-loan' anyway.

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

  update copies set status = 'available', updated_at = now() where id = v_res.copy_id;

  v_loan := checkout(v_res.copy_id, v_res.member_id, v_res.scope);

  update reservations set status = 'fulfilled', fulfilled_at = now() where id = p_reservation_id;

  return v_loan;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- 0021_loan_details_enrichment.sql
-- ============================================================
-- loan_details only exposed title/item_type/barcode/member_name, which was enough for the
-- dashboard's small "recent loans" list but not for a full Loans screen: no cover, no author,
-- no member number/avatar, no shelf location. Reservations already had all of this through
-- reservation_details, which is why that page could show rich rows and loans could not.
--
-- Replaced rather than dropped: the original output columns are kept first, in their original
-- order, and the new ones appended, so `create or replace view` is accepted and every existing
-- consumer (dashboard_metrics aggregates this view) keeps working untouched.
create or replace view loan_details with (security_invoker = true) as
select
  l.*,
  b.title, b.item_type, c.barcode, m.full_name as member_name,
  -- Appended below this line.
  b.id as book_id,
  b.subtitle,
  b.arabic_title,
  (select string_agg(a.name, ', ' order by ba.author_order)
     from book_authors ba join authors a on a.id = ba.author_id
    where ba.book_id = b.id) as author,
  cat.name as category,
  p.name as publisher,
  coalesce(b.cover_path, b.cover_url) as cover_path,
  b.isbn13,
  b.call_number,
  c.accession_number as copy_accession,
  c.condition as copy_condition,
  s.code as copy_shelf,
  m.member_number,
  m.email as member_email,
  m.phone as member_phone,
  m.department as member_dept,
  m.role as member_role,
  m.avatar_path as member_avatar
from loans l
join copies c on c.id = l.copy_id
join books b on b.id = c.book_id
join members m on m.id = l.member_id
left join categories cat on cat.id = b.category_id
left join publishers p on p.id = b.publisher_id
left join shelves s on s.id = c.shelf_id;

-- ============================================================
-- 0022_expire_ready_holds.sql
-- ============================================================
-- Warraq Supabase schema — part 22: expire 'ready' holds once their pickup window passes.
-- accept_reservation() and advance_reservation_queue() stamp expires_at on a hold, but nothing
-- ever acted on it: an unclaimed hold stayed 'ready' forever and kept its copy 'reserved', so
-- the Website showed the title as unavailable and the next queued member never got the copy.
--
-- sweep_reservations() expires every overdue hold, puts its copy back on the shelf, and runs
-- advance_reservation_queue() so the copy goes straight to whoever is queued next. It also
-- replaces the App's boot-time advance_reservation_queue(null) call, which has been failing
-- silently since 0007 revoked EXECUTE on that function without granting it to authenticated.

create or replace function sweep_reservations() returns integer as $$
declare
  v_res reservations;
  v_expired integer := 0;
begin
  for v_res in
    update reservations set status = 'expired'
    where status = 'ready' and expires_at is not null and expires_at < now()
    returning *
  loop
    v_expired := v_expired + 1;

    -- Only release a copy that is still held. Staff may have moved it to repair/lost or lent it
    -- out by hand in the meantime, and another ready hold may already point at it.
    if v_res.copy_id is not null then
      update copies set status = 'available', updated_at = now()
      where id = v_res.copy_id and status = 'reserved'
        and not exists (select 1 from reservations where copy_id = v_res.copy_id and status = 'ready');
    end if;

    insert into audit_logs(actor, action, entity_type, entity_id, after_json)
    values (current_actor(), 'expire_reservation', 'reservation', v_res.id::text, to_jsonb(v_res));
  end loop;

  -- The full pass walks every available copy, so skip it when there is no queue to promote.
  if exists (select 1 from reservations where status = 'queued') then
    perform advance_reservation_queue(null);
  end if;

  return v_expired;
end;
$$ language plpgsql security definer set search_path = public;

-- Only acts on holds whose expiry has already passed, so any signed-in client may trigger it.
revoke execute on function sweep_reservations() from public;
grant execute on function sweep_reservations() to authenticated;

-- The App sweeps on boot and whenever the dashboard loads, which leaves holds stale while nobody
-- has it open (the Website keeps showing those copies as reserved). If pg_cron is enabled on the
-- project, also sweep every 15 minutes. Re-running this migration replaces the job by name.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('sweep_reservations', '*/15 * * * *', 'select public.sweep_reservations()');
  end if;
end $$;
