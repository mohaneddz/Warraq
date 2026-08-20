import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, UserCheck, UserPlus, BookOpen, Calendar, CheckCircle2, ChevronRight,
  Layers, Tag, MapPin, Hash, Globe, Building2
} from "lucide-react";

import {
  members, books, getCopiesForBook, saveMember,
  addReservation, acceptReservation, updateReservation,
  checkout, updateLoanDueDate
} from "../data/repositories/library";
import { useLibrarySettingsStore } from "../store/librarySettingsStore";
import { queryClient } from "../app/providers";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDisplayDate } from "../utils/dates";
import { Modal, Input, Button, ItemTypeBadge, StatusBadge } from "./ui/primitives";
import type { Book, Member, Copy, ReservationScope } from "../types";

const invalidate = () => queryClient.invalidateQueries();

export type CirculationKind = "reservation" | "loan";

interface NewCirculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "reservation" places a hold for later pickup; "loan" checks the copy out right now. */
  kind: CirculationKind;
}

/**
 * Shared create-wizard for both circulation flows. Placing a hold and lending at the desk ask
 * the operator for exactly the same things in the same order (member or walk-in visitor, title,
 * physical copy, then scope and a date), so both screens drive this one component instead of
 * maintaining two near-identical 900-line wizards that would inevitably drift apart.
 *
 * Only the final step and the submit differ: a reservation records a hold with an expiry date,
 * a loan checks the copy out immediately with a due date.
 */
export function NewCirculationModal({ isOpen, onClose, kind }: NewCirculationModalProps) {
  const { t } = useTranslation();
  const isLoan = kind === "loan";
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Member / Visitor state & filters
  const [mode, setMode] = useState<"registered" | "visitor">("registered");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorDept, setVisitorDept] = useState("");

  // Step 2: Book / Item state & filters
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookSearch, setBookSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "out_of_stock">("all");

  // Step 3: Physical Copy state
  const [selectedCopy, setSelectedCopy] = useState<Copy | null>(null);

  // Step 4: Scope (internal = in-library only, external = take home) and the date field,
  // which is a hold expiry for reservations and a due date for loans.
  const [scope, setScope] = useState<ReservationScope>(isLoan ? "external" : "internal");
  const settings = useLibrarySettingsStore(s => s.settings);
  const holdDays = settings.reservation_hold_days;
  // A loan's length follows the same scope-driven rule checkout() applies server-side, so the
  // date shown here is what the database would have derived on its own.
  const defaultTargetDate = useMemo(() => {
    const days = isLoan
      ? (scope === "internal" ? (settings.reservation_internal_days ?? 1) : (settings.loan_days ?? 14))
      : holdDays;
    const d = new Date();
    d.setDate(d.getDate() + (days ?? 7));
    return d.toISOString().slice(0, 10);
  }, [isLoan, scope, settings.reservation_internal_days, settings.loan_days, holdDays]);
  const [targetDate, setTargetDate] = useState(defaultTargetDate);
  useEffect(() => {
    if (isOpen) setTargetDate(defaultTargetDate);
  }, [isOpen, defaultTargetDate]);
  const isVisitor = mode === "visitor";
  const isSingleCopyBook = (selectedBook?.total_copies ?? 0) <= 1;
  const externalBlocked = isVisitor || isSingleCopyBook;
  const externalBlockedReason = isVisitor
    ? (isLoan
        ? (t("loans.addModal.visitorsInternalOnly", "Visitors can only use items inside the library.") as string)
        : (t("reservations.addModal.visitorsInternalOnly", "Visitors can only reserve items for internal use.") as string))
    : (isLoan
        ? (t("loans.addModal.singleCopyInternalOnly", "This title has only one copy and can only be used inside the library.") as string)
        : (t("reservations.addModal.singleCopyInternalOnly", "This title has only one copy and can only be reserved for internal use.") as string));

  const scopeLabel = isLoan
    ? (t("loans.addModal.scopeLabel", "Loan Scope") as string)
    : (t("reservations.addModal.scopeLabel", "Reservation Scope") as string);
  const dateLabel = isLoan
    ? (t("loans.addModal.dueLabel", "Due On") as string)
    : (t("reservations.addModal.expiryLabel", "Hold Expires On") as string);

  // Queries
  const membersQuery = useQuery({
    queryKey: ["members", memberSearch],
    queryFn: () => members(memberSearch),
    enabled: isOpen && mode === "registered"
  });

  const booksQuery = useQuery({
    queryKey: ["books", bookSearch],
    queryFn: () => books(bookSearch),
    enabled: isOpen && step === 2
  });

  const copiesQuery = useQuery({
    queryKey: ["copies", selectedBook?.id],
    queryFn: () => (selectedBook?.id ? getCopiesForBook(selectedBook.id) : Promise.resolve([])),
    enabled: isOpen && step === 3 && !!selectedBook?.id
  });

  // Extract unique departments & roles for filtering
  const departmentOptions = useMemo(() => {
    if (!membersQuery.data) return [];
    const depts = new Set<string>();
    membersQuery.data.forEach(m => {
      if (m.department?.trim()) depts.add(m.department.trim());
    });
    return Array.from(depts);
  }, [membersQuery.data]);

  const roleOptions = useMemo(() => {
    if (!membersQuery.data) return [];
    const roles = new Set<string>();
    membersQuery.data.forEach(m => {
      if (m.role?.trim()) roles.add(m.role.trim());
    });
    return Array.from(roles);
  }, [membersQuery.data]);

  // Extract unique categories & item types for book filtering
  const categoryOptions = useMemo(() => {
    if (!booksQuery.data) return [];
    const cats = new Set<string>();
    booksQuery.data.forEach(b => {
      if (b.category?.trim()) cats.add(b.category.trim());
    });
    return Array.from(cats);
  }, [booksQuery.data]);

  const itemTypeOptions = useMemo(() => {
    if (!booksQuery.data) return [];
    const types = new Set<string>();
    booksQuery.data.forEach(b => {
      if (b.item_type?.trim()) types.add(b.item_type.trim());
    });
    return Array.from(types);
  }, [booksQuery.data]);

  // Filtered members list
  const filteredMembersList = useMemo(() => {
    if (!membersQuery.data) return [];
    return membersQuery.data.filter(m => {
      if (selectedDept !== "all" && m.department !== selectedDept) return false;
      if (selectedRole !== "all" && m.role !== selectedRole) return false;
      return true;
    });
  }, [membersQuery.data, selectedDept, selectedRole]);

  // Filtered books list
  const filteredBooksList = useMemo(() => {
    if (!booksQuery.data) return [];
    return booksQuery.data.filter(b => {
      if (selectedCategory !== "all" && b.category !== selectedCategory) return false;
      if (selectedItemType !== "all" && b.item_type !== selectedItemType) return false;
      const avail = b.available_copies ?? 0;
      if (availabilityFilter === "available" && avail <= 0) return false;
      if (availabilityFilter === "out_of_stock" && avail > 0) return false;
      return true;
    });
  }, [booksQuery.data, selectedCategory, selectedItemType, availabilityFilter]);

  // Visitors and single-copy titles can only be reserved internally — force the scope
  // back to internal whenever either condition becomes true (mirrors the server-side
  // enforce_reservation_rules() trigger, which is the actual authority on this rule).
  useEffect(() => {
    if (externalBlocked && scope === "external") setScope("internal");
  }, [externalBlocked, scope]);

  // Create Reservation Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      let targetMemberId = selectedMember?.id;
      let targetMemberName = selectedMember?.full_name || visitorName;

      // Handle visitor creation if visitor mode is active
      if (mode === "visitor") {
        if (!visitorName.trim()) {
          throw new Error(t("reservations.alerts.fillVisitorName") || "Please enter the visitor's full name.");
        }
        const visitorNumber = `VIS-${Math.floor(100000 + Math.random() * 900000)}`;
        const newVisitor = await saveMember({
          full_name: visitorName.trim(),
          email: visitorEmail.trim() || null,
          phone: visitorPhone.trim() || null,
          department: visitorDept.trim() || "Visitor",
          role: "visitor",
          status: "active",
          member_number: visitorNumber
        });
        targetMemberId = newVisitor.id;
      }

      if (!targetMemberId) {
        throw new Error(t("reservations.alerts.selectMember") || "Please select a member or fill visitor details.");
      }
      if (!selectedBook?.id) {
        throw new Error(t("reservations.alerts.selectItem") || "Please select an item to reserve.");
      }

      const iso = targetDate ? new Date(`${targetDate}T23:59:59`).toISOString() : null;

      if (isLoan) {
        if (!selectedCopy?.id) {
          throw new Error(t("loans.alerts.selectCopy", "Please select which physical copy is being lent.") as string);
        }
        const [created] = await checkout(targetMemberId, [selectedCopy.id], settings.loan_limit ?? 5, scope);
        // checkout() already derived due_at from the scope; only overwrite it when the operator
        // actually chose a different day, so the untouched path keeps the database's own rule.
        if (iso && created && iso.slice(0, 10) !== created.due_at.slice(0, 10)) {
          await updateLoanDueDate(created.id, iso);
        }
        return targetMemberName;
      }

      const reservationId = await addReservation(selectedBook.id, targetMemberId, scope);
      // Reservations created from this interface are accepted immediately by default
      // (the pending/decline workflow only applies to requests made elsewhere, e.g. by members themselves).
      await acceptReservation(reservationId);
      await updateReservation(reservationId, { expiresAt: iso });
      return targetMemberName;
    },
    onSuccess: (memberName) => {
      invalidate();
      toast.success(
        isLoan
          ? (t("loans.alerts.loanCreated", { name: memberName, defaultValue: `Item lent to ${memberName}.` }) as string)
          : (t("reservations.alerts.reservationCreated", { name: memberName }) || `Reservation created for ${memberName}.`)
      );
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.message || (isLoan
        ? (t("loans.alerts.checkoutFailed", "Checkout failed.") as string)
        : "Failed to create reservation."));
    }
  });

  const handleClose = () => {
    setStep(1);
    setMode("registered");
    setSelectedMember(null);
    setMemberSearch("");
    setSelectedDept("all");
    setSelectedRole("all");
    setVisitorName("");
    setVisitorEmail("");
    setVisitorPhone("");
    setVisitorDept("");
    setSelectedBook(null);
    setSelectedCopy(null);
    setBookSearch("");
    setSelectedCategory("all");
    setSelectedItemType("all");
    setAvailabilityFilter("all");
    setScope(isLoan ? "external" : "internal");
    setTargetDate(defaultTargetDate);
    onClose();
  };

  const isStep1Valid = mode === "registered" ? !!selectedMember : visitorName.trim().length > 0;
  const isStep2Valid = !!selectedBook;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isLoan
        ? (t("loans.addModal.title", "New Loan") as string)
        : (t("reservations.addModal.title") || "New Reservation")}
      size="xl"
      className="h-[84vh] min-h-[min(580px,88vh)] max-h-[min(820px,88vh)]"
    >
      {/* Stepper Header (Fixed at top of modal body) */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3 mb-4 text-[12px] font-bold shrink-0">
        <div className={`flex items-center gap-2 ${step === 1 ? "text-emerald dark:text-emerald-light font-extrabold" : "text-[#122222]/40 dark:text-white/40"}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${step === 1 ? "bg-emerald text-white shadow-sm" : "bg-black/10 dark:bg-white/10"}`}>1</span>
          <span className="text-[13px]">{t("reservations.addModal.stepMember") || "1. Member / Visitor"}</span>
        </div>
        <ChevronRight size={16} className="text-[#122222]/30 dark:text-white/30" />
        <div className={`flex items-center gap-2 ${step === 2 ? "text-emerald dark:text-emerald-light font-extrabold" : "text-[#122222]/40 dark:text-white/40"}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${step === 2 ? "bg-emerald text-white shadow-sm" : "bg-black/10 dark:bg-white/10"}`}>2</span>
          <span className="text-[13px]">{t("reservations.addModal.stepItem") || "2. Select Item"}</span>
        </div>
        <ChevronRight size={16} className="text-[#122222]/30 dark:text-white/30" />
        <div className={`flex items-center gap-2 ${step === 3 ? "text-emerald dark:text-emerald-light font-extrabold" : "text-[#122222]/40 dark:text-white/40"}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${step === 3 ? "bg-emerald text-white shadow-sm" : "bg-black/10 dark:bg-white/10"}`}>3</span>
          <span className="text-[13px]">{t("reservations.addModal.stepCopy") || "3. Select Copy & Location"}</span>
        </div>
        <ChevronRight size={16} className="text-[#122222]/30 dark:text-white/30" />
        <div className={`flex items-center gap-2 ${step === 4 ? "text-emerald dark:text-emerald-light font-extrabold" : "text-[#122222]/40 dark:text-white/40"}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${step === 4 ? "bg-emerald text-white shadow-sm" : "bg-black/10 dark:bg-white/10"}`}>4</span>
          <span className="text-[13px]">{t("reservations.addModal.stepDuration") || "4. Duration & Review"}</span>
        </div>
      </div>

      {/* Step 1: Member or Visitor */}
      {step === 1 && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl text-[13px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setMode("registered")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === "registered" 
                    ? "bg-white dark:bg-[#1d2926] text-emerald dark:text-emerald-light shadow-sm font-bold" 
                    : "text-[#122222]/60 dark:text-white/60 hover:text-[#122222] dark:hover:text-white"
                }`}
              >
                <UserCheck size={18} />
                {t("reservations.addModal.tabRegistered") || "Registered Member"}
              </button>
              <button
                type="button"
                onClick={() => setMode("visitor")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === "visitor" 
                    ? "bg-white dark:bg-[#1d2926] text-emerald dark:text-emerald-light shadow-sm font-bold" 
                    : "text-[#122222]/60 dark:text-white/60 hover:text-[#122222] dark:hover:text-white"
                }`}
              >
                <UserPlus size={18} />
                {t("reservations.addModal.tabVisitor") || "Visitor / Guest"}
              </button>
            </div>

            {/* Registered Member Tab Content */}
            {mode === "registered" ? (
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                {/* Search & Filters Toolbar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
                  <div className="md:col-span-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
                    <Input
                      type="text"
                      placeholder={t("reservations.addModal.searchMemberPlaceholder") || "Search member by name, ID, email..."}
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Department Filter */}
                  <div>
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                    >
                      <option value="all">{t("reservations.addModal.filterDept") || "All Departments"}</option>
                      {departmentOptions.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role Filter */}
                  <div>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                    >
                      <option value="all">{t("reservations.addModal.filterRole") || "All Roles"}</option>
                      {roleOptions.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Members Scrollable Grid / List */}
                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-xl bg-white dark:bg-[#1d2926]">
                  {membersQuery.isLoading ? (
                    <div className="p-6 text-center text-xs text-[#122222]/50 dark:text-white/50">Loading members...</div>
                  ) : filteredMembersList.length > 0 ? (
                    filteredMembersList.map((mem) => {
                      const isSelected = selectedMember?.id === mem.id;
                      return (
                        <div
                          key={mem.id}
                          onClick={() => setSelectedMember(mem)}
                          className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected ? "bg-emerald/10 dark:bg-emerald/20 border-l-4 border-emerald" : "hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {mem.avatar_path ? (
                              <img src={mem.avatar_path} alt="" className="w-9 h-9 rounded-full object-cover shadow-sm shrink-0 border border-black/10 dark:border-white/10" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-emerald/10 dark:bg-emerald-light/10 text-emerald dark:text-emerald-light font-bold text-[13px] flex items-center justify-center shrink-0">
                                {mem.full_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-bold text-[#122222] dark:text-white flex items-center gap-2 min-w-0">
                                <span className="truncate">{mem.full_name}</span>
                                <span className="text-[11px] font-mono font-medium text-[#122222]/50 dark:text-white/50 shrink-0">({mem.member_number})</span>
                              </div>
                              <div className="text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-2 mt-0.5 min-w-0">
                                <span className="shrink-0">{mem.department || "General"}</span>
                                <span className="shrink-0">•</span>
                                <span className="shrink-0">{mem.role || "Member"}</span>
                                {mem.email && (
                                  <>
                                    <span className="shrink-0">•</span>
                                    <span className="opacity-80 truncate">{mem.email}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="flex items-center gap-1.5 text-emerald dark:text-emerald-light font-bold text-[12px] shrink-0">
                              <CheckCircle2 size={18} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-xs text-[#122222]/50 dark:text-white/50">
                      {t("reservations.addModal.noMembersFound") || "No members found matching your search or filters."}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Visitor / Guest Form Content */
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 bg-[#fcfbf8] dark:bg-[#111d1a] p-4 rounded-2xl border border-black/5 dark:border-white/5">
                <div className="p-2.5 rounded-xl bg-emerald/10 text-emerald dark:text-emerald-light text-[12px] font-semibold flex items-center gap-2">
                  <UserPlus size={16} />
                  {t("reservations.addModal.visitorNotice") || "A guest/visitor profile will be automatically linked for this reservation."}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#122222]/80 dark:text-white/80 block mb-1">
                    {t("reservations.addModal.visitorName") || "Visitor Full Name"} *
                  </label>
                  <Input
                    type="text"
                    placeholder={t("reservations.addModal.visitorNamePlaceholder") || "e.g. John Doe (Visitor)"}
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#122222]/80 dark:text-white/80 block mb-1">
                      {t("reservations.addModal.visitorEmail") || "Email (Optional)"}
                    </label>
                    <Input
                      type="email"
                      placeholder="visitor@example.com"
                      value={visitorEmail}
                      onChange={(e) => setVisitorEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#122222]/80 dark:text-white/80 block mb-1">
                      {t("reservations.addModal.visitorPhone") || "Phone (Optional)"}
                    </label>
                    <Input
                      type="tel"
                      placeholder="0550123456"
                      value={visitorPhone}
                      onChange={(e) => setVisitorPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#122222]/80 dark:text-white/80 block mb-1">
                    {t("reservations.addModal.visitorDept") || "Department / Organization"}
                  </label>
                  <Input
                    type="text"
                    placeholder="Visitor / Guest / External"
                    value={visitorDept}
                    onChange={(e) => setVisitorDept(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer Buttons Bar */}
          <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-end shrink-0">
            <Button
              type="button"
              disabled={!isStep1Valid}
              onClick={() => setStep(2)}
            >
              {t("reservations.addModal.nextItem") || "Next: Select Item"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Book / Item Selection */}
      {step === 2 && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Search & Filtering Options Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
              <div className="md:col-span-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
                <Input
                  type="text"
                  placeholder={t("reservations.addModal.searchItemPlaceholder") || "Search book title, author, ISBN..."}
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                >
                  <option value="all">{t("reservations.addModal.filterCategory") || "All Categories"}</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Item Type Filter */}
              <div>
                <select
                  value={selectedItemType}
                  onChange={(e) => setSelectedItemType(e.target.value)}
                  className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                >
                  <option value="all">{t("reservations.addModal.filterType") || "All Item Types"}</option>
                  {itemTypeOptions.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Availability Filter */}
              <div>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                  className="w-full bg-white dark:bg-[#1d2926] border border-black/15 dark:border-white/15 rounded-control py-2 px-3 text-sm text-[#122222] dark:text-white outline-none focus:border-emerald font-semibold cursor-pointer"
                >
                  <option value="all">{t("reservations.addModal.filterAvailability") || "All Availability"}</option>
                  <option value="available">{t("reservations.addModal.availableOnly") || "Available Only"}</option>
                  <option value="out_of_stock">{t("reservations.addModal.outOfStockOnly") || "Out of Stock Only"}</option>
                </select>
              </div>
            </div>

            {/* Book Selection List (Vertically limited with scrolling) */}
            <div className="flex-1 min-h-0 flex flex-col">
              <label className="text-[11px] font-bold text-[#122222]/70 dark:text-white/70 block mb-1 uppercase tracking-wider shrink-0">
                Select Book Title / Item
              </label>
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-xl bg-white dark:bg-[#1d2926]">
                {booksQuery.isLoading ? (
                  <div className="p-6 text-center text-xs text-[#122222]/50 dark:text-white/50">Loading catalog items...</div>
                ) : filteredBooksList.length > 0 ? (
                  filteredBooksList.map((bk) => {
                    const isSelected = selectedBook?.id === bk.id;
                    const availableCount = bk.available_copies ?? 0;
                    const totalCount = bk.total_copies ?? 0;
                    return (
                      <div
                        key={bk.id}
                        onClick={() => {
                          setSelectedBook(bk);
                          setSelectedCopy(null);
                        }}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? "bg-emerald/10 dark:bg-emerald/20 border-l-4 border-emerald" : "hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {bk.cover_path ? (
                            <img src={bk.cover_path} alt="" className="w-9 h-12 object-cover rounded shadow-sm shrink-0" />
                          ) : (
                            <div className="w-9 h-12 bg-black/5 dark:bg-white/5 rounded flex items-center justify-center text-[#122222]/40 dark:text-white/40 shrink-0">
                              <BookOpen size={18} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-bold text-[#122222] dark:text-white line-clamp-2 leading-snug" title={bk.title}>
                              {bk.title}
                            </div>
                            <div className="text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-2 mt-0.5 min-w-0">
                              <span className="truncate">{bk.author || "Unknown Author"}</span>
                              <span className="shrink-0"><ItemTypeBadge type={bk.item_type} /></span>
                              {bk.category && (
                                <span className="text-[10px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded font-medium shrink-0 truncate">
                                  {bk.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                            availableCount > 0
                              ? "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light"
                              : "bg-copper/10 text-copper"
                          }`}>
                            {availableCount > 0
                              ? t("reservations.addModal.availableCopies", { available: availableCount, total: totalCount }) || `${availableCount}/${totalCount} available`
                              : t("reservations.addModal.outOfStock", { total: totalCount }) || `Out of stock (${totalCount})`}
                          </span>
                          {isSelected && (
                            <CheckCircle2 size={18} className="text-emerald dark:text-emerald-light shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-xs text-[#122222]/50 dark:text-white/50">
                    {t("reservations.addModal.noItemsFound") || "No items found matching your search or filters."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons Bar */}
          <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
            >
              {t("reservations.addModal.back") || "Back"}
            </Button>
            <Button
              type="button"
              disabled={!isStep2Valid}
              onClick={() => setStep(3)}
            >
              {t("reservations.addModal.nextCopy") || "Next: Select Copy & Location"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Physical Copy & Location Selection */}
      {step === 3 && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Selected Book Summary Header Banner */}
            {selectedBook && (
              <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-2xl p-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {selectedBook.cover_path ? (
                    <img src={selectedBook.cover_path} alt="" className="w-9 h-12 object-cover rounded shadow-sm" />
                  ) : (
                    <div className="w-9 h-12 bg-black/5 dark:bg-white/5 rounded flex items-center justify-center text-[#122222]/40 dark:text-white/40">
                      <BookOpen size={18} />
                    </div>
                  )}
                  <div>
                    <div className="text-[13px] font-bold text-[#122222] dark:text-white">
                      {selectedBook.title}
                    </div>
                    <div className="text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-2 mt-0.5">
                      <span>{selectedBook.author || "Unknown Author"}</span>
                      <ItemTypeBadge type={selectedBook.item_type} />
                      {selectedBook.category && (
                        <span className="text-[10px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded font-medium">
                          {selectedBook.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[#122222]/60 dark:text-white/60 block font-medium">
                    {copiesQuery.data?.length ?? 0} physical copy/copies total
                  </span>
                  <span className="text-[11px] font-bold text-emerald dark:text-emerald-light">
                    {selectedBook.available_copies ?? 0} available right now
                  </span>
                </div>
              </div>
            )}

            {/* Copies Selection List Container */}
            <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
              <label className="text-[11px] font-bold text-[#122222]/70 dark:text-white/70 block uppercase tracking-wider shrink-0 flex items-center gap-2">
                <Layers size={15} className="text-emerald" />
                {t("reservations.addModal.selectCopy") || "Select Physical Copy & Shelf Location"}
              </label>

              {/* Default Option: Any Available Copy. Reservations only: a loan has to name the
                  exact copy leaving the desk, and checkout() takes a single copy id. */}
              {!isLoan && (
              <div
                onClick={() => setSelectedCopy(null)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all shrink-0 ${
                  selectedCopy === null 
                    ? "bg-white dark:bg-[#1d2926] border-emerald ring-2 ring-emerald/20 shadow-sm font-bold" 
                    : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 bg-white/60 dark:bg-[#1d2926]/60 opacity-90"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Tag size={16} className="text-emerald" />
                  <div>
                    <div className="text-[13px] font-bold text-[#122222] dark:text-white">
                      {t("reservations.addModal.anyAvailableCopy") || "Any Available Copy (Auto-assign upon return)"}
                    </div>
                    <div className="text-[11px] text-[#122222]/60 dark:text-white/60 font-normal">
                      {t("reservations.addModal.anyAvailableDesc") || "Recommended if any available physical copy can be assigned when pickup occurs."}
                    </div>
                  </div>
                </div>
                {selectedCopy === null && (
                  <CheckCircle2 size={18} className="text-emerald dark:text-emerald-light" />
                )}
              </div>
              )}

              {/* Specific Copies Grid / Scrollable List (Vertically limited) */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {copiesQuery.isLoading ? (
                  <div className="text-xs text-center py-6 text-[#122222]/50 dark:text-white/50">Loading physical copies & shelf locations...</div>
                ) : copiesQuery.data && copiesQuery.data.length > 0 ? (
                  copiesQuery.data.map((cp) => {
                    const isCopySelected = selectedCopy?.id === cp.id;
                    // checkout() refuses anything that isn't 'available', so in loan mode such a
                    // copy is greyed out rather than offered and then rejected at confirm time.
                    const lendable = !isLoan || cp.status === "available";
                    return (
                      <div
                        key={cp.id}
                        onClick={() => lendable && setSelectedCopy(cp)}
                        title={lendable ? undefined : (t("loans.addModal.copyUnavailable", "This copy is not available to lend.") as string)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-[12px] transition-all ${
                          !lendable
                            ? "opacity-40 cursor-not-allowed border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#1d2926]/80"
                            : isCopySelected
                            ? "bg-white dark:bg-[#1d2926] border-emerald ring-2 ring-emerald/20 shadow-md font-bold cursor-pointer"
                            : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 bg-white/80 dark:bg-[#1d2926]/80 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          {/* Prominent Location Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light font-extrabold text-[12px] shrink-0 max-w-[45%]">
                            <MapPin size={14} className="shrink-0" />
                            <span className="truncate">{cp.shelf ? `Shelf: ${cp.shelf}` : "Unassigned Shelf"}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-mono font-bold text-[#122222] dark:text-white flex items-center gap-2 text-[12px] min-w-0">
                              <Hash size={13} className="opacity-50 shrink-0" />
                              <span className="truncate">{cp.barcode}</span>
                            </div>
                            <div className="text-[11px] text-[#122222]/60 dark:text-white/60 flex items-center gap-3 mt-0.5 min-w-0">
                              <span className="truncate">Index: <strong className="font-mono font-semibold text-[#122222] dark:text-white">{cp.accession_number}</strong></span>
                              <span className="shrink-0">•</span>
                              <span className="shrink-0">Condition: <strong className="capitalize">{cp.condition || "good"}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge value={cp.status} />
                          {isCopySelected && (
                            <CheckCircle2 size={18} className="text-emerald dark:text-emerald-light" />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-center py-6 text-[#122222]/50 dark:text-white/50 italic">
                    {t("reservations.addModal.noCopiesFound") || "No physical copies recorded for this item."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons Bar */}
          <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(2)}
            >
              {t("reservations.addModal.back") || "Back"}
            </Button>
            <Button
              type="button"
              disabled={isLoan && !selectedCopy}
              title={isLoan && !selectedCopy ? (t("loans.addModal.pickCopyFirst", "Select which copy is being lent.") as string) : undefined}
              onClick={() => setStep(4)}
            >
              {t("reservations.addModal.nextDuration") || "Next: Duration & Review"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Scope & Review */}
      {step === 4 && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-y-auto pr-1">
            {/* Scope Selector */}
            <div className="shrink-0">
              <label className="text-[12px] font-bold text-[#122222] dark:text-white block mb-2">
                {scopeLabel}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScope("internal")}
                  className={`py-3 px-2 rounded-xl text-[13px] font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    scope === "internal"
                      ? "bg-emerald text-white border-emerald shadow-sm ring-2 ring-emerald/20"
                      : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[#122222] dark:text-white bg-white dark:bg-[#1d2926]"
                  }`}
                >
                  <Building2 size={16} className={scope === "internal" ? "text-white" : "text-emerald"} />
                  <span>{t("reservations.scope.internal", "Internal: stays in library")}</span>
                </button>
                <button
                  type="button"
                  disabled={externalBlocked}
                  title={externalBlocked ? externalBlockedReason : undefined}
                  onClick={() => !externalBlocked && setScope("external")}
                  className={`py-3 px-2 rounded-xl text-[13px] font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                    externalBlocked ? "opacity-40 cursor-not-allowed border-black/10 dark:border-white/10 bg-white dark:bg-[#1d2926]"
                      : scope === "external"
                      ? "bg-emerald text-white border-emerald shadow-sm ring-2 ring-emerald/20 cursor-pointer"
                      : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[#122222] dark:text-white bg-white dark:bg-[#1d2926] cursor-pointer"
                  }`}
                >
                  <Globe size={16} className={!externalBlocked && scope === "external" ? "text-white" : "text-emerald"} />
                  <span>{t("reservations.scope.external", "External: taken home")}</span>
                </button>
              </div>
              {externalBlocked && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">{externalBlockedReason}</p>
              )}
              <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-2">
                {isLoan
                  ? t("loans.addModal.scopeHint", "Internal items stay in the library, external items go home. The scope sets the default loan length.")
                  : t("reservations.addModal.approvalHint", "This reservation is accepted automatically. Loan duration is set automatically based on scope.")}
              </p>
            </div>

            {/* Hold expiry (reservation) or due date (loan) */}
            <div className="shrink-0">
              <label className="text-[12px] font-bold text-[#122222] dark:text-white block mb-2">
                {dateLabel}
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full"
              />
              <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-2">
                {isLoan
                  ? t("loans.addModal.dueHint", "Defaults from the library's loan period for this scope, but can be changed for this loan.")
                  : t("reservations.addModal.expiryHint", "Defaults from the library's hold-days setting, but can be changed for this reservation.")}
              </p>
            </div>

            {/* Summary Preview Card */}
            <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-3 shrink-0">
              <h4 className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider">
                {isLoan
                  ? (t("loans.addModal.summaryTitle", "Loan Details Summary") as string)
                  : (t("reservations.addModal.summaryTitle") || "Reservation Details Summary")}
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {t("reservations.addModal.summaryMember") || "Member / Visitor"}
                  </span>
                  <span className="font-bold text-[#122222] dark:text-white block">
                    {mode === "registered" ? selectedMember?.full_name : `${visitorName} (Visitor)`}
                  </span>
                  <span className="text-[11px] text-[#122222]/50 dark:text-white/50 block">
                    {mode === "registered" ? selectedMember?.member_number : visitorDept || "Guest"}
                  </span>
                </div>

                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {t("reservations.addModal.summaryItem") || "Book / Item"}
                  </span>
                  <span className="font-bold text-[#122222] dark:text-white line-clamp-2 leading-snug block" title={selectedBook?.title || ""}>
                    {selectedBook?.title}
                  </span>
                  <span className="text-[11px] text-[#122222]/50 dark:text-white/50 block">
                    {selectedBook?.author || "Author"}
                  </span>
                </div>

                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {t("reservations.addModal.copyBarcode") || "Physical Copy & Location"}
                  </span>
                  <span className="font-bold text-[#122222] dark:text-white block">
                    {selectedCopy ? selectedCopy.barcode : (isLoan ? "—" : "Auto-assigned")}
                  </span>
                  <span className="text-[11px] font-bold text-emerald dark:text-emerald-light block mt-0.5">
                    {selectedCopy?.shelf ? `Shelf: ${selectedCopy.shelf}` : (isLoan ? "—" : "Any available")}
                  </span>
                </div>

                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {scopeLabel}
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-0.5">
                    {scope === "external" ? <Globe size={14} className="opacity-80" /> : <Building2 size={14} className="opacity-80" />}
                    {scope === "external" ? t("reservations.scope.external", "External") : t("reservations.scope.internal", "Internal")}
                  </span>
                </div>

                <div>
                  <span className="text-[#122222]/60 dark:text-white/60 text-[11px] block mb-0.5">
                    {dateLabel}
                  </span>
                  <span className="font-bold text-[#122222] dark:text-white flex items-center gap-1.5 mt-0.5">
                    <Calendar size={14} className="opacity-80 text-emerald" />
                    {targetDate ? formatDisplayDate(new Date(`${targetDate}T23:59:59`).toISOString()) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer Buttons Bar */}
          <div className="pt-3 mt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(3)}
            >
              {t("reservations.addModal.back") || "Back"}
            </Button>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending
                ? (isLoan
                    ? (t("loans.addModal.submitting", "Lending...") as string)
                    : (t("reservations.addModal.submitting") || "Creating..."))
                : (isLoan
                    ? (t("loans.addModal.submit", "Lend Item") as string)
                    : (t("reservations.addModal.submit") || "Create Reservation"))}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
