-- Schema integrity and performance pass.
-- All statements here are idempotent (IF NOT EXISTS / IF EXISTS) so they are safe
-- to run against databases that were partially migrated ad hoc by earlier app
-- versions (item_type/metadata/copy_id columns are added defensively at runtime
-- in src/data/database.ts instead, since SQLite has no ADD COLUMN IF NOT EXISTS).

-- The catalog_fts5 virtual table was never read by any query and its triggers
-- never covered DELETE, so every row deleted from `books` left a permanently
-- orphaned entry behind. Drop it rather than ship a broken, unused feature.
DROP TRIGGER IF EXISTS books_fts_insert;
DROP TRIGGER IF EXISTS books_fts_update;
DROP TABLE IF EXISTS catalog_fts;

-- Foreign-key / join columns that SQLite does not index automatically.
CREATE INDEX IF NOT EXISTS idx_copies_book_status ON copies(book_id, status);
CREATE INDEX IF NOT EXISTS idx_copies_shelf_id ON copies(shelf_id);
CREATE INDEX IF NOT EXISTS idx_loans_member_open ON loans(member_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loans_member_id ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_copy_id ON loans(copy_id);
CREATE INDEX IF NOT EXISTS idx_reservations_member_id ON reservations(member_id);
CREATE INDEX IF NOT EXISTS idx_reservations_copy_id ON reservations(copy_id);
CREATE INDEX IF NOT EXISTS idx_book_authors_author_id ON book_authors(author_id);
CREATE INDEX IF NOT EXISTS idx_book_tags_tag_id ON book_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_fines_member_id ON fines(member_id);
CREATE INDEX IF NOT EXISTS idx_fines_loan_id ON fines(loan_id);
CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status);
CREATE INDEX IF NOT EXISTS idx_attachments_book_id ON attachments(book_id);
CREATE INDEX IF NOT EXISTS idx_inventory_scans_session_id ON inventory_scans(session_id);
CREATE INDEX IF NOT EXISTS idx_inventory_scans_copy_id ON inventory_scans(copy_id);
CREATE INDEX IF NOT EXISTS idx_books_publisher_id ON books(publisher_id);
CREATE INDEX IF NOT EXISTS idx_books_category_id ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_archived_at ON books(archived_at);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_archived_at ON members(archived_at);
