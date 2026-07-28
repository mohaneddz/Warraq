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
