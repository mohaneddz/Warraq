import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Filter, Bookmark, Clock } from "lucide-react";
import { reservations, cancelReservation } from "../data/repositories/library";
import { queryClient } from "../app/providers";
import { toast } from "sonner";

const invalidate = () => queryClient.invalidateQueries();

export function ReservationsPage() {
  const [term, setTerm] = useState("");
  
  // Queries
  const result = useQuery({ queryKey: ["reservations"], queryFn: reservations }); 

  // Client-side search filtering
  const filteredReservations = useMemo(() => {
    if (!result.data) return [];
    if (!term.trim()) return result.data;
    const q = term.toLowerCase().trim();
    return result.data.filter(r => 
      r.title?.toLowerCase().includes(q) || 
      r.member_name?.toLowerCase().includes(q)
    );
  }, [result.data, term]);

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: () => {
      invalidate();
      toast.success("Reservation cancelled.");
    },
    onError: (err) => toast.error(err.message)
  });

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">Reservations</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">Manage hold requests, waiting lists, and ready-to-pickup items.</p>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a]">
          <div className="flex-1 max-w-sm relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input 
              type="text" 
              placeholder="Search reservations by book title or member name..." 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-[#1a4d40] focus:ring-1 focus:ring-[#1a4d40]" 
            />
          </div>
          <FilterSelect placeholder="All Statuses" />
          <button className="flex items-center gap-2 text-[#122222]/60 dark:text-white/60 text-[13px] font-semibold px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg ml-auto">
            <Filter size={16} /> More filters
          </button>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          {filteredReservations.length ? (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">TITLE</th>
                  <th className="px-6 py-3">MEMBER</th>
                  <th className="px-6 py-3">REQUEST DATE</th>
                  <th className="px-6 py-3">STATUS</th>
                  <th className="px-6 py-3 w-20">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-3 font-semibold text-[#122222] dark:text-white">
                      {res.title || "—"}
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      {res.member_name || "—"}
                    </td>
                    <td className="px-6 py-3 text-[#122222]/70 dark:text-white/70">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="opacity-50"/>
                        {new Date(res.reserved_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-[4px] text-[11px] font-bold ${
                        res.status === 'ready' 
                          ? 'bg-[#1a4d40]/10 text-[#1a4d40] dark:bg-[#1b9277]/20 dark:text-[#1b9277]' 
                          : res.status === 'queued'
                          ? 'bg-[#b96f3e]/10 text-[#b96f3e]'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {res.status.charAt(0).toUpperCase() + res.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {(res.status === 'queued' || res.status === 'ready') && (
                        <button 
                          onClick={() => {
                            if (confirm("Cancel this reservation?")) {
                              cancelMutation.mutate(res.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 font-bold text-[11px] cursor-pointer"
                          disabled={cancelMutation.isPending}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-60">
              <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-[#122222]/40 dark:text-white/40 mb-6">
                <Bookmark size={40} />
              </div>
              <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-2">No reservations found</h2>
              <p className="text-[14px] text-[#122222]/60 dark:text-white/60">Hold requests will appear here when members reserve items.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative">
      <select className="appearance-none bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 pl-3 pr-8 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-[#1a4d40]/30 transition-colors">
        <option>{placeholder}</option>
      </select>
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#122222]/40">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
