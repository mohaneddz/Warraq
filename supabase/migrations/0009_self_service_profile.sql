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
