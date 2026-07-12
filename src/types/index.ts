export type CopyStatus = "available" | "on-loan" | "reserved" | "repair" | "lost" | "archived";
export type MemberStatus = "active" | "suspended" | "expired" | "archived";

export interface Book { id: string; title: string; subtitle?: string | null; isbn13?: string | null; isbn10?: string | null; description?: string | null; language: string; publication_year?: number | null; publisher?: string | null; category?: string | null; call_number?: string | null; author?: string | null; created_at: string; archived_at?: string | null; }
export interface Copy { id: string; book_id: string; accession_number: string; barcode: string; status: CopyStatus; shelf?: string | null; condition: string; }
export interface Member { id: string; member_number: string; full_name: string; email?: string | null; phone?: string | null; department?: string | null; role?: string | null; status: MemberStatus; expiry_date?: string | null; joined_at: string; }
export interface Loan { id: string; copy_id: string; member_id: string; borrowed_at: string; due_at: string; returned_at?: string | null; renewed_count: number; title?: string; barcode?: string; member_name?: string; }
export interface Reservation { id: string; book_id: string; member_id: string; status: "queued" | "ready" | "fulfilled" | "cancelled" | "expired"; position: number; reserved_at: string; expires_at?: string | null; title?: string; member_name?: string; }
export interface DashboardMetrics { titles: number; copies: number; onLoan: number; members: number; overdue: number; readyReservations: number; recentLoans: Loan[]; overdueLoans: Loan[]; activity: { date: string; count: number }[]; }
export interface Preferences { onboardingComplete: boolean; libraryName: string; operatorName: string; locale: "en" | "fr" | "ar"; theme: "light" | "dark" | "system"; loanDays: number; loanLimit: number; finesEnabled: boolean; closeToTray: boolean; }
