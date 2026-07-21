import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Plus, Search, ChevronLeft, ChevronRight, X, 
  Trash2, IdCard, Phone, Edit2
} from "lucide-react";
import { 
  members, saveMember, updateMember, deleteMember, getLoansForMember, 
  getReservationsForMember, renewLoan, returnCopies, cancelReservation 
} from "../data/repositories/library";
import type { Member } from "../types";
import { Modal, Input, Button } from "../components/ui/primitives";
import { toast } from "sonner";
import { daysLate, formatDisplayDate } from "../utils/dates";
import { queryClient } from "../app/providers";
import { useUiStore } from "../store/uiStore";
import { ImageUpload } from "../components/ui/ImageUpload";
import { cleanPhone, cleanMemberNumber, cleanText } from "../utils/isbn";
import { useTranslation } from "react-i18next";

const invalidate = () => queryClient.invalidateQueries();

const memberSchema = z.object({
  full_name: z.string().min(2, "A full name is required"),
  member_number: z.string().min(3, "A membership number is required"),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  phone: z.string().optional(),
  role: z.string().min(2, "Role is required"),
  department: z.string().optional(),
  status: z.enum(["active", "suspended", "expired", "archived"]),
  avatar_path: z.string().nullable().optional()
});
type MemberValues = z.infer<typeof memberSchema>;

export function MembersPage() {
  const { t } = useTranslation();

  const [term, setTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);

  // Sorting & Filtering State
  const [sortBy, setSortBy] = useState<"name" | "number" | "joined">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [savedView, setSavedView] = useState("All Members");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [page, setPage] = useState(1);
  const itemsPerPage = useUiStore((state) => state.preferences.pageSize) || 10;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    if (action === "add-member") {
      setAdding(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const focus = params.get("focus");
    if (focus === "search") {
      setTimeout(() => {
        document.getElementById("members-page-search")?.focus();
      }, 100);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.search]);

  // Form input standardizer helper
  const registerClean = (form: any, name: any, cleaner: (val: string) => string) => {
    const reg = form.register(name);
    return {
      ...reg,
      onBlur: (e: any) => {
        form.setValue(name, cleaner(e.target.value));
        reg.onBlur(e);
      }
    };
  };

  // Queries
  const result = useQuery({ queryKey: ["members", term], queryFn: () => members(term) });

  const addForm = useForm<MemberValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { full_name: "", member_number: "", email: "", phone: "", role: "Staff", department: "", status: "active", avatar_path: null }
  });

  const addMutation = useMutation({
    mutationFn: async (values: MemberValues) => {
      // Validate unique member number locally before repository insert
      const exists = result.data?.some(m => m.member_number.toUpperCase() === values.member_number.toUpperCase());
      if (exists) throw new Error(t("members.alerts.exists") || "A member with this number already exists.");
      
      return saveMember({
        full_name: cleanText(values.full_name),
        member_number: cleanMemberNumber(values.member_number),
        email: values.email ? cleanText(values.email) : "",
        phone: values.phone ? cleanPhone(values.phone) : "",
        role: cleanText(values.role),
        department: values.department ? cleanText(values.department) : "",
        status: values.status,
        avatar_path: values.avatar_path || null
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("members.alerts.memberSaved") || "Member saved successfully.");
      addForm.reset();
      setAdding(false);
    },
    onError: (err: any) => toast.error(err.message)
  });

  const bulkArchiveMembersMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => deleteMember(id)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("members.alerts.bulkArchived") || "Selected members archived.");
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error(error?.message || t("members.alerts.bulkArchiveFailed") || "Failed to archive members.");
    }
  });

  const handleBulkArchiveMembers = () => {
    if (confirm(t("members.alerts.confirmBulkArchive", { count: selectedIds.length }) || `Are you sure you want to archive ${selectedIds.length} selected member(s)?`)) {
      bulkArchiveMembersMutation.mutate();
    }
  };

  // Extract departments list dynamically
  const departmentsList = useMemo(() => {
    if (!result.data) return [];
    const set = new Set(result.data.map(m => m.department).filter(Boolean));
    return Array.from(set) as string[];
  }, [result.data]);

  // Combine filters
  const filteredMembers = useMemo(() => {
    if (!result.data) return [];
    return result.data.filter(m => {
      // Saved views
      if (savedView === "Active" && m.status !== "active") return false;
      if (savedView === "Suspended" && m.status !== "suspended") return false;

      // Department filter
      if (deptFilter !== "All Departments") {
        if (m.department !== deptFilter) return false;
      }

      return true;
    });
  }, [result.data, savedView, deptFilter]);

  // Sort Members
  const sortedMembers = useMemo(() => {
    const list = [...filteredMembers];
    return list.sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortBy === "name") { valA = a.full_name || ""; valB = b.full_name || ""; }
      else if (sortBy === "number") { valA = a.member_number || ""; valB = b.member_number || ""; }
      else if (sortBy === "joined") { valA = a.joined_at || ""; valB = b.joined_at || ""; }

      return sortOrder === "asc"
        ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [filteredMembers, sortBy, sortOrder]);

  // Paginated Members
  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedMembers.slice(start, start + itemsPerPage);
  }, [sortedMembers, page]);

  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage) || 1;

  const toggleSortOrder = () => setSortOrder(o => o === "asc" ? "desc" : "asc");

  return (
    <div className="flex h-full w-full relative">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedMember ? "pr-6 border-r border-black/5 dark:border-white/5 mr-6" : ""}`}>
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("members.title")}</h1>
            <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("members.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 bg-emerald text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-emerald/90 transition-colors shadow-sm shadow-emerald/20 cursor-pointer"
            >
              <Plus size={16} /> {t("members.addMember")}
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input 
              id="members-page-search"
              type="text" 
              placeholder={t("members.searchPlaceholder")}
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPage(1); }}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald" 
            />
          </div>

          {/* Select All Checkbox */}
          <div className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={sortedMembers.length > 0 && selectedIds.length === sortedMembers.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(sortedMembers.map(m => m.id));
                } else {
                  setSelectedIds([]);
                }
              }}
              className="cursor-pointer rounded border-black/20 dark:border-white/20 text-emerald focus:ring-emerald h-4 w-4"
            />
            <span className="text-[12px] font-semibold text-[#122222]/70 dark:text-white/70">{t("catalog.bulk.selectAll") || "Select All"}</span>
          </div>

          {/* Department Select Dropdown */}
          <select 
            value={deptFilter} 
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Departments">{t("members.allDepartments")}</option>
            {departmentsList.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Sort By Select Dropdown */}
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="name">{t("members.sortByName")}</option>
            <option value="number">{t("members.sortById")}</option>
            <option value="joined">{t("members.sortByJoined")}</option>
          </select>

          <button 
            onClick={toggleSortOrder}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-3 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            title="Toggle sort direction"
          >
            {sortOrder === "asc" ? t("asc") || "Asc" : t("desc") || "Desc"}
          </button>
        </div>

        {/* Saved Views */}
        <div className="flex items-center justify-between bg-white dark:bg-[#1d2926] p-1.5 rounded-lg border border-black/5 dark:border-white/5 mb-4 shadow-card">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider pl-2 pr-3">{t("catalog.savedViews")}:</span>
            <button 
              onClick={() => { setSavedView("All Members"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "All Members" ? "bg-emerald text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              {t("members.allMembers")}
            </button>
            <button 
              onClick={() => { setSavedView("Active"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "Active" ? "bg-emerald text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              {t("members.active")}
            </button>
            <button 
              onClick={() => { setSavedView("Suspended"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "Suspended" ? "bg-emerald text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              {t("members.suspended")}
            </button>
          </div>
        </div>

        {/* Card Grid Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto pr-1">
            {paginatedMembers.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 pb-4">
                {paginatedMembers.map((member) => {
                  const initials = member.full_name
                    ? member.full_name.split(/\s+/).map(n => n[0]).join("").substring(0, 2).toUpperCase()
                    : "??";
                  
                  return (
                    <div 
                      key={member.id} 
                      onClick={() => setSelectedMember(member)}
                      className={`relative flex flex-col items-center p-3.5 pt-9 mt-7 bg-white dark:bg-[#1d2926] border rounded-xl shadow-card transition-all duration-300 cursor-pointer ${
                        selectedIds.includes(member.id)
                          ? 'border-emerald dark:border-emerald-light ring-2 ring-emerald dark:ring-emerald-light bg-emerald/5 dark:bg-emerald/10'
                          : selectedMember?.id === member.id
                            ? 'border-emerald/50 dark:border-emerald-light/50 ring-1 ring-emerald/30 dark:ring-emerald-light/30 bg-[#122222]/5 dark:bg-white/5'
                            : 'border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15 hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      {/* Checkbox (Top Left) */}
                      <div className="absolute top-2.5 left-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(member.id)} 
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, member.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== member.id));
                            }
                          }}
                          className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-3.5 w-3.5"
                        />
                      </div>

                      {/* Status Badge (Top Right) */}
                      <span className={`absolute top-2.5 right-2.5 z-10 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                        member.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : 'bg-red-500/10 text-red-500'
                      }`}>
                        {t("members." + member.status)}
                      </span>

                      {/* Circular Avatar Container */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full border-3 border-white dark:border-[#1d2926] shadow-md overflow-hidden bg-white dark:bg-[#1d2926] shrink-0 z-10 flex items-center justify-center">
                        {member.avatar_path ? (
                          <img src={member.avatar_path} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 bg-emerald dark:bg-emerald-light text-white flex flex-col items-center justify-center p-1">
                            <span className="text-[13px] font-display font-bold tracking-wider drop-shadow-sm">
                              {initials}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Member Info */}
                      <h3 className="font-bold text-[13px] text-[#122222] dark:text-white text-center leading-snug mt-1.5 truncate w-full px-1" title={member.full_name}>
                        {member.full_name}
                      </h3>
                      
                      <span className="inline-block font-mono text-[9px] font-bold text-emerald dark:text-[#1b9277] bg-emerald/5 dark:bg-emerald-light/10 border border-emerald/10 dark:border-emerald-light/10 px-1.5 py-0.5 rounded-md mt-1 shrink-0">
                        {member.member_number}
                      </span>

                      <div className="w-full border-t border-dashed border-black/5 dark:border-white/5 my-2 shrink-0" />

                      <div className="space-y-0.5 w-full text-center text-[11px] text-[#122222]/60 dark:text-white/60 shrink-0">
                        <div className="font-semibold text-ink dark:text-parchment truncate w-full px-0.5">
                          {member.role}
                        </div>
                        <div className="text-[10px] opacity-75 truncate w-full px-0.5">
                          {member.department || t("members.noDepartment") || "No Department"}
                        </div>
                        {member.phone && (
                          <div className="flex items-center justify-center gap-1 text-[9px] font-mono opacity-60 pt-0.5">
                            <Phone size={9} className="shrink-0" />
                            <span className="truncate">{member.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-[#122222]/50">
                <IdCard size={48} className="mb-4 text-[#122222]/30" />
                <p className="text-[14px]">{t("members.noMembers")}</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[12px] text-[#122222]/60 dark:text-white/60 font-semibold bg-[#fcfbf8] dark:bg-[#111d1a] rounded-b-xl">
            <div>{t("catalog.showing", { start: Math.min(sortedMembers.length, (page - 1) * itemsPerPage + 1), end: Math.min(sortedMembers.length, page * itemsPerPage), total: sortedMembers.length })}</div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2">{page} / {totalPages}</span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar Details */}
      {selectedMember && (
        <MemberSidebar 
          member={selectedMember} 
          onClose={() => {
            setSelectedMember(null);
            invalidate();
          }}
          registerClean={registerClean}
        />
      )}

      {/* Add Member Modal */}
      {adding && (
        <Modal isOpen={adding} onClose={() => setAdding(false)} title={t("members.addMember")}>
          <form className="grid gap-4 md:grid-cols-2 text-[13px]" onSubmit={addForm.handleSubmit((values) => addMutation.mutate(values))}>
            <div className="md:col-span-2 flex justify-center py-2">
              <ImageUpload
                value={addForm.watch("avatar_path")}
                onChange={(val) => addForm.setValue("avatar_path", val)}
                shape="circle"
                label={t("members.avatar")}
              />
            </div>
            
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2">
              <span>{t("members.fullName")} <span className="text-red-500">*</span></span>
              <Input {...registerClean(addForm, "full_name", cleanText)} placeholder="e.g. Mohamed Benali" />
              {addForm.formState.errors.full_name && <small className="text-red-500">{addForm.formState.errors.full_name.message}</small>}
            </label>
            
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
              <span>{t("members.membershipNumber")} <span className="text-red-500">*</span></span>
              <Input {...registerClean(addForm, "member_number", cleanMemberNumber)} placeholder="e.g. MB-987654" />
              {addForm.formState.errors.member_number && <small className="text-red-500">{addForm.formState.errors.member_number.message}</small>}
            </label>

            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
              <span>{t("members.email")}</span>
              <Input {...registerClean(addForm, "email", cleanText)} placeholder="name@hospital.com" />
              {addForm.formState.errors.email && <small className="text-red-500">{addForm.formState.errors.email.message}</small>}
            </label>

            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
              <span>{t("members.phone")}</span>
              <Input {...registerClean(addForm, "phone", cleanPhone)} placeholder="+213 555 12 34 56" />
            </label>

            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
              <span>{t("members.roleLabel")} <span className="text-red-500">*</span></span>
              <Input {...registerClean(addForm, "role", cleanText)} placeholder="e.g. Doctor, Nurse, Student" />
              {addForm.formState.errors.role && <small className="text-red-500">{addForm.formState.errors.role.message}</small>}
            </label>

            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
              <span>{t("members.departmentLabel")}</span>
              <Input {...registerClean(addForm, "department", cleanText)} placeholder="e.g. Cardiology" />
            </label>

            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
              <span>{t("status")}</span>
              <select {...addForm.register("status")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold">
                <option value="active">{t("members.active") || "Active"}</option>
                <option value="suspended">{t("members.suspended") || "Suspended"}</option>
              </select>
            </label>

            <div className="md:col-span-2 flex gap-2 justify-end pt-4 pb-4 border-t border-black/5 dark:border-white/5">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>{t("catalog.addModal.cancel")}</Button>
              <Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? "Saving..." : t("catalog.addModal.save")}</Button>
            </div>
          </form>
        </Modal>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-[#1d2926]/90 backdrop-blur-md px-6 py-3 rounded-full border border-black/10 dark:border-white/10 shadow-lg flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-[13px] font-semibold text-[#122222] dark:text-white">
            {t("members.bulk.selectedCount", { count: selectedIds.length }) || `${selectedIds.length} member(s) selected`}
          </span>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(sortedMembers.map(m => m.id))}
              className="text-[12px] font-bold text-emerald dark:text-emerald-light hover:underline px-2 py-1 cursor-pointer"
            >
              {t("catalog.bulk.selectAll") || "Select All"}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-[12px] font-bold text-[#122222]/60 dark:text-white/60 hover:underline px-2 py-1 cursor-pointer"
            >
              {t("catalog.bulk.deselectAll") || "Deselect All"}
            </button>
            <button
              onClick={handleBulkArchiveMembers}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full shadow transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              {t("catalog.bulk.archiveSelected") || "Archive Selected"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberSidebar({ member, onClose, registerClean }: { member: Member; onClose: () => void; registerClean: any }) {
  const { t } = useTranslation();
  const prefs = useUiStore((state) => state.preferences);
  const [activeTab, setActiveTab] = useState<"profile" | "loans" | "reservations">("profile");
  const [isEditing, setIsEditing] = useState(false);

  // Queries
  const { data: memberLoans, refetch: refetchLoans } = useQuery({ 
    queryKey: ["member-loans", member.id], 
    queryFn: () => getLoansForMember(member.id) 
  });
  
  const { data: memberReservations, refetch: refetchRes } = useQuery({ 
    queryKey: ["member-res", member.id], 
    queryFn: () => getReservationsForMember(member.id) 
  });

  // Edit Member Form
  const editForm = useForm<MemberValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      full_name: member.full_name,
      member_number: member.member_number,
      email: member.email || "",
      phone: member.phone || "",
      role: member.role || "Staff",
      department: member.department || "",
      status: member.status,
      avatar_path: member.avatar_path || null
    }
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (values: MemberValues) => updateMember(member.id, {
      full_name: cleanText(values.full_name),
      member_number: cleanMemberNumber(values.member_number),
      email: values.email ? cleanText(values.email) : "",
      phone: values.phone ? cleanPhone(values.phone) : "",
      role: cleanText(values.role),
      department: values.department ? cleanText(values.department) : "",
      status: values.status,
      avatar_path: values.avatar_path || null
    }),
    onSuccess: () => {
      toast.success(t("members.alerts.updated") || "Member profile updated.");
      setIsEditing(false);
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMember(member.id),
    onSuccess: () => {
      toast.success(t("members.alerts.archived") || "Member record archived.");
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const renewMutation = useMutation({
    mutationFn: (loanId: string) => renewLoan(loanId, prefs.loanDays),
    onSuccess: () => {
      toast.success(t("circulation.alerts.renewSuccess") || "Loan renewed.");
      refetchLoans();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const returnMutation = useMutation({
    mutationFn: (copyIds: string[]) => returnCopies(copyIds, prefs.reservationHoldDays),
    onSuccess: () => {
      toast.success(t("circulation.alerts.returnSuccess") || "Item returned successfully.");
      refetchLoans();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const cancelResMutation = useMutation({
    mutationFn: (resId: string) => cancelReservation(resId),
    onSuccess: () => {
      toast.success(t("members.alerts.reservationCancelled") || "Reservation cancelled.");
      refetchRes();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="w-[340px] shrink-0 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl shadow-card flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-[#fcfbf8] dark:bg-[#111d1a]">
        <button onClick={onClose} className="text-emerald dark:text-emerald-light hover:bg-emerald/5 p-1 rounded-md transition-colors flex items-center gap-1 text-[13px] font-bold cursor-pointer">
          <ChevronLeft size={16} /> {t("catalog.details.back")}
        </button>
        <button onClick={onClose} className="text-[#122222]/40 hover:text-[#122222] transition-colors cursor-pointer"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col items-start space-y-6">
        {/* Profile Card Header */}
        <div className="w-full flex flex-col items-center text-center space-y-3 shrink-0">
          {member.avatar_path ? (
            <img src={member.avatar_path} alt="" className="w-20 h-20 rounded-full object-cover shadow border border-black/10" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-emerald text-white flex items-center justify-center text-[24px] font-bold shadow-inner">
              {member.full_name.split(/\s+/).map(n => n[0]).join("").substring(0,2).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-[17px] font-bold text-[#122222] dark:text-white leading-tight">{member.full_name}</h2>
            <p className="text-[11px] font-mono text-[#122222]/50 mt-1">{member.member_number}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            member.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
          }`}>
            {t("members." + member.status)}
          </span>
        </div>

        {/* Tab Selection */}
        <div className="flex w-full border-b border-black/5 dark:border-white/5 shrink-0">
          <button 
            onClick={() => { setActiveTab("profile"); setIsEditing(false); }}
            className={`flex-1 pb-2 text-[12px] font-bold border-b-2 text-center transition-all cursor-pointer ${
              activeTab === "profile" ? "border-emerald text-emerald dark:border-emerald-light dark:text-emerald-light" : "border-transparent text-[#122222]/50 dark:text-white/50"
            }`}
          >
            {t("members.tabs.profile")}
          </button>
          <button 
            onClick={() => setActiveTab("loans")}
            className={`flex-1 pb-2 text-[12px] font-bold border-b-2 text-center transition-all cursor-pointer ${
              activeTab === "loans" ? "border-emerald text-emerald dark:border-emerald-light dark:text-emerald-light" : "border-transparent text-[#122222]/50 dark:text-white/50"
            }`}
          >
            {t("members.tabs.loans", { count: memberLoans?.length ?? 0 })}
          </button>
          <button 
            onClick={() => setActiveTab("reservations")}
            className={`flex-1 pb-2 text-[12px] font-bold border-b-2 text-center transition-all cursor-pointer ${
              activeTab === "reservations" ? "border-emerald text-emerald dark:border-emerald-light dark:text-emerald-light" : "border-transparent text-[#122222]/50 dark:text-white/50"
            }`}
          >
            {t("members.tabs.holds", { count: memberReservations?.length ?? 0 })}
          </button>
        </div>

        {activeTab === "profile" && (
          <div className="w-full space-y-4">
            {!isEditing ? (
              <>
                <div className="space-y-3">
                  <SidebarInfoRow label={t("members.roleLabel")} value={member.role || "—"} />
                  <SidebarInfoRow label={t("members.departmentLabel")} value={member.department || "—"} />
                  {member.phone && <SidebarInfoRow label={t("members.phone")} value={member.phone} />}
                  {member.email && (
                    <div>
                      <span className="text-[10px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider block">{t("members.email")}</span>
                      <a href={`mailto:${member.email}`} className="text-[13px] font-semibold text-emerald hover:underline block mt-0.5 truncate">{member.email}</a>
                    </div>
                  )}
                  <SidebarInfoRow label={t("members.registeredOn")} value={formatDisplayDate(member.joined_at)} />
                </div>

                <div className="flex gap-2 pt-4 border-t border-black/5 dark:border-white/5 w-full">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 text-[12px] font-bold text-[#122222] dark:text-white py-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                  >
                    <Edit2 size={14} /> {t("catalog.details.edit")}
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(t("members.alerts.confirmDelete") || "Are you sure you want to delete this member? All history is retained, but eligibility ceases.")) {
                        deleteMutation.mutate();
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-500 text-[12px] font-bold py-2 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} /> {t("catalog.details.archive")}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={editForm.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-3 w-full text-[13px]">
                <div className="flex justify-center py-1">
                  <ImageUpload
                    value={editForm.watch("avatar_path")}
                    onChange={(val) => editForm.setValue("avatar_path", val || null)}
                    shape="circle"
                    label={t("members.avatar")}
                  />
                </div>
                <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("members.fullName")}
                  <Input {...registerClean(editForm, "full_name", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("members.membershipNumber")}
                  <Input {...registerClean(editForm, "member_number", cleanMemberNumber)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("members.email")}
                  <Input {...registerClean(editForm, "email", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("members.phone")}
                  <Input {...registerClean(editForm, "phone", cleanPhone)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("members.roleLabel")}
                  <Input {...registerClean(editForm, "role", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("members.departmentLabel")}
                  <Input {...registerClean(editForm, "department", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("status")}
                  <select {...editForm.register("status")} className="field-select text-[13px] py-1.5 px-2.5 mt-1 font-semibold">
                    <option value="active">{t("members.active") || "Active"}</option>
                    <option value="suspended">{t("members.suspended") || "Suspended"}</option>
                  </select>
                </label>
                <div className="flex gap-2 justify-end pt-3 border-t border-black/5 dark:border-white/5">
                  <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>{t("catalog.addModal.cancel")}</Button>
                  <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : t("save")}</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === "loans" && (
          <div className="w-full space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {memberLoans?.length ? (
              memberLoans.map((loan) => {
                const overdue = daysLate(loan.due_at) > 0;
                const renewDisabled = loan.renewed_count >= prefs.renewLimit;

                return (
                  <div key={loan.id} className="p-3 bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/5 dark:border-white/5 rounded-xl flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-bold text-[#122222] dark:text-white truncate leading-snug">{loan.title}</h4>
                        <span className="text-[10px] text-[#122222]/50 dark:text-white/50 block font-mono mt-0.5">{loan.barcode}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${overdue ? 'text-red-500' : 'text-[#122222]/60'}`}>
                        {overdue ? t("status.overdue") || "Overdue" : t("status.onloan") || "On loan"}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#122222]/65 dark:text-white/65">
                      {t("circulation.due") || "Due date"}: <span className="font-semibold">{formatDisplayDate(loan.due_at)}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => renewMutation.mutate(loan.id)}
                        disabled={renewMutation.isPending || renewDisabled}
                        className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-semibold text-[#122222]/80 dark:text-white/80 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={renewDisabled ? t("circulation.alerts.renewLimitReached") || "Renewal limit reached" : undefined}
                      >
                        {t("circulation.renew") || "Renew"} ({loan.renewed_count}/{prefs.renewLimit})
                      </button>
                      <button 
                        onClick={() => returnMutation.mutate([loan.copy_id])}
                        disabled={returnMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-semibold text-emerald bg-emerald/10 dark:bg-emerald-light/10 dark:text-emerald-light hover:bg-emerald/20 rounded cursor-pointer"
                      >
                        {t("circulation.return") || "Return"}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[13px] text-[#122222]/50 text-center py-6">{t("members.noActiveLoans") || "No books currently checked out."}</p>
            )}
          </div>
        )}

        {activeTab === "reservations" && (
          <div className="w-full space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {memberReservations?.length ? (
              memberReservations.map((res) => (
                <div key={res.id} className="p-3 bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/5 dark:border-white/5 rounded-xl flex items-center justify-between">
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-bold text-[#122222] dark:text-white truncate leading-snug">{res.title}</h4>
                    <span className={`text-[10px] font-bold capitalize block mt-0.5 ${
                      res.status === 'ready' ? 'text-emerald' : 'text-[#b96f3e]'
                    }`}>{res.status}</span>
                  </div>
                  <button 
                    onClick={() => cancelResMutation.mutate(res.id)}
                    disabled={cancelResMutation.isPending}
                    className="text-red-500 hover:text-red-700 text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    {t("catalog.addModal.cancel") || "Cancel"}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-[#122222]/50 text-center py-6">{t("members.noReservations") || "No reservations placed."}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider block">{label}</span>
      <span className="text-[13px] font-semibold text-[#122222] dark:text-white block mt-0.5">{value}</span>
    </div>
  );
}
