-- loan_details only exposed title/item_type/barcode/member_name, which was enough for the
-- dashboard's small "recent loans" list but not for a full Loans screen: no cover, no author,
-- no member number/avatar, no shelf location. Reservations already had all of this through
-- reservation_details, which is why that page could show rich rows and loans could not.
--
-- Replaced rather than dropped: the original output columns are kept first, in their original
-- order, and the new ones appended, so `create or replace view` is accepted and every existing
-- consumer (dashboard_metrics aggregates this view) keeps working untouched.
create or replace view loan_details with (security_invoker = true) as
select
  l.*,
  b.title, b.item_type, c.barcode, m.full_name as member_name,
  -- Appended below this line.
  b.id as book_id,
  b.subtitle,
  b.arabic_title,
  (select string_agg(a.name, ', ' order by ba.author_order)
     from book_authors ba join authors a on a.id = ba.author_id
    where ba.book_id = b.id) as author,
  cat.name as category,
  p.name as publisher,
  coalesce(b.cover_path, b.cover_url) as cover_path,
  b.isbn13,
  b.call_number,
  c.accession_number as copy_accession,
  c.condition as copy_condition,
  s.code as copy_shelf,
  m.member_number,
  m.email as member_email,
  m.phone as member_phone,
  m.department as member_dept,
  m.role as member_role,
  m.avatar_path as member_avatar
from loans l
join copies c on c.id = l.copy_id
join books b on b.id = c.book_id
join members m on m.id = l.member_id
left join categories cat on cat.id = b.category_id
left join publishers p on p.id = b.publisher_id
left join shelves s on s.id = c.shelf_id;
