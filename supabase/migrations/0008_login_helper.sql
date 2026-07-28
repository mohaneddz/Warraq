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
