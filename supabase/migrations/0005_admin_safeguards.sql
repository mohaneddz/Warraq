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
