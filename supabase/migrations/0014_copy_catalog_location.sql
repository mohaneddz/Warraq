-- Surface a copy's full physical location (room + column/bookcase number + shelf row)
-- on copy_catalog, not just the shelf row letter — the column number was previously
-- only available on shelf_overview, so the catalog copy list couldn't disambiguate
-- copies sitting on the same shelf letter in different columns of the same room.
create or replace view copy_catalog with (security_invoker = true) as
select
  c.*,
  b.title, b.item_type, b.metadata, b.cover_path,
  (select string_agg(a.name, ', ' order by ba.author_order) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id) as author,
  s.code as shelf,
  co.number as column_number,
  r.name as room
from copies c
join books b on b.id = c.book_id
left join shelves s on s.id = c.shelf_id
left join columns co on co.id = s.column_id
left join rooms r on r.id = co.room_id;
