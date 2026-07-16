import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ClipboardList, Search, Calendar, Download, RefreshCw
} from "lucide-react";
import { auditLog } from "../data/repositories/library";
import { toast } from "sonner";
import Papa from "papaparse";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../store/uiStore";
import { formatDisplayDate } from "../utils/dates";

export function ActivityPage() {
  const { t } = useTranslation();
  const prefs = useUiStore((state) => state.preferences);
  const [term, setTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("All Users");
  const [actionFilter, setActionFilter] = useState("All Actions");

  const result = useQuery({ queryKey: ["activity"], queryFn: auditLog }); 

  // Extract users (actors) dynamically
  const usersList = useMemo(() => {
    if (!result.data) return [];
    return Array.from(new Set(result.data.map(l => l.actor).filter(Boolean)));
  }, [result.data]);

  // Extract actions dynamically
  const actionsList = useMemo(() => {
    if (!result.data) return [];
    return Array.from(new Set(result.data.map(l => l.action).filter(Boolean)));
  }, [result.data]);

  // Combine filters
  const filteredLogs = useMemo(() => {
    if (!result.data) return [];
    return result.data.filter(l => {
      // Term
      if (term.trim()) {
        const q = term.toLowerCase().trim();
        const matches = 
          l.action.toLowerCase().includes(q) || 
          l.actor.toLowerCase().includes(q) || 
          l.entity_type.toLowerCase().includes(q) || 
          l.entity_id.toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Date
      if (dateFilter) {
        if (l.created_at.substring(0, 10) !== dateFilter) return false;
      }
      // Actor
      if (actorFilter !== "All Users") {
        if (l.actor !== actorFilter) return false;
      }
      // Action
      if (actionFilter !== "All Actions") {
        if (l.action !== actionFilter) return false;
      }
      return true;
    });
  }, [result.data, term, dateFilter, actorFilter, actionFilter]);

  // Export filtered logs to CSV
  const handleExportCSV = () => {
    if (!filteredLogs.length) {
      toast.warning("No activities match the current filters to export.");
      return;
    }

    try {
      const csvData = filteredLogs.map(l => ({
        ID: l.id,
        Timestamp: l.created_at,
        Date: new Date(l.created_at).toLocaleDateString(),
        Time: new Date(l.created_at).toLocaleTimeString(),
        Actor: l.actor,
        Action: l.action,
        "Entity Type": l.entity_type,
        "Entity ID": l.entity_id
      }));

      const csvContent = Papa.unparse(csvData);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `warraq_audit_log_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Successfully exported ${filteredLogs.length} audit logs as CSV.`);
    } catch (e: any) {
      toast.error("Failed to export CSV: " + e.message);
    }
  };

  return (
    <div className="flex flex-col h-full w-full text-[13px]">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("activity.title")}</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("activity.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-card cursor-pointer"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a] flex-wrap md:flex-nowrap">
          <div className="flex-1 max-w-sm relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input 
              type="text" 
              placeholder={t("activity.searchPlaceholder")} 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald" 
            />
          </div>

          {/* Date Picker Filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-1.5 px-3">
             <Calendar size={14} className="text-[#122222]/40" />
             <input 
               type="date"
               value={dateFilter}
               onChange={(e) => setDateFilter(e.target.value)}
               className="bg-transparent text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer"
             />
             {dateFilter && (
               <button onClick={() => setDateFilter("")} className="text-red-500 hover:text-red-700 ml-1 text-xs cursor-pointer">Clear</button>
             )}
          </div>

          {/* User Filter Dropdown */}
          <select 
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Users">All Users</option>
            {usersList.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>

          {/* Action Filter Dropdown */}
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Actions">All Actions</option>
            {actionsList.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto font-sans">
          {result.isLoading ? (
            <div className="flex items-center justify-center py-20 text-zinc-500 text-[13px]">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading audit history...
            </div>
          ) : filteredLogs.length ? (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">{t("activity.time")}</th>
                  <th className="px-6 py-3">{t("activity.actor")}</th>
                  <th className="px-6 py-3">{t("activity.action")}</th>
                  <th className="px-6 py-3">{t("activity.entity")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="font-semibold text-[#122222] dark:text-white">
                        {new Date(item.created_at).toLocaleTimeString(prefs.locale === "ar" ? "ar-DZ" : prefs.locale === "fr" ? "fr-FR" : "en-US", {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5">{formatDisplayDate(item.created_at)}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald dark:bg-emerald-light text-white flex items-center justify-center text-[10px] font-bold">
                          {item.actor.substring(0,2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-[#122222] dark:text-white">{item.actor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <ActionBadge action={item.action} />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[#122222]/70 dark:text-white/70">{item.entity_type}</span>
                        <span className="text-[11px] font-mono font-bold text-emerald dark:text-emerald-light bg-emerald/10 dark:bg-emerald-light/10 px-1.5 py-0.5 rounded">
                          {item.entity_id.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-60">
              <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-[#122222]/40 dark:text-white/40 mb-6">
                <ClipboardList size={40} />
              </div>
              <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-2">{t("activity.noActivity")}</h2>
              <p className="text-[14px] text-[#122222]/60 dark:text-white/60">{t("activity.noActivityHelp")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  let colorClass = "bg-black/5 dark:bg-white/5 text-[#122222]/70 dark:text-white/70";
  
  if (action.includes("Create") || action.includes("Add") || action.includes("Checkout") || action.includes("register")) {
    colorClass = "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light";
  } else if (action.includes("Return") || action.includes("Update") || action.includes("Renew") || action.includes("saved") || action.includes("update")) {
    colorClass = "bg-copper/10 text-copper";
  } else if (action.includes("Delete") || action.includes("Remove") || action.includes("Archive")) {
    colorClass = "bg-red-500/10 text-red-500";
  }

  return (
    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${colorClass}`}>
      {action}
    </span>
  );
}
