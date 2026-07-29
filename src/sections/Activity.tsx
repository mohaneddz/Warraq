import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Calendar, Download, RefreshCw, Eye, Tag, User, BookOpen, Clock, Activity, Info, Copy
} from "lucide-react";
import { useContextMenu } from "../components/ui/ContextMenu";

import { auditLog } from "../data/repositories/library";
import { toast } from "sonner";
import Papa from "papaparse";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../store/uiStore";
import { formatDisplayDate } from "../utils/dates";
import { Modal, Button } from "../components/ui/primitives";
import { useThemedAsset } from "../utils/useThemedAsset";

export function ActivityPage() {
  const { t } = useTranslation();
  const prefs = useUiStore((state) => state.preferences);
  const medalSrc = useThemedAsset("activity-medal");
  const [term, setTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("All Users");
  const [actionFilter, setActionFilter] = useState("All Actions");
  const [entityFilter, setEntityFilter] = useState("All Entities");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const { showContextMenu } = useContextMenu();


  const handleActivityContextMenu = (e: React.MouseEvent, item: any) => {
    showContextMenu(e, [
      {
        id: "inspect-log",
        label: t("activity.inspectLog", "Inspect Details"),
        icon: Eye,
        onClick: () => setSelectedLog(item),
      },
      {
        id: "copy-action",
        label: t("activity.copyAction", "Copy Action Name"),
        icon: Copy,
        onClick: () => {
          navigator.clipboard.writeText(item.action);
          toast.success(t("activity.copiedAction", "Action copied"));
        },
      },
      {
        id: "copy-entity",
        label: t("activity.copyEntity", "Copy Entity ID"),
        icon: Copy,
        onClick: () => {
          navigator.clipboard.writeText(item.entity_id);
          toast.success(t("activity.copiedEntity", "Entity ID copied"));
        },
      },
      { divider: true },
      {
        id: "refresh-logs",
        label: t("activity.refreshLogs", "Refresh Activity History"),
        icon: RefreshCw,
        onClick: () => {
          result.refetch();
          toast.success(t("activity.refreshed", "Logs refreshed"));
        },
      },
    ], { title: `${item.action} (${item.entity_type})` });
  };

  const result = useQuery({ queryKey: ["activity"], queryFn: () => auditLog(500) });


  // Dynamic filter dropdown lists
  const usersList = useMemo(() => {
    if (!result.data) return [];
    return Array.from(new Set(result.data.map(l => l.actor).filter(Boolean)));
  }, [result.data]);

  const actionsList = useMemo(() => {
    if (!result.data) return [];
    return Array.from(new Set(result.data.map(l => l.action).filter(Boolean)));
  }, [result.data]);

  const entityTypesList = useMemo(() => {
    if (!result.data) return [];
    return Array.from(new Set(result.data.map(l => l.entity_type).filter(Boolean)));
  }, [result.data]);

  // Filtered log entries
  const filteredLogs = useMemo(() => {
    if (!result.data) return [];
    return result.data.filter(l => {
      // Search term matching in basic fields & JSON payload
      if (term.trim()) {
        const q = term.toLowerCase().trim();
        const matches =
          l.action.toLowerCase().includes(q) ||
          l.actor.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q) ||
          l.entity_id.toLowerCase().includes(q) ||
          (l.after_json && l.after_json.toLowerCase().includes(q)) ||
          (l.before_json && l.before_json.toLowerCase().includes(q));
        if (!matches) return false;
      }
      // Date filter
      if (dateFilter) {
        if (l.created_at.substring(0, 10) !== dateFilter) return false;
      }
      // User filter
      if (actorFilter !== "All Users") {
        if (l.actor !== actorFilter) return false;
      }
      // Action filter
      if (actionFilter !== "All Actions") {
        if (l.action !== actionFilter) return false;
      }
      // Entity type filter
      if (entityFilter !== "All Entities") {
        if (l.entity_type.toLowerCase() !== entityFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [result.data, term, dateFilter, actorFilter, actionFilter, entityFilter]);

  // Statistics metrics for filtered view (using primary green design system)
  const metrics = useMemo(() => {
    if (!filteredLogs) return { total: 0, loans: 0, reservations: 0, members: 0, catalog: 0 };
    let loans = 0, reservations = 0, members = 0, catalog = 0;
    filteredLogs.forEach(l => {
      const type = l.entity_type.toLowerCase();
      if (type === "loan") loans++;
      else if (type === "reservation") reservations++;
      else if (type === "member") members++;
      else if (type === "book" || type === "copy") catalog++;
    });
    return { total: filteredLogs.length, loans, reservations, members, catalog };
  }, [filteredLogs]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredLogs.length) {
      toast.warning(t("activity.alerts.noActivitiesToExport") || "No activities match the current filters to export.");
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
        "Entity ID": l.entity_id,
        Details: l.after_json || ""
      }));

      const csvContent = Papa.unparse(csvData);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const timestamp = `${year}-${month}-${day}_${now.getHours()}-${now.getMinutes()}`;

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `warraq_audit_logs_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t("activity.alerts.exportSuccess", { count: filteredLogs.length }) || `Successfully exported ${filteredLogs.length} audit logs as CSV.`);
    } catch (e: any) {
      toast.error(t("activity.alerts.exportFailed", { error: e.message }) || "Failed to export CSV: " + e.message);
    }
  };

  return (
    <div className="flex flex-col h-full w-full text-[13px]">
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">
            {t("activity.title")}
          </h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">
            {t("activity.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-4 py-2 rounded-xl font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-card cursor-pointer"
          >
            <Download size={16} /> {t("activity.exportCsv") || "Export CSV"}
          </button>
        </div>
      </div>

      {/* Summary Metric Pills (Primary Emerald Green Theme) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 p-3 rounded-2xl shadow-card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light flex items-center justify-center shrink-0 font-bold">
            <Activity size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#122222]/50 dark:text-white/50 uppercase">Total Logged</div>
            <div className="text-[16px] font-bold text-[#122222] dark:text-white">{metrics.total}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 p-3 rounded-2xl shadow-card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light flex items-center justify-center shrink-0 font-bold">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#122222]/50 dark:text-white/50 uppercase">Loans & Circulation</div>
            <div className="text-[16px] font-bold text-[#122222] dark:text-white">{metrics.loans}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 p-3 rounded-2xl shadow-card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light flex items-center justify-center shrink-0 font-bold">
            <Tag size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#122222]/50 dark:text-white/50 uppercase">Reservations</div>
            <div className="text-[16px] font-bold text-[#122222] dark:text-white">{metrics.reservations}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 p-3 rounded-2xl shadow-card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light flex items-center justify-center shrink-0 font-bold">
            <User size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#122222]/50 dark:text-white/50 uppercase">Members</div>
            <div className="text-[16px] font-bold text-[#122222] dark:text-white">{metrics.members}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 p-3 rounded-2xl shadow-card flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light flex items-center justify-center shrink-0 font-bold">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#122222]/50 dark:text-white/50 uppercase">Catalog & Copies</div>
            <div className="text-[16px] font-bold text-[#122222] dark:text-white">{metrics.catalog}</div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-[#fcfbf8] dark:bg-[#111d1a] flex-wrap">
          <div className="flex-1 max-w-sm relative min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input
              type="text"
              placeholder={t("activity.searchPlaceholder") || "Search activity logs..."}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-xl py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-xl py-1.5 px-3">
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

          {/* Entity Type Filter */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-xl py-2 px-3 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Entities">All Entities</option>
            {entityTypesList.map(ent => (
              <option key={ent} value={ent}>{ent.toUpperCase()}</option>
            ))}
          </select>

          {/* User Filter Dropdown */}
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-xl py-2 px-3 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Users">{t("activity.allUsers") || "All Users"}</option>
            {usersList.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>

          {/* Action Filter Dropdown */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-xl py-2 px-3 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Actions">{t("activity.allActions") || "All Actions"}</option>
            {actionsList.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto font-sans">
          {result.isLoading ? (
            <div className="flex items-center justify-center py-20 text-zinc-500 text-[13px]">
              <RefreshCw size={16} className="animate-spin mr-2" /> {t("activity.loading") || "Loading audit history..."}
            </div>
          ) : filteredLogs.length ? (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider select-none">
                <tr>
                  <th className="px-6 py-3">{t("activity.time") || "Timestamp"}</th>
                  <th className="px-6 py-3">{t("activity.actor") || "Operator"}</th>
                  <th className="px-6 py-3">{t("activity.action") || "Action"}</th>
                  <th className="px-6 py-3">{t("activity.entity") || "Target Entity"}</th>
                  <th className="px-6 py-3">Details / Context</th>
                  <th className="px-6 py-3 w-16 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredLogs.map((item) => {
                  const detailsObj = parseJsonDetails(item.after_json);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedLog(item)}
                      onContextMenu={(e) => handleActivityContextMenu(e, item)}
                      className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                    >

                      <td className="px-6 py-3">
                        <div className="font-semibold text-[#122222] dark:text-white">
                          {new Date(item.created_at).toLocaleTimeString(prefs.locale === "ar" ? "ar-DZ" : prefs.locale === "fr" ? "fr-FR" : "en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5">{formatDisplayDate(item.created_at)}</div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald dark:bg-emerald-light text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                            {item.actor.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-[#122222] dark:text-white">{item.actor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <ActionBadge action={item.action} />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[11px] uppercase tracking-wider text-[#122222]/70 dark:text-white/70 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md">
                            {item.entity_type}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-emerald dark:text-emerald-light">
                            {item.entity_id.slice(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-[#122222]/80 dark:text-white/80 max-w-xs">
                        <div className="truncate font-medium text-[12px]" title={item.after_json || ""}>
                          {formatSummaryDetails(detailsObj, item.after_json)}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(item);
                          }}
                          className="p-1.5 rounded-lg text-[#122222]/40 hover:text-emerald hover:bg-emerald/10 transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 opacity-90">
              <img src={medalSrc} alt="" aria-hidden="true" className="h-84 w-auto object-contain mb-3" />
              <h2 className="text-[20px] font-bold text-[#122222] dark:text-white mb-2">{t("activity.noActivity") || "No Activity Recorded"}</h2>
              <p className="text-[14px] text-[#122222]/60 dark:text-white/60">{t("activity.noActivityHelp") || "Activities will automatically appear here as operations take place."}</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Log Details Inspection Modal */}
      <ActivityDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  let colorClass = "bg-emerald/10 text-emerald dark:bg-emerald-light/20 dark:text-emerald-light border border-emerald/20";
  const act = action.toLowerCase();

  if (act.includes("delete") || act.includes("remove") || act.includes("archive") || act.includes("cancel")) {
    colorClass = "bg-red-500/10 text-red-500 border border-red-500/20";
  } else if (act.includes("return") || act.includes("update") || act.includes("renew") || act.includes("extend")) {
    colorClass = "bg-emerald/15 text-emerald dark:text-emerald-light border border-emerald/30 font-semibold";
  }

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${colorClass}`}>
      {action}
    </span>
  );
}

function parseJsonDetails(jsonStr?: string | null): any {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch (_) {
    return null;
  }
}

function formatSummaryDetails(obj: any, raw?: string | null): string {
  if (!obj) return raw || "—";
  if (obj.title) return `Title: ${obj.title}`;
  if (obj.book_title) return `Book: ${obj.book_title}`;
  if (obj.full_name) return `Member: ${obj.full_name} (${obj.member_number || ""})`;
  if (obj.member_name) return `Member: ${obj.member_name}`;
  if (obj.code) return `Shelf Code: ${obj.code} (${obj.section || ""})`;
  if (obj.copyIds) return `Copies: ${Array.isArray(obj.copyIds) ? obj.copyIds.join(", ") : obj.copyIds}`;
  return JSON.stringify(obj);
}

function ActivityDetailsModal({ log, onClose }: { log: any | null; onClose: () => void }) {
  if (!log) return null;
  const detailsObj = parseJsonDetails(log.after_json);

  return (
    <Modal
      isOpen={!!log}
      onClose={onClose}
      title="Audit Log Entry Details"
      size="md"
    >
      <div className="space-y-5 text-[13px]">
        {/* Header Summary */}
        <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#122222]/50 dark:text-white/50">Audit Action</div>
            <div className="font-bold text-[15px] text-[#122222] dark:text-white flex items-center gap-2 mt-0.5">
              <ActionBadge action={log.action} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#122222]/50 dark:text-white/50 font-semibold">{formatDisplayDate(log.created_at)}</div>
            <div className="text-[12px] font-mono text-[#122222]/70 dark:text-white/70">
              {new Date(log.created_at).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div className="border border-black/10 dark:border-white/10 rounded-xl p-3 bg-white dark:bg-[#1d2926]">
            <span className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase block mb-1">Operator / Actor</span>
            <span className="font-semibold text-[#122222] dark:text-white">{log.actor}</span>
          </div>

          <div className="border border-black/10 dark:border-white/10 rounded-xl p-3 bg-white dark:bg-[#1d2926]">
            <span className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase block mb-1">Entity Type</span>
            <span className="font-bold uppercase text-emerald dark:text-emerald-light">{log.entity_type}</span>
          </div>

          <div className="col-span-2 border border-black/10 dark:border-white/10 rounded-xl p-3 bg-white dark:bg-[#1d2926]">
            <span className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase block mb-1">Full Entity ID</span>
            <span className="font-mono text-[12px] text-[#122222] dark:text-white select-all">{log.entity_id}</span>
          </div>
        </div>

        {/* JSON Payload Details */}
        <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 bg-white dark:bg-[#1d2926] space-y-2">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#122222]/60 dark:text-white/60 flex items-center gap-1.5">
            <Info size={14} className="text-emerald" />
            Payload Metadata & Parameters
          </h4>

          {detailsObj ? (
            <div className="bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/5 dark:border-white/5 p-3 rounded-xl space-y-1.5 text-[12px] font-mono overflow-x-auto max-h-48">
              {Object.entries(detailsObj).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                  <span className="text-[#122222]/60 dark:text-white/60 font-semibold">{key}:</span>
                  <span className="text-emerald dark:text-emerald-light font-bold">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="bg-[#fcfbf8] dark:bg-[#111d1a] p-3 rounded-xl text-[11px] font-mono text-[#122222]/70 dark:text-white/70 overflow-x-auto">
              {log.after_json || "No payload metadata stored."}
            </pre>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
