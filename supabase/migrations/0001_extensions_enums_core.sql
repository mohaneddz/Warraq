-- Warraq Supabase schema — part 1: extensions, enums, and reference/core tables.
create extension if not exists pgcrypto;

create type item_type as enum ('book','fyp','journal','other');
create type member_role as enum ('visitor','student','staff','medic','other');
create type member_status as enum ('active','suspended','expired','archived');
create type copy_status as enum ('available','on-loan','reserved','repair','lost','archived');
create type shelf_type as enum ('floor','top');
create type staff_role as enum ('admin','staff');
create type staff_status as enum ('active','disabled');

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shelves (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  shelf_type shelf_type not null default 'top',
  code text not null,
  capacity integer not null default 40,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shelves_code_valid check (
    (shelf_type = 'top' and code in ('A','B','C','D','E','F'))
    or (shelf_type = 'floor' and code = '⬤')
  ),
  constraint shelves_room_code_unique unique (room_id, code)
);

create table publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  parent_id uuid references categories(id),
  color text,
  description text
);

create table authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  biography text,
  external_ids text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table books (
  id uuid primary key default gen_random_uuid(),
  item_type item_type not null default 'book',
  isbn10 text,
  isbn13 text,
  title text not null,
  arabic_title text,
  subtitle text,
  description text,
  language text not null default 'French',
  publication_year integer,
  publication_date date,
  edition text,
  page_count integer,
  cover_path text,
  cover_url text,
  publisher_id uuid references publishers(id),
  category_id uuid references categories(id),
  call_number text,
  dewey_code text,
  notes text,
  tags text,
  source text not null default 'manual',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table book_authors (
  book_id uuid not null references books(id) on delete cascade,
  author_id uuid not null references authors(id),
  author_order integer not null default 0,
  primary key (book_id, author_id)
);

create table copies (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  accession_number text not null unique,
  barcode text not null unique,
  shelf_id uuid references shelves(id),
  acquisition_date date,
  acquisition_source text,
  price numeric,
  condition text not null default 'good',
  status copy_status not null default 'available',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  email text,
  role staff_role not null default 'staff',
  status staff_status not null default 'active',
  avatar_path text,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index idx_shelves_room_id on shelves(room_id);
create index idx_books_publisher_id on books(publisher_id);
create index idx_books_category_id on books(category_id);
create index idx_books_archived_at on books(archived_at);
create index idx_books_item_type on books(item_type);
create index idx_books_isbn13 on books(isbn13);
create index idx_copies_book_status on copies(book_id, status);
create index idx_copies_shelf_id on copies(shelf_id);
create index idx_book_authors_author_id on book_authors(author_id);
