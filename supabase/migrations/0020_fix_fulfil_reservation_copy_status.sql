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
