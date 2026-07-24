export type CopyStatus = "available" | "on-loan" | "reserved" | "repair" | "lost" | "archived";
export type MemberStatus = "active" | "suspended" | "expired" | "archived";
export type ItemType = "book" | "magazine" | "notebook" | "journal" | "newspaper" | "disc" | "discs" | "other";

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


export interface Book { id: string; title: string; item_type?: ItemType | string; subtitle?: string | null; arabic_title?: string | null; tags?: string | null; isbn13?: string | null; isbn10?: string | null; description?: string | null; language: string; publication_year?: number | null; publisher?: string | null; category?: string | null; call_number?: string | null; author?: string | null; cover_path?: string | null; cover_url?: string | null; created_at: string; archived_at?: string | null; total_copies?: number; available_copies?: number; metadata?: string | null; }
export interface Copy { id: string; book_id: string; accession_number: string; barcode: string; status: CopyStatus; shelf?: string | null; condition: string; title?: string; item_type?: string; metadata?: string | null; cover_path?: string | null; author?: string | null; }
export interface Member { id: string; member_number: string; full_name: string; email?: string | null; phone?: string | null; department?: string | null; role?: string | null; status: MemberStatus; expiry_date?: string | null; avatar_path?: string | null; joined_at: string; }
export interface Loan { id: string; copy_id: string; member_id: string; borrowed_at: string; due_at: string; returned_at?: string | null; renewed_count: number; title?: string; item_type?: string; barcode?: string; member_name?: string; }
export interface Reservation { 
  id: string; 
  book_id: string; 
  member_id: string; 
  copy_id?: string | null; 
  status: "queued" | "ready" | "fulfilled" | "cancelled" | "expired"; 
  position: number; 
  reserved_at: string; 
  expires_at?: string | null; 
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
  copy_barcode?: string | null; 
  copy_accession?: string | null; 
  copy_shelf?: string | null; 
  copy_condition?: string | null;
}
export interface DashboardMetrics { titles: number; copies: number; onLoan: number; members: number; overdue: number; readyReservations: number; recentLoans: Loan[]; overdueLoans: Loan[]; activity: { date: string; count: number }[]; activeDepartments?: { name: string; count: number }[]; circulationRhythm?: { time: string; checkouts: number; returns: number }[]; }

export interface Preferences {
  // General / Identity
  onboardingComplete: boolean;
  libraryName: string;
  libraryShortName: string;
  // Library Profile
  libraryAddress: string;
  libraryCity: string;
  libraryPhone: string;
  libraryEmail: string;
  libraryWebsite: string;
  libraryDescription: string;
  libraryHours: string;
  // Localization
  locale: "en" | "fr" | "ar";
  timezone: string;
  dateFormat: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  currency: string;
  // Appearance
  theme: "light" | "dark" | "system";
  accentColor: string;
  fontSize: "small" | "medium" | "large";
  // Circulation Rules
  loanDays: number;
  loanLimit: number;
  renewLimit: number;
  reservationHoldDays: number;
  selfRenewalAllowed: boolean;
  gracePeriodEnabled: boolean;
  gracePeriodDays: number;
  // Fines & Fees
  finesEnabled: boolean;
  finePerDay: number;
  maxFineAmount: number;
  fineCurrency: string;
  finesPaymentMethod: "cash" | "card" | "both";
  // Notifications
  notifyOverdue: boolean;
  notifyDueSoon: boolean;
  notifyDueSoonDays: number;
  notifyReady: boolean;
  // Integrations
  googleBooksEnabled: boolean;
  openLibraryEnabled: boolean;
  openAIEnabled: boolean;
  groqEnabled: boolean;
  openAIKey: string;
  groqApiKey: string;
  // System
  closeToTray: boolean;
  launchOnBoot: boolean;
  autosaveEnabled: boolean;
  autosaveInterval: number;
  pageSize: number;
}
