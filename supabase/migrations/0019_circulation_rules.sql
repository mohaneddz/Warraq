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
