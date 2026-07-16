import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Plus, Search, ChevronLeft, ChevronRight, X, 
  Mail, Trash2, CheckCircle2, IdCard, Building, Phone, Edit2
} from "lucide-react";
import { 
  members, saveMember, updateMember, deleteMember, getLoansForMember, 
  getReservationsForMember, renewLoan, returnCopies, cancelReservation 
} from "../data/repositories/library";
import type { Member } from "../types";
import { Modal, Input, Button } from "../components/ui/primitives";
import { toast } from "sonner";
import { daysLate } from "../utils/dates";
import { queryClient } from "../app/providers";
import { useUiStore } from "../store/uiStore";
import { ImageUpload } from "../components/ui/ImageUpload";

const invalidate = () => queryClient.invalidateQueries();

const memberSchema = z.object({ 
  full_name: z.string().min(2, "A full name is required"), 
  email: z.string().email().or(z.literal("")).optional(), 
  phone: z.string().optional(), 
  department: z.string().optional(), 
  role: z.string().optional(),
  status: z.enum(["active", "suspended", "expired", "archived"]).optional(),
  avatar_path: z.string().nullable().optional()
});
type MemberValues = z.infer<typeof memberSchema>;

export function MembersPage() {
  const [term, setTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);

  // Sorting, Filtering & Pagination State
  const [sortBy, setSortBy] = useState<"name" | "number" | "joined">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [savedView, setSavedView] = useState("All Members");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  
  // Quick fetch
  const result = useQuery({ queryKey: ["members", term], queryFn: () => members(term) });

  const addForm = useForm<MemberValues>({ 
    resolver: zodResolver(memberSchema), 
    defaultValues: { full_name: "", email: "", phone: "", department: "", role: "", status: "active", avatar_path: null } 
  });

  const addMutation = useMutation({ 
    mutationFn: (values: MemberValues) => saveMember({ 
      full_name: values.full_name,
      email: values.email || null, 
      phone: values.phone || null, 
      department: values.department || null, 
      role: values.role || null, 
      status: values.status || "active", 
      expiry_date: null,
      avatar_path: values.avatar_path || null
    }), 
    onSuccess: () => { 
      invalidate(); 
      toast.success("Member registered successfully."); 
      addForm.reset(); 
      setAdding(false); 
    }, 
    onError: (error) => toast.error(error.message) 
  });

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
      if (savedView === "Active") {
        if (m.status !== "active") return false;
      } else if (savedView === "Suspended") {
        if (m.status !== "suspended") return false;
      }

      // Department filter
      if (deptFilter !== "All Departments") {
        if (m.department !== deptFilter) return false;
      }

      return true;
    });
  }, [result.data, savedView, deptFilter]);

  // Sort members
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

  // Paginated members
  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedMembers.slice(start, start + itemsPerPage);
  }, [sortedMembers, page]);

  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage) || 1;

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  return (
    <div className="flex h-full w-full relative">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedMember ? "pr-6 border-r border-black/5 dark:border-white/5 mr-6" : ""}`}>
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">Members</h1>
            <p className="text-[13px] text-[#122222]/60 dark:text-white/60">Manage borrowing eligibility, contact information, and membership.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 bg-[#1a4d40] text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm shadow-[#1a4d40]/20"
            >
              <Plus size={16} /> Add member
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input 
              type="text" 
              placeholder="Search member name, number, or department..." 
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPage(1); }}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-[#1a4d40] focus:ring-1 focus:ring-[#1a4d40]" 
            />
          </div>

          {/* Department Select Dropdown */}
          <select 
            value={deptFilter} 
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-[#1a4d40]/30 transition-colors"
          >
            <option value="All Departments">All Departments</option>
            {departmentsList.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Sort By Select Dropdown */}
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-[#1a4d40]/30 transition-colors"
          >
            <option value="name">Sort by Name</option>
            <option value="number">Sort by ID</option>
            <option value="joined">Sort by Joined Date</option>
          </select>

          <button 
            onClick={toggleSortOrder}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-3 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"
            title="Toggle sort direction"
          >
            {sortOrder === "asc" ? "Asc" : "Desc"}
          </button>
        </div>

        {/* Saved Views */}
        <div className="flex items-center justify-between bg-white dark:bg-[#1d2926] p-1.5 rounded-lg border border-black/5 dark:border-white/5 mb-4 shadow-card">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider pl-2 pr-3">Saved views:</span>
            <button 
              onClick={() => { setSavedView("All Members"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "All Members" ? "bg-[#1a4d40] text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              All Members
            </button>
            <button 
              onClick={() => { setSavedView("Active"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "Active" ? "bg-[#1a4d40] text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              Active
            </button>
            <button 
              onClick={() => { setSavedView("Suspended"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "Suspended" ? "bg-[#1a4d40] text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              Suspended
            </button>
          </div>
        </div>

        {/* Card Grid Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto pr-1">
            {paginatedMembers.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                {paginatedMembers.map((member) => {
                  const initials = member.full_name
                    ? member.full_name.split(/\s+/).map(n => n[0]).join("").substring(0, 2).toUpperCase()
                    : "??";
                  
                  return (
                    <div 
                      key={member.id} 
                      onClick={() => setSelectedMember(member)}
                      className={`relative flex flex-col p-5 bg-white dark:bg-[#1d2926] border rounded-2xl shadow-card transition-all duration-300 cursor-pointer ${
                        selectedMember?.id === member.id 
                          ? 'border-[#1a4d40] dark:border-[#1b9277] ring-2 ring-[#1a4d40] dark:ring-[#1b9277] bg-[#1a4d40]/5 dark:bg-[#1a4d40]/10' 
                          : 'border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15 hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      {/* Header: Checkbox & Status */}
                      <div className="flex justify-between items-start mb-4">
                        <input 
                          type="checkbox" 
                          checked={selectedMember?.id === member.id} 
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedMember(selectedMember?.id === member.id ? null : member);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${
                            member.status === 'active' 
                              ? 'bg-[#1a4d40]/10 text-[#1a4d40] dark:bg-[#1b9277]/20 dark:text-[#1b9277]' 
                              : member.status === 'suspended'
                              ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20'
                              : member.status === 'expired'
                              ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20'
                              : 'bg-gray-500/10 text-gray-500 dark:bg-gray-500/20'
                          }`}>
                            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                          </span>
                        </div>
                      </div>

                      {/* Profile Header */}
                      <div className="flex flex-col items-center text-center mb-4">
                        {member.avatar_path ? (
                          <img src={member.avatar_path} alt="" className="w-14 h-14 rounded-full object-cover mb-3 border border-black/10 shadow-inner select-none" />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-br from-[#b96f3e] to-[#8a4e27] text-white rounded-full flex items-center justify-center font-bold text-[16px] mb-3 shadow-inner select-none">
                            {initials}
                          </div>
                        )}
                        <h3 className="font-bold text-[14px] text-[#122222] dark:text-white line-clamp-1 leading-snug">
                          {member.full_name}
                        </h3>
                        <span className="text-[11px] text-[#122222]/50 dark:text-white/50 font-medium">
                          {member.role || "—"}
                        </span>
                      </div>

                      {/* Details Rows */}
                      <div className="mt-auto pt-4 border-t border-black/5 dark:border-white/5 text-[11px] space-y-2.5">
                        <div className="flex items-center gap-2 text-[#122222]/60 dark:text-white/60">
                          <IdCard size={13} className="text-[#122222]/40 dark:text-white/40 shrink-0" />
                          <span className="font-mono text-[#122222]/80 dark:text-white/80 font-medium line-clamp-1">
                            {member.member_number}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[#122222]/60 dark:text-white/60">
                          <Building size={13} className="text-[#122222]/40 dark:text-white/40 shrink-0" />
                          <span className="text-[#122222]/80 dark:text-white/80 font-medium line-clamp-1">
                            {member.department || "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[#122222]/60 dark:text-white/60" title={member.email || member.phone || "—"}>
                          {member.email ? (
                            <Mail size={13} className="text-[#122222]/40 dark:text-white/40 shrink-0" />
                          ) : (
                            <Phone size={13} className="text-[#122222]/40 dark:text-white/40 shrink-0" />
                          )}
                          <span className="text-[#122222]/80 dark:text-white/80 font-medium line-clamp-1">
                            {member.email || member.phone || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-[#122222]/50 dark:text-white/50 bg-white dark:bg-[#1d2926] rounded-xl border border-black/5 dark:border-white/5 shadow-card">
                <Phone size={48} className="mb-4 text-[#122222]/30" />
                <p className="text-[14px]">No members found matching filters.</p>
              </div>
            )}
          </div>
          
          {/* Pagination */}
          <div className="p-3 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-xl flex items-center justify-between text-[12px] text-[#122222]/60 dark:text-white/60 font-semibold bg-[#fcfbf8] dark:bg-[#111d1a] shadow-card">
            <div>Showing {Math.min(sortedMembers.length, (page - 1) * itemsPerPage + 1)} to {Math.min(sortedMembers.length, page * itemsPerPage)} of {sortedMembers.length} results</div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30"
              >
                <ChevronLeft size={14}/>
              </button>
              <span className="px-2">{page} / {totalPages}</span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30"
              >
                <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Details Panel) */}
      {selectedMember && (
        <MemberSidebar 
          member={selectedMember} 
          onClose={() => {
            setSelectedMember(null);
            invalidate();
          }}
        />
      )}

      {adding && (
        <Modal isOpen={adding} onClose={() => setAdding(false)} title="Register Member">
          <form className="grid gap-4 md:grid-cols-2 text-[13px]" onSubmit={addForm.handleSubmit((values) => addMutation.mutate(values))}>
            <div className="md:col-span-2 flex justify-center py-2">
              <ImageUpload
                value={addForm.watch("avatar_path")}
                onChange={(val) => addForm.setValue("avatar_path", val)}
                shape="circle"
                label="Profile Picture"
              />
            </div>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60"><span>Full Name <span className="text-red-500">*</span></span>
              <Input {...addForm.register("full_name")} placeholder="e.g. Mohaned Elamin" />
              {addForm.formState.errors.full_name && <small className="text-red-500">{addForm.formState.errors.full_name.message}</small>}
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">Email
              <Input type="email" {...addForm.register("email")} placeholder="e.g. mohaned@hospital.dz" />
              {addForm.formState.errors.email && <small className="text-red-500">{addForm.formState.errors.email.message}</small>}
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">Phone
              <Input {...addForm.register("phone")} placeholder="e.g. +213 555-12345" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">Department
              <Input {...addForm.register("department")} placeholder="e.g. Medicine" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block md:col-span-2">Role / Job Title
              <Input {...addForm.register("role")} placeholder="e.g. Resident Doctor" />
            </label>
            <div className="md:col-span-2 flex gap-2 justify-end pt-4 border-t border-black/5 dark:border-white/5">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? "Registering…" : "Register member"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MemberSidebar({ member, onClose }: { member: Member; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"profile" | "loans" | "reservations">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const { preferences } = useUiStore();

  // Queries
  const { data: memberLoans, refetch: refetchLoans } = useQuery({
    queryKey: ["member-loans", member.id],
    queryFn: () => getLoansForMember(member.id)
  });
  const { data: memberReservations, refetch: refetchReservations } = useQuery({
    queryKey: ["member-reservations", member.id],
    queryFn: () => getReservationsForMember(member.id)
  });

  // Edit Form
  const editForm = useForm({
    defaultValues: {
      full_name: member.full_name,
      email: member.email || "",
      phone: member.phone || "",
      department: member.department || "",
      role: member.role || "",
      status: member.status,
      avatar_path: member.avatar_path || ""
    }
  });

  // Mutations
  const updateMemberMutation = useMutation({
    mutationFn: (values: any) => updateMember(member.id, values),
    onSuccess: () => {
      toast.success("Member profile updated.");
      setIsEditing(false);
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteMemberMutation = useMutation({
    mutationFn: () => deleteMember(member.id),
    onSuccess: () => {
      toast.success("Member archived.");
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const renewLoanMutation = useMutation({
    mutationFn: (loanId: string) => renewLoan(loanId, preferences.loanDays),
    onSuccess: () => {
      toast.success("Loan renewed.");
      refetchLoans();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const returnCopyMutation = useMutation({
    mutationFn: (copyId: string) => returnCopies([copyId]),
    onSuccess: () => {
      toast.success("Item returned.");
      refetchLoans();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const cancelReservationMutation = useMutation({
    mutationFn: (resId: string) => cancelReservation(resId),
    onSuccess: () => {
      toast.success("Reservation cancelled.");
      refetchReservations();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const initials = member.full_name.substring(0,2).toUpperCase();

  return (
    <div className="w-[320px] shrink-0 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl shadow-card flex flex-col h-full overflow-hidden relative transition-transform">
      {/* Header */}
      <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-[#fcfbf8] dark:bg-[#111d1a]">
        <button onClick={onClose} className="text-[#1a4d40] dark:text-[#1b9277] hover:bg-[#1a4d40]/5 p-1 rounded-md transition-colors flex items-center gap-1 text-[13px] font-bold">
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={onClose} className="text-[#122222]/40 hover:text-[#122222] transition-colors"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col items-start space-y-6">
        
        {/* Profile Header */}
        <div className="flex flex-col items-center w-full pb-6 border-b border-black/5 dark:border-white/5 shrink-0">
          {member.avatar_path ? (
            <img src={member.avatar_path} alt={member.full_name} className="w-20 h-20 rounded-full object-cover mb-4 shadow-sm border border-black/10" />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-[#b96f3e] to-[#8a4e27] text-white rounded-full flex items-center justify-center text-[32px] font-bold shadow-sm mb-4 select-none">
              {initials}
            </div>
          )}
          <h2 className="text-[20px] font-bold text-[#122222] dark:text-white leading-tight text-center">{member.full_name}</h2>
          <p className="text-[13px] font-mono font-semibold text-[#122222]/60 dark:text-white/60 mt-1">{member.member_number}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-black/5 dark:border-white/5 w-full shrink-0">
          <button 
            onClick={() => { setActiveTab("profile"); setIsEditing(false); }}
            className={`pb-2 text-[12px] font-bold border-b-2 flex-1 text-center transition-all ${
              activeTab === "profile" ? "border-[#1a4d40] text-[#1a4d40] dark:border-[#1b9277] dark:text-[#1b9277]" : "border-transparent text-[#122222]/50 dark:text-white/50"
            }`}
          >
            Profile
          </button>
          <button 
            onClick={() => setActiveTab("loans")}
            className={`pb-2 text-[12px] font-bold border-b-2 flex-1 text-center transition-all ${
              activeTab === "loans" ? "border-[#1a4d40] text-[#1a4d40] dark:border-[#1b9277] dark:text-[#1b9277]" : "border-transparent text-[#122222]/50 dark:text-white/50"
            }`}
          >
            Loans ({memberLoans?.filter(l => !l.returned_at).length ?? 0})
          </button>
          <button 
            onClick={() => setActiveTab("reservations")}
            className={`pb-2 text-[12px] font-bold border-b-2 flex-1 text-center transition-all ${
              activeTab === "reservations" ? "border-[#1a4d40] text-[#1a4d40] dark:border-[#1b9277] dark:text-[#1b9277]" : "border-transparent text-[#122222]/50 dark:text-white/50"
            }`}
          >
            Holds
          </button>
        </div>

        {activeTab === "profile" && (
          <div className="w-full space-y-4">
            {!isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Department" value={member.department || "—"} />
                  <InfoRow label="Role / Job Title" value={member.role || "—"} />
                </div>
                
                <div>
                  <div className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-1.5">Status</div>
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-600">
                    <CheckCircle2 size={14}/> {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </div>
                </div>

                <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-4">
                  <InfoRow label="Email" value={member.email || "—"} />
                  <InfoRow label="Phone" value={member.phone || "—"} />
                </div>

                <div className="flex gap-2 w-full pt-4 mt-auto">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 text-[13px] font-bold text-[#122222] dark:text-white py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    <Edit2 size={16} /> Edit Profile
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm("Are you sure you want to archive this member?")) deleteMemberMutation.mutate();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-500 text-[13px] font-bold py-2 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={16} /> Archive
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={editForm.handleSubmit((v) => updateMemberMutation.mutate(v))} className="space-y-3 w-full text-[13px]">
                <div className="flex justify-center py-1">
                  <ImageUpload
                    value={editForm.watch("avatar_path")}
                    onChange={(val) => editForm.setValue("avatar_path", val || "")}
                    shape="circle"
                    label="Profile Picture"
                  />
                </div>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Full Name
                  <Input {...editForm.register("full_name")} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Email
                  <Input {...editForm.register("email")} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Phone
                  <Input {...editForm.register("phone")} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Department
                  <Input {...editForm.register("department")} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">Role
                  <Input {...editForm.register("role")} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block font-semibold">Status
                  <select {...editForm.register("status")} className="field-select text-[13px] py-1 px-2.5">
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="expired">Expired</option>
                  </select>
                </label>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={updateMemberMutation.isPending} className="flex-1 py-1.5 text-[12px]">Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="flex-1 py-1.5 text-[12px]">Cancel</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === "loans" && (
          <div className="w-full space-y-3">
            <h4 className="font-bold text-[13px] text-[#122222] dark:text-white">Active Loans</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1 w-full">
              {memberLoans?.filter(l => !l.returned_at).length ? (
                memberLoans.filter(l => !l.returned_at).map((loan) => {
                  const late = daysLate(loan.due_at);
                  return (
                    <div key={loan.id} className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-[#fcfbf8] dark:bg-[#111d1a] space-y-2.5">
                      <div className="min-w-0">
                        <p className="font-bold text-[12px] text-[#122222] dark:text-white truncate">{loan.title}</p>
                        <p className="text-[10px] text-[#122222]/50 mt-0.5 font-mono truncate">BC: {loan.barcode}</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`font-bold ${late > 0 ? "text-red-500" : "text-[#122222]/60 dark:text-white/60"}`}>
                          Due: {loan.due_at} {late > 0 && `(${late}d late)`}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-1 border-t border-black/5">
                        <button 
                          onClick={() => renewLoanMutation.mutate(loan.id)}
                          disabled={renewLoanMutation.isPending}
                          className="flex-1 py-1 bg-white border rounded text-[11px] font-semibold text-[#122222] hover:bg-black/5"
                        >
                          Renew
                        </button>
                        <button 
                          onClick={() => returnCopyMutation.mutate(loan.copy_id)}
                          disabled={returnCopyMutation.isPending}
                          className="flex-1 py-1 bg-[#1a4d40] text-white rounded text-[11px] font-semibold hover:bg-[#1a4d40]/90"
                        >
                          Return
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-[12px] text-[#122222]/40 dark:text-white/40">No active loans.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "reservations" && (
          <div className="w-full space-y-3">
            <h4 className="font-bold text-[13px] text-[#122222] dark:text-white">Active Reservations</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1 w-full">
              {memberReservations?.filter(r => r.status === "queued" || r.status === "ready").length ? (
                memberReservations.filter(r => r.status === "queued" || r.status === "ready").map((res) => (
                  <div key={res.id} className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-[#fcfbf8] dark:bg-[#111d1a] flex justify-between items-center">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-bold text-[12px] text-[#122222] dark:text-white truncate">{res.title}</p>
                      <p className="text-[10px] text-[#122222]/50 mt-0.5 truncate">Queue: #{res.position} · Status: {res.status}</p>
                    </div>
                    <button 
                      onClick={() => {
                        if (confirm("Cancel reservation?")) cancelReservationMutation.mutate(res.id);
                      }}
                      disabled={cancelReservationMutation.isPending}
                      className="text-red-500 hover:text-red-700 p-1 text-[11px] font-semibold shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-[12px] text-[#122222]/40 dark:text-white/40">No active reservations.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-[13px] font-semibold text-[#122222] dark:text-white">
        {value}
      </div>
    </div>
  );
}
