CREATE INDEX IF NOT EXISTS books_isbn13_idx ON books(isbn13);
CREATE INDEX IF NOT EXISTS books_isbn10_idx ON books(isbn10);
CREATE INDEX IF NOT EXISTS books_title_idx ON books(title);
CREATE INDEX IF NOT EXISTS authors_normalized_name_idx ON authors(normalized_name);
CREATE INDEX IF NOT EXISTS copies_barcode_idx ON copies(barcode);
CREATE INDEX IF NOT EXISTS copies_accession_idx ON copies(accession_number);
CREATE INDEX IF NOT EXISTS copies_status_idx ON copies(status);
CREATE INDEX IF NOT EXISTS members_number_idx ON members(member_number);
CREATE INDEX IF NOT EXISTS members_name_idx ON members(full_name);
CREATE INDEX IF NOT EXISTS loans_open_due_idx ON loans(due_at) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS reservations_status_idx ON reservations(status, book_id, position);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE TRIGGER IF NOT EXISTS books_fts_insert AFTER INSERT ON books BEGIN
  INSERT INTO catalog_fts(rowid, title, isbn, authors) VALUES (new.rowid, new.title, COALESCE(new.isbn13,new.isbn10,''), '');
END;
CREATE TRIGGER IF NOT EXISTS books_fts_update AFTER UPDATE OF title,isbn10,isbn13 ON books BEGIN
  INSERT INTO catalog_fts(catalog_fts,rowid,title,isbn,authors) VALUES('delete',old.rowid,old.title,COALESCE(old.isbn13,old.isbn10,''),'');
  INSERT INTO catalog_fts(rowid,title,isbn,authors) VALUES(new.rowid,new.title,COALESCE(new.isbn13,new.isbn10,''),'');
END;
