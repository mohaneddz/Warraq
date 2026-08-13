-- Reproducibility fix: the original shelves_code_valid CHECK (migration 0001) only permitted
-- top codes A-F and the floor code '⬤'. Migration 0015 later allowed up to 18 lettered rows
-- (A-R) and 0016 renamed the floor row to 'S' — but neither updated this constraint, so on a
-- fresh `supabase db reset` create_column() violates the CHECK the instant it inserts an 'S'
-- floor shelf or a row beyond 'F'. Production kept working only because the constraint was
-- dropped by hand (never captured as a migration), leaving the tracked schema unreproducible.
--
-- This aligns the constraint with the current shelf model: floor = 'S', lettered rows A-R.
-- Idempotent and safe to run whether or not the old constraint still exists.

-- Any floor shelves still carrying the legacy glyph (if 0016's UPDATE never applied) become 'S'.
update shelves set code = 'S' where shelf_type = 'floor' and code <> 'S';

alter table shelves drop constraint if exists shelves_code_valid;

alter table shelves add constraint shelves_code_valid check (
  (shelf_type = 'top' and code ~ '^[A-R]$')
  or (shelf_type = 'floor' and code = 'S')
);
