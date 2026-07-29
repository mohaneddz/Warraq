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
alter table shelves drop column room_id;

alter table shelves add constraint shelves_column_code_unique unique (column_id, code);
create index idx_shelves_column_id on shelves(column_id);

drop function if exists provision_room_shelves(uuid);

drop view shelf_overview;
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
