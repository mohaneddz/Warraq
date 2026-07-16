-- Migration: Add arabic_title to books
ALTER TABLE books ADD COLUMN arabic_title TEXT;
