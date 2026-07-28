-- Warraq Supabase schema — part 4: Row Level Security.
-- Catalog tables (books/authors/categories/publishers/copies/tags) are readable by anyone —
-- the hospital plans a public website reading this same data later. Everything involving a
-- person (members, loans, reservations, fines, audit, staff profiles) requires an
-- authenticated, active staff/admin session (see is_staff()/is_admin() in migration 0003).

alter table rooms enable row level security;
alter table shelves enable row level security;
alter table publishers enable row level security;
alter table categories enable row level security;
alter table authors enable row level security;
alter table books enable row level security;
alter table book_authors enable row level security;
alter table copies enable row level security;
alter table profiles enable row level security;
alter table members enable row level security;
alter table loans enable row level security;
alter table reservations enable row level security;
alter table fines enable row level security;
alter table tags enable row level security;
alter table book_tags enable row level security;
alter table attachments enable row level security;
alter table audit_logs enable row level security;
alter table saved_searches enable row level security;
alter table inventory_sessions enable row level security;
alter table inventory_scans enable row level security;
alter table library_settings enable row level security;

-- Public catalog read access (anon + authenticated).
create policy catalog_public_read on books for select to anon, authenticated using (true);
create policy catalog_authors_public_read on authors for select to anon, authenticated using (true);
create policy catalog_book_authors_public_read on book_authors for select to anon, authenticated using (true);
create policy catalog_categories_public_read on categories for select to anon, authenticated using (true);
create policy catalog_publishers_public_read on publishers for select to anon, authenticated using (true);
create policy catalog_copies_public_read on copies for select to anon, authenticated using (true);
create policy catalog_tags_public_read on tags for select to anon, authenticated using (true);
create policy catalog_book_tags_public_read on book_tags for select to anon, authenticated using (true);

-- Staff-managed writes on catalog tables.
create policy catalog_books_staff_write on books for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_authors_staff_write on authors for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_book_authors_staff_write on book_authors for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_categories_staff_write on categories for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_publishers_staff_write on publishers for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_copies_staff_write on copies for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_tags_staff_write on tags for all to authenticated using (is_staff()) with check (is_staff());
create policy catalog_book_tags_staff_write on book_tags for all to authenticated using (is_staff()) with check (is_staff());
create policy attachments_staff_all on attachments for all to authenticated using (is_staff()) with check (is_staff());

-- Internal operations tables: staff-only, no public access at all.
create policy rooms_staff_all on rooms for all to authenticated using (is_staff()) with check (is_staff());
create policy shelves_staff_all on shelves for all to authenticated using (is_staff()) with check (is_staff());
create policy members_staff_all on members for all to authenticated using (is_staff()) with check (is_staff());
create policy loans_staff_all on loans for all to authenticated using (is_staff()) with check (is_staff());
create policy reservations_staff_all on reservations for all to authenticated using (is_staff()) with check (is_staff());
create policy fines_staff_all on fines for all to authenticated using (is_staff()) with check (is_staff());
create policy saved_searches_staff_all on saved_searches for all to authenticated using (is_staff()) with check (is_staff());
create policy inventory_sessions_staff_all on inventory_sessions for all to authenticated using (is_staff()) with check (is_staff());
create policy inventory_scans_staff_all on inventory_scans for all to authenticated using (is_staff()) with check (is_staff());

-- Audit log: staff can read and append, nobody can update/delete (immutable timeline).
create policy audit_logs_staff_read on audit_logs for select to authenticated using (is_staff());
create policy audit_logs_staff_insert on audit_logs for insert to authenticated with check (is_staff());

-- Library-wide settings: any active staff member can read; only admins can change them.
create policy library_settings_staff_read on library_settings for select to authenticated using (is_staff());
create policy library_settings_admin_write on library_settings for update to authenticated using (is_admin()) with check (is_admin());

-- Staff profiles: everyone sees their own profile, admins see/manage everyone.
-- Creation/password-reset/disable happens through the Rust admin commands using the
-- service-role key (which bypasses RLS entirely), never through direct client writes.
create policy profiles_self_or_admin_read on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy profiles_admin_write on profiles for update to authenticated using (is_admin()) with check (is_admin());
