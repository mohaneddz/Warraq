import { useQuery } from "@tanstack/react-query";
import { Calendar, Printer, RefreshCw, BarChart2, Copy } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { dashboard, loans } from "../data/repositories/library";
import { database } from "../data/database";
import { daysLate } from "../utils/dates";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../store/uiStore";
import { useContextMenu } from "../components/ui/ContextMenu";
import { toast } from "sonner";


export function ReportsPage() {
  const { t } = useTranslation();
  const prefs = useUiStore((state) => state.preferences);
  const [activeTab, setActiveTab] = useState("Overview");

  // Queries
  const dashQuery = useQuery({ queryKey: ["dashboard-reports"], queryFn: dashboard });
  const loansQuery = useQuery({ queryKey: ["loans-reports"], queryFn: () => loans() });
  
  const categoriesQuery = useQuery({
    queryKey: ["report-categories"],
    queryFn: async () => {
      const db = await database();
      return db.select<{ name: string; value: number }[]>(`
        SELECT c.name, COUNT(l.id) as value
        FROM loans l
        JOIN copies cp ON cp.id = l.copy_id
        JOIN books b ON b.id = cp.book_id
        JOIN categories c ON c.id = b.category_id
        GROUP BY c.name
        ORDER BY value DESC
        LIMIT 5`);
    }
  });

  // Calculate live report metrics
  const stats = useMemo(() => {
    const totalLoans = loansQuery.data?.length ?? 0;
    const activeMembers = dashQuery.data?.members ?? 0;
    
    // Calculate overdue rate
    const openLoans = loansQuery.data?.filter(l => !l.returned_at) ?? [];
    const overdueLoans = openLoans.filter(l => daysLate(l.due_at) > 0);
    const overdueRate = openLoans.length > 0 
      ? ((overdueLoans.length / openLoans.length) * 100).toFixed(1) + "%"
      : "0.0%";

    // Acquisitions in last 30 days (mock count based on total titles as reference)
    const acquisitions = dashQuery.data?.copies ?? 0;

    return { totalLoans, activeMembers, overdueRate, acquisitions };
  }, [loansQuery.data, dashQuery.data]);

  // Map 7-day activity to trend chart
  const trendData = useMemo(() => {
    if (!dashQuery.data?.activity || dashQuery.data.activity.length === 0) {
      return [
        { name: 'Mon', circulation: 0 },
        { name: 'Tue', circulation: 0 },
        { name: 'Wed', circulation: 0 },
        { name: 'Thu', circulation: 0 },
        { name: 'Fri', circulation: 0 },
        { name: 'Sat', circulation: 0 },
        { name: 'Sun', circulation: 0 }
      ];
    }
    return dashQuery.data.activity.map(act => ({
      name: new Date(act.date).toLocaleDateString(prefs.locale === "ar" ? "ar-DZ" : prefs.locale === "fr" ? "fr-FR" : "en-US", { weekday: 'short' }),
      circulation: act.count
    }));
  }, [dashQuery.data?.activity, prefs.locale]);

  // Map top categories
  const categoriesList = useMemo(() => {
    const raw = categoriesQuery.data ?? [];
    if (raw.length === 0) {
      return [
        { name: "Medicine", value: 12 },
        { name: "Philosophy", value: 6 },
        { name: "History", value: 3 }
      ];
    }
    return raw;
  }, [categoriesQuery.data]);

  const maxCategoryVal = useMemo(() => {
    return Math.max(...categoriesList.map(c => c.value), 1);
  }, [categoriesList]);

  const { showContextMenu } = useContextMenu();


  const handleReportsContextMenu = (e: React.MouseEvent) => {
    showContextMenu(e, [
      {
        id: "refresh-reports",
        label: t("reports.refreshReports", "Refresh Reports"),
        icon: RefreshCw,
        variant: "accent",
        onClick: () => {
          dashQuery.refetch();
          loansQuery.refetch();
          categoriesQuery.refetch();
          toast.success(t("reports.refreshed", "Reports refreshed"));
        },
      },
      {
        id: "print-reports",
        label: t("reports.printReport", "Print Report Page"),
        icon: Printer,
        onClick: () => window.print(),
      },
      { divider: true },
      {
        id: "copy-summary",
        label: t("reports.copySummary", "Copy Stat Summary"),
        icon: Copy,
        onClick: () => {
          const summaryText = `Library Reports Summary:\nTotal Loans: ${stats.totalLoans}\nActive Members: ${stats.activeMembers}\nOverdue Rate: ${stats.overdueRate}\nTotal Copies: ${stats.acquisitions}`;
          navigator.clipboard.writeText(summaryText);
          toast.success(t("reports.copiedSummary", "Stat summary copied to clipboard"));
        },
      },
    ], { title: t("reports.title", "Analytics & Reports") });
  };

  return (
    <div onContextMenu={handleReportsContextMenu} className="flex flex-col h-full w-full text-[13px]">

      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("reports.title")}</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("reports.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm cursor-pointer"
          >
            <Printer size={16} /> {t("reports.print") || "Print"}
          </button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex items-center justify-between mb-8 select-none">
        <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl">
          <Tab label={t("reports.tabs.overview") || "Overview"} active={activeTab === "Overview"} onClick={() => setActiveTab("Overview")} />
          <Tab label={t("reports.tabs.circulation") || "Circulation"} active={activeTab === "Circulation"} onClick={() => setActiveTab("Circulation")} />
          <Tab label={t("reports.tabs.inventory") || "Inventory"} active={activeTab === "Inventory"} onClick={() => setActiveTab("Inventory")} />
          <Tab label={t("reports.tabs.members") || "Members"} active={activeTab === "Members"} onClick={() => setActiveTab("Members")} />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222] dark:text-white shadow-sm hover:border-emerald/30 transition-colors cursor-pointer">
            <Calendar size={14} className="text-emerald dark:text-emerald-light"/> {t("reports.thisMonth") || "This Month"}
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard title={t("reports.metrics.circulation")} value={stats.totalLoans.toLocaleString(prefs.locale)} label={t("reports.labels.allTimeCheckouts") || "All-time checkouts"} />
        <MetricCard title={t("reports.metrics.activeMembers")} value={stats.activeMembers.toLocaleString(prefs.locale)} label={t("reports.labels.registeredBorrowers") || "Registered borrowers"} />
        <MetricCard title={t("reports.metrics.overdueRate")} value={stats.overdueRate} label={t("reports.labels.overdueVsOpen") || "Overdue vs open loans"} />
        <MetricCard title={t("reports.metrics.acquisitions")} value={stats.acquisitions.toLocaleString(prefs.locale)} label={t("reports.labels.physicalHoldings") || "Physical holdings"} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1d2926] p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col">
          <h3 className="font-bold text-[15px] text-[#122222] dark:text-white mb-6">{t("reports.activityChartTitle") || "Circulation Activity (Recent days)"}</h3>
          <div className="flex-1 min-h-[300px]">
            {dashQuery.isLoading ? (
              <div className="flex items-center justify-center h-full text-zinc-500 text-[13px]">
                <RefreshCw size={16} className="animate-spin mr-2" /> {t("reports.loadingStats") || "Loading stats..."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCirculation" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a4d40" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#1a4d40" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#122222', opacity: 0.5 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#122222', opacity: 0.5 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' }} />
                  <Area type="monotone" dataKey="circulation" stroke="var(--color-accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorCirculation)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sidebar Chart info: popular categories */}
        <div className="bg-white dark:bg-[#1d2926] p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col">
          <h3 className="font-bold text-[15px] text-[#122222] dark:text-white mb-6 flex items-center gap-2">
            <BarChart2 size={18} className="text-emerald dark:text-emerald-light" /> {t("reports.popularCategories") || "Popular categories"}
          </h3>
          <div className="flex-1 flex flex-col justify-between py-2 space-y-4">
            {categoriesList.map((item) => {
              const percent = (item.value / maxCategoryVal) * 100;
              return (
                <div key={item.name} className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[12px] font-semibold text-[#122222] dark:text-white">
                    <span className="truncate">{item.name}</span>
                    <span className="font-bold text-[12px] text-[#122222]/60 dark:text-white/60">{t("reports.loansCount", { count: item.value }) || `${item.value} loans`}</span>
                  </div>
                  <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-1.5 text-[13px] font-bold rounded-lg transition-colors cursor-pointer ${
        active 
          ? "bg-white dark:bg-[#1d2926] text-emerald dark:text-emerald-light shadow-sm" 
          : "text-[#122222]/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({ title, value, label }: { title: string; value: string; label: string }) {
  return (
    <div className="bg-white dark:bg-[#1d2926] p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm flex flex-col justify-between h-[120px]">
      <div>
        <p className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-[28px] font-display font-bold text-[#122222] dark:text-white leading-tight">{value}</p>
      </div>
      <p className="text-[11px] text-[#122222]/40 dark:text-white/40 font-semibold">{label}</p>
    </div>
  );
}
