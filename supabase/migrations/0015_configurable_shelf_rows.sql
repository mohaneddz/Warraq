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
