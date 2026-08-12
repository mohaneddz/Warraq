-- Grace period was configurable in library_settings but never actually applied: dashboard_metrics
-- flagged a loan overdue the instant it passed due_at, ignoring the grace window. This recreates
-- the read model so a loan only counts as overdue once it is past due_at PLUS the configured grace
-- (when grace is enabled), and it adds a "due soon" feed (loans coming due within
-- notify_due_soon_days) so the matching notification setting has real data to surface.
create or replace function dashboard_metrics()
returns jsonb as $$
  with s as (
    select
      case when grace_period_enabled then coalesce(grace_period_days, 0) else 0 end as grace_days,
      coalesce(notify_due_soon_days, 0) as due_soon_days
    from library_settings where id = 1
  ),
  -- Effective moment a loan becomes overdue = due_at + grace window.
  cutoff as (select now() - make_interval(days => (select grace_days from s)) as overdue_before),
  soon as (select now() + make_interval(days => (select due_soon_days from s)) as due_before)
  select json_build_object(
    'titles', (select count(*) from books where archived_at is null),
    'copies', (select count(*) from copies where status != 'archived'),
    'onLoan', (select count(*) from loans where returned_at is null),
    'members', (select count(*) from members where status = 'active'),
    'overdue', (select count(*) from loans where returned_at is null and due_at < (select overdue_before from cutoff)),
    'readyReservations', (select count(*) from reservations where status = 'ready'),
    'dueSoon', (select count(*) from loans
      where returned_at is null
        and due_at >= (select overdue_before from cutoff)
        and due_at <= (select due_before from soon)),
    'recentLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details order by borrowed_at desc limit 5
    ) t),
    'overdueLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details where returned_at is null and due_at < (select overdue_before from cutoff) order by due_at asc limit 5
    ) t),
    'dueSoonLoans', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select * from loan_details
      where returned_at is null
        and due_at >= (select overdue_before from cutoff)
        and due_at <= (select due_before from soon)
      order by due_at asc limit 10
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

grant execute on function dashboard_metrics() to authenticated;
