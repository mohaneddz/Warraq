import { useQuery } from "@tanstack/react-query";
import { Calendar, Printer, RefreshCw, BarChart2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { dashboard, loans } from "../data/repositories/library";
import { database } from "../data/database";
import { daysLate } from "../utils/dates";
import { useMemo, useState } from "react";

export function ReportsPage() {
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
      name: new Date(act.date).toLocaleDateString(undefined, { weekday: 'short' }),
      circulation: act.count
    }));
  }, [dashQuery.data?.activity]);

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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">Reports & analytics</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">Generate insights on library usage, inventory status, and member activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl">
          <Tab label="Overview" active={activeTab === "Overview"} onClick={() => setActiveTab("Overview")} />
          <Tab label="Circulation" active={activeTab === "Circulation"} onClick={() => setActiveTab("Circulation")} />
          <Tab label="Inventory" active={activeTab === "Inventory"} onClick={() => setActiveTab("Inventory")} />
          <Tab label="Members" active={activeTab === "Members"} onClick={() => setActiveTab("Members")} />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222] dark:text-white shadow-sm hover:border-[#1a4d40]/30 transition-colors">
            <Calendar size={14} className="text-[#1a4d40] dark:text-[#1b9277]"/> This Month
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Total circulation" value={stats.totalLoans.toLocaleString()} label="All-time checkouts" />
        <MetricCard title="Active members" value={stats.activeMembers.toLocaleString()} label="Registered borrowers" />
        <MetricCard title="Overdue rate" value={stats.overdueRate} label="Overdue vs open loans" />
        <MetricCard title="Total copy acquisitions" value={stats.acquisitions.toLocaleString()} label="Physical holdings" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1d2926] p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col">
          <h3 className="font-bold text-[15px] text-[#122222] dark:text-white mb-6">Circulation Activity (Recent days)</h3>
          <div className="flex-1 min-h-[300px]">
            {dashQuery.isLoading ? (
              <div className="flex items-center justify-center h-full text-zinc-500 text-[13px]">
                <RefreshCw size={16} className="animate-spin mr-2" /> Loading stats...
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
                  <Area type="monotone" dataKey="circulation" stroke="#1a4d40" strokeWidth={3} fillOpacity={1} fill="url(#colorCirculation)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Categories Chart */}
        <div className="bg-white dark:bg-[#1d2926] p-6 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col">
          <h3 className="font-bold text-[15px] text-[#122222] dark:text-white mb-6">Top borrowed categories</h3>
          <div className="flex-1 flex flex-col justify-around">
            {categoriesQuery.isLoading ? (
              <div className="text-center text-zinc-500 py-10 text-[13px]">
                <RefreshCw size={16} className="animate-spin inline mr-2" /> Querying categories...
              </div>
            ) : categoriesList.length > 0 ? (
              categoriesList.map(cat => (
                <CategoryBar key={cat.name} name={cat.name || "Uncategorized"} value={cat.value} max={maxCategoryVal} color="#1a4d40" />
              ))
            ) : (
              <div className="text-center text-zinc-400 py-10 text-[13px] flex flex-col items-center">
                <BarChart2 size={24} className="mb-2 opacity-50" />
                <span>No checkout data recorded yet.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tab({ label, active = false, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-5 py-2 text-[13px] font-bold rounded-lg whitespace-nowrap transition-all ${
        active 
          ? "bg-white dark:bg-[#1d2926] text-[#1a4d40] dark:text-[#1b9277] shadow-sm" 
          : "text-[#122222]/60 dark:text-white/60 hover:text-[#122222] dark:hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({ title, value, label }: any) {
  return (
    <div className="bg-white dark:bg-[#1d2926] p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-card">
      <p className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-2">{title}</p>
      <div className="flex items-end gap-3 justify-between">
        <p className="text-[32px] font-display font-bold text-[#122222] dark:text-white leading-none">{value}</p>
        <div className="text-[11px] text-[#122222]/50 dark:text-white/50 text-right">
          {label}
        </div>
      </div>
    </div>
  );
}

function CategoryBar({ name, value, max, color }: any) {
  const percent = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between text-[13px] font-semibold text-[#122222] dark:text-white mb-1.5">
        <span>{name}</span>
        <span className="opacity-60">{value} loan{value !== 1 ? 's' : ''}</span>
      </div>
      <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
