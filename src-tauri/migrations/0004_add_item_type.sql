ALTER TABLE books ADD COLUMN item_type TEXT NOT NULL DEFAULT 'book';
CREATE INDEX IF NOT EXISTS idx_books_item_type ON books(item_type);
