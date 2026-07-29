-- Warraq Supabase schema — part 11: login account listing.
-- Allows unauthenticated clients on the login screen to list active staff accounts
-- for account selection. Returns only minimal non-sensitive public profile details.
create or replace function list_login_accounts()
returns table (username text, full_name text, role user_role, avatar_path text) as $$
  select username, full_name, role, avatar_path
  from profiles
  where status = 'active'
  order by full_name asc;
$$ language sql stable security definer set search_path = public;

revoke execute on function list_login_accounts() from public;
grant execute on function list_login_accounts() to anon, authenticated;
