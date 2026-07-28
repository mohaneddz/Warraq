-- Warraq Supabase schema — part 2: members, circulation, reservations, and supporting tables.
create type reservation_scope as enum ('internal','external');
create type reservation_status as enum ('pending','queued','ready','fulfilled','cancelled','declined','expired');
create type fine_status as enum ('open','paid','waived');
create type inventory_session_status as enum ('active','paused','completed','cancelled');
create type inventory_scan_result as enum ('found','misplaced','unknown');

create table members (
  id uuid primary key default gen_random_uuid(),
  member_number text not null unique,
  full_name text not null,
  email text,
  phone text,
  department text,
  role member_role not null default 'visitor',
  address text,
  joined_at timestamptz not null default now(),
  expiry_date date,
  status member_status not null default 'active',
  reservation_banned boolean not null default false,
  ban_reason text,
  banned_at timestamptz,
  banned_by uuid references profiles(id),
  notes text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table loans (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references copies(id),
  member_id uuid not null references members(id),
  scope reservation_scope not null default 'external',
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  renewed_count integer not null default 0,
  issued_by uuid references profiles(id),
  received_by uuid references profiles(id),
  condition_out text,
  condition_in text,
  notes text
);
create unique index one_open_loan_per_copy on loans(copy_id) where returned_at is null;
create index idx_loans_member_open on loans(member_id) where returned_at is null;
create index idx_loans_member_id on loans(member_id);
create index idx_loans_copy_id on loans(copy_id);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id),
  member_id uuid not null references members(id),
  copy_id uuid references copies(id),
  scope reservation_scope not null default 'internal',
  status reservation_status not null default 'pending',
  position integer not null default 0,
  requested_at timestamptz not null default now(),
  reserved_at timestamptz,
  expires_at timestamptz,
  fulfilled_at timestamptz,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_reason text
);
create index idx_reservations_member_id on reservations(member_id);
create index idx_reservations_book_id on reservations(book_id);
create index idx_reservations_status on reservations(status);

create table fines (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id),
  member_id uuid not null references members(id),
  amount numeric not null,
  reason text not null,
  status fine_status not null default 'open',
  waived_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_fines_member_id on fines(member_id);
create index idx_fines_loan_id on fines(loan_id);
create index idx_fines_status on fines(status);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text
);

create table book_tags (
  book_id uuid not null references books(id) on delete cascade,
  tag_id uuid not null references tags(id),
  primary key (book_id, tag_id)
);
create index idx_book_tags_tag_id on book_tags(tag_id);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  label text not null,
  local_path text not null,
  mime_type text,
  size integer,
  created_at timestamptz not null default now()
);
create index idx_attachments_book_id on attachments(book_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_created_at on audit_logs(created_at);

create table saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  query_json jsonb not null,
  created_at timestamptz not null default now()
);

create table inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  shelf_id uuid references shelves(id),
  status inventory_session_status not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references profiles(id)
);

create table inventory_scans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references inventory_sessions(id) on delete cascade,
  copy_id uuid references copies(id),
  scanned_barcode text not null,
  result inventory_scan_result not null,
  scanned_at timestamptz not null default now()
);
create index idx_inventory_scans_session_id on inventory_scans(session_id);
create index idx_inventory_scans_copy_id on inventory_scans(copy_id);

create index idx_members_status on members(status);
create index idx_members_archived_at on members(archived_at);
create index idx_members_role on members(role);
