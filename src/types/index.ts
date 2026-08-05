export type CopyStatus = "available" | "on-loan" | "reserved" | "repair" | "lost" | "archived";
export type MemberStatus = "active" | "suspended" | "expired" | "archived";
export type ItemType = "book" | "fyp" | "journal" | "other";
export type MemberRole = "visitor" | "student" | "staff" | "medic" | "other";
export type ReservationScope = "internal" | "external";
export type ReservationStatus = "pending" | "queued" | "ready" | "fulfilled" | "cancelled" | "declined" | "expired";
export type ShelfType = "floor" | "top";
/** The floor shelf's distinguishing glyph — bigger than a lettered shelf, one per room. */
export const FLOOR_SHELF_CODE = "⬤";
export const TOP_SHELF_CODES = ["A", "B", "C", "D", "E", "F"] as const;
/** Generates the lettered row codes (A, B, C…) for a bookcase column, sized to the library's configured row count. */
export function shelfRowCodes(count: number): string[] {
  const n = Math.max(1, Math.min(20, count || TOP_SHELF_CODES.length));
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
}

export type UserRole = "admin" | "staff";
export type UserStatus = "active" | "disabled";

export interface PublicUser {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  role: UserRole;
  status: UserStatus;
  avatar_path?: string | null;
  must_change_password: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface Book {
  id: string; title: string; item_type?: ItemType | string; subtitle?: string | null; arabic_title?: string | null;
  tags?: string | null; isbn13?: string | null; isbn10?: string | null; description?: string | null; language: string;
  publication_year?: number | null; publisher?: string | null; category?: string | null; call_number?: string | null;
  dewey_code?: string | null; author?: string | null; cover_path?: string | null; cover_url?: string | null;
  created_at: string; archived_at?: string | null; total_copies?: number; available_copies?: number; metadata?: string | null;
}
export interface Copy {
  id: string; book_id: string; accession_number: string; barcode: string; status: CopyStatus; shelf?: string | null;
  condition: string; title?: string; item_type?: string; metadata?: string | null; cover_path?: string | null; author?: string | null;
  column_number?: number | null; room?: string | null;
}
export interface Member {
  id: string; member_number: string; full_name: string; email?: string | null; phone?: string | null; department?: string | null;
  role?: MemberRole | string | null; status: MemberStatus; expiry_date?: string | null; avatar_path?: string | null; joined_at: string;
  reservation_banned?: boolean; ban_reason?: string | null; banned_at?: string | null;
}
export interface Loan {
  id: string; copy_id: string; member_id: string; scope?: ReservationScope; borrowed_at: string; due_at: string;
  returned_at?: string | null; renewed_count: number; title?: string; item_type?: string; barcode?: string; member_name?: string;
}
export interface Reservation {
  id: string;
  book_id: string;
  member_id: string;
  copy_id?: string | null;
  scope: ReservationScope;
  status: ReservationStatus;
  position: number;
  requested_at: string;
  reserved_at?: string | null;
  expires_at?: string | null;
  fulfilled_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_reason?: string | null;
  title?: string;
  subtitle?: string | null;
  arabic_title?: string | null;
  author?: string | null;
  category?: string | null;
  publisher?: string | null;
  item_type?: string | null;
  cover_path?: string | null;
  isbn13?: string | null;
  call_number?: string | null;
  member_name?: string;
  member_number?: string | null;
  member_email?: string | null;
  member_phone?: string | null;
  member_dept?: string | null;
  member_role?: string | null;
  member_avatar?: string | null;
  member_banned?: boolean;
  copy_barcode?: string | null;
  copy_accession?: string | null;
  copy_shelf?: string | null;
  copy_condition?: string | null;
}
export interface Room { id: string; name: string; notes?: string | null; }
export interface Column { id: string; room_id: string; number: number; }
export interface Shelf {
  id: string; column_id: string; room_id?: string; room?: string; column_number?: number;
  shelf_type: ShelfType; code: string; capacity: number;
  notes?: string | null; copy_count?: number;
}
export interface DashboardMetrics {
  titles: number; copies: number; onLoan: number; members: number; overdue: number; readyReservations: number;
  recentLoans: Loan[]; overdueLoans: Loan[]; activity: { date: string; count: number }[];
  activeDepartments?: { name: string; count: number }[]; circulationRhythm?: { time: string; checkouts: number; returns: number }[];
}

export interface AppNotification {
  id: string;
  type: "reservation_ready" | "system";
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Library-wide circulation rules and institutional profile — shared across every device
 * (desktop app now, the future public website later), stored in the Postgres
 * `library_settings` singleton row instead of per-device local prefs.
 */
export interface LibrarySettings {
  library_name: string;
  library_short_name: string;
  library_address: string;
  library_city: string;
  library_phone: string;
  library_email: string;
  library_website: string;
  library_hours: string;
  library_description: string;
  timezone: string;
  date_format: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  currency: string;
  loan_days: number;
  loan_limit: number;
  renew_limit: number;
  reservation_hold_days: number;
  reservation_external_days: number;
  reservation_internal_days: number;
  self_renewal_allowed: boolean;
  grace_period_enabled: boolean;
  grace_period_days: number;
  notify_overdue: boolean;
  notify_due_soon: boolean;
  notify_due_soon_days: number;
  notify_ready: boolean;
  shelf_row_count: number;
  updated_at: string;
}

/** Per-device UI preferences only — everything shared across staff now lives in LibrarySettings. */
export interface Preferences {
  onboardingComplete: boolean;
  locale: "en" | "fr" | "ar";
  theme: "light" | "dark" | "system";
  accentColor: string;
  fontSize: "small" | "medium" | "large";
  googleBooksEnabled: boolean;
  openLibraryEnabled: boolean;
  openAIEnabled: boolean;
  groqEnabled: boolean;
  openAIKey: string;
  groqApiKey: string;
  closeToTray: boolean;
  launchOnBoot: boolean;
  autosaveEnabled: boolean;
  autosaveInterval: number;
  pageSize: number;
  titlePreference: "original" | "arabic";
}
