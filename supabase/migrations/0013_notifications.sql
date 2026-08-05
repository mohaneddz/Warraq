-- Warraq Supabase schema — part 13: staff notification feed.
-- Persisted notifications (distinct from the live overdue-loan reminders computed client-side
-- from dashboard_metrics()). Populated by triggers on events that don't have a natural
-- "live query" source, starting with reservations turning ready for pickup.

create type notification_type as enum ('reservation_ready', 'system');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  type notification_type not null,
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_created_at on notifications(created_at desc);
create index idx_notifications_is_read on notifications(is_read) where not is_read;

alter table notifications enable row level security;
create policy notifications_staff_all on notifications for all to authenticated using (is_staff()) with check (is_staff());

create or replace function notify_reservation_ready() returns trigger as $$
declare
  v_book_title text;
  v_member_name text;
begin
  if new.status = 'ready' and old.status is distinct from 'ready' then
    select title into v_book_title from books where id = new.book_id;
    select full_name into v_member_name from members where id = new.member_id;
    insert into notifications (type, title, body, link, entity_type, entity_id)
    values (
      'reservation_ready',
      coalesce(v_book_title, 'Reservation ready'),
      coalesce(v_member_name, ''),
      '/reservations',
      'reservation',
      new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_notify_reservation_ready
  after update on reservations
  for each row
  execute function notify_reservation_ready();

revoke execute on function notify_reservation_ready() from public;
