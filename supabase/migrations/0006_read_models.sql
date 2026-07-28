-- Warraq Supabase schema — part 6: read-model views/functions mirroring the old SQLite
-- repository queries, so the TS repository layer stays a thin wrapper instead of
-- re-deriving this join/aggregation logic in PostgREST embedding syntax.

-- security_invoker=true on every view here: by default a Postgres view evaluates RLS
-- using the VIEW OWNER's identity (the migration role, effectively unrestricted), which
-- would silently bypass every RLS policy above. Forcing invoker semantics makes RLS
-- apply based on the actual querying role (anon vs. authenticated+is_staff()), which
-- matters most for loan_details/reservation_details (member PII).
create view book_catalog with (security_invoker = true) as
select
  b.*,
  p.name as publisher,
  cat.name as category,
  (select string_agg(a.name, ', ' order by ba.author_order) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id) as author,
  (select string_agg(t.name, ', ') from book_tags bt join tags t on t.id = bt.tag_id where bt.book_id = b.id) as tag_list,
  (select count(*) from copies where book_id = b.id) as total_copies,
  (select count(*) from copies where book_id = b.id and status = 'available') as available_copies
from books b
left join publishers p on p.id = b.publisher_id
left join categories cat on cat.id = b.category_id;

create or replace function search_books(p_query text default '', p_item_type text default '')
returns setof book_catalog as $$
  select * from book_catalog
  where archived_at is null
    and (p_item_type = '' or item_type::text = p_item_type)
    and (
      p_query = ''
      or title ilike '%' || p_query || '%'
      or arabic_title ilike '%' || p_query || '%'
      or subtitle ilike '%' || p_query || '%'
      or isbn13 ilike '%' || p_query || '%'
      or isbn10 ilike '%' || p_query || '%'
      or author ilike '%' || p_query || '%'
    )
  order by title;
$$ language sql stable set search_path = public;

create view copy_catalog with (security_invoker = true) as
select
  c.*,
  b.title, b.item_type, b.metadata, b.cover_path,
  (select string_agg(a.name, ', ' order by ba.author_order) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id) as author,
  s.code as shelf
from copies c
join books b on b.id = c.book_id
left join shelves s on s.id = c.shelf_id;

create or replace function search_copies(p_query text default '')
returns setof copy_catalog as $$
  select * from copy_catalog
  where p_query = '' or barcode ilike '%' || p_query || '%' or accession_number ilike '%' || p_query || '%' or title ilike '%' || p_query || '%'
  order by title;
$$ language sql stable set search_path = public;

create view loan_details with (security_invoker = true) as
select l.*, b.title, b.item_type, c.barcode, m.full_name as member_name
from loans l
join copies c on c.id = l.copy_id
join books b on b.id = c.book_id
join members m on m.id = l.member_id;

create view reservation_details with (security_invoker = true) as
select
  r.*,
  coalesce(b.title, 'Unknown Title') as title,
  b.subtitle, b.arabic_title,
  (select string_agg(a.name, ', ' order by ba.author_order) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id) as author,
  cat.name as category,
  b.item_type,
  coalesce(b.cover_path, b.cover_url) as cover_path,
  b.isbn13, b.call_number,
  p.name as publisher,
  coalesce(m.full_name, 'Visitor / Guest') as member_name,
  m.member_number, m.email as member_email, m.phone as member_phone, m.department as member_dept, m.role as member_role, m.avatar_path as member_avatar, m.reservation_banned as member_banned,
  cp.barcode as copy_barcode, cp.accession_number as copy_accession, cp.condition as copy_condition, s.code as copy_shelf
from reservations r
left join books b on b.id = r.book_id
left join categories cat on cat.id = b.category_id
left join publishers p on p.id = b.publisher_id
left join members m on m.id = r.member_id
left join copies cp on cp.id = r.copy_id
left join shelves s on s.id = cp.shelf_id;

create or replace function dashboard_metrics()
returns jsonb as $$
  select json_build_object(
    'titles', (select count(*) from books where archived_at is null),
    'copies', (select count(*) from copies where status != 'archived'),
    'onLoan', (select count(*) from loans where returned_at is null),
    'members', (select count(*) from members where status = 'active'),
    'overdue', (select count(*) from loans where returned_at is null and due_at < now()),
    'readyReservations', (select count(*) from reservations where status = 'ready'),
    'recentLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details order by borrowed_at desc limit 5
    ) t),
    'overdueLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details where returned_at is null and due_at < now() order by due_at asc limit 5
    ) t),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'count', coalesce(a.count, 0))), '[]'::jsonb) from (
      select (current_date - g)::text as day from generate_series(0, 6) g
    ) d left join (
      select borrowed_at::date::text as day, count(*) as count from loans where borrowed_at >= now() - interval '6 days' group by borrowed_at::date
    ) a on a.day = d.day),
    'activeDepartments', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select m.department as name, count(l.id) as count from loans l join members m on m.id = l.member_id
      where m.department is not null and m.department != '' group by m.department order by count desc limit 5
    ) t),
    'circulationRhythm', (select coalesce(jsonb_agg(jsonb_build_object(
        'time', label,
        'checkouts', coalesce((select count(*) from loans where borrowed_at::date = current_date and extract(hour from borrowed_at) = hour), 0),
        'returns', coalesce((select count(*) from loans where returned_at is not null and returned_at::date = current_date and extract(hour from returned_at) = hour), 0)
      )), '[]'::jsonb) from (values ('8 AM',8),('10 AM',10),('12 PM',12),('2 PM',14),('4 PM',16),('6 PM',18)) as slots(label, hour)
    )
  );
$$ language sql stable set search_path = public;

grant select on book_catalog, copy_catalog to anon, authenticated;
grant select on loan_details, reservation_details to authenticated;
grant execute on function search_books(text, text), search_copies(text) to anon, authenticated;
grant execute on function dashboard_metrics() to authenticated;
