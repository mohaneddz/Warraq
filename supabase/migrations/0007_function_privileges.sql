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
