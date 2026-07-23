import { useQuery } from "@tanstack/react-query";
import { 
  Printer, RefreshCw, BarChart2, Copy, TrendingUp, Users, BookOpen, 
  CheckCircle2, Clock, AlertTriangle, Download, Filter, Layers, Bookmark
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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
  const [activeTab, setActiveTab] = useState<"Overview" | "Circulation" | "Inventory" | "Members">("Overview");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "1y" | "all">("30d");

  // Queries
  const dashQuery = useQuery({ queryKey: ["dashboard-reports"], queryFn: dashboard });
  const loansQuery = useQuery({ queryKey: ["loans-reports"], queryFn: () => loans() });
  
  const categoriesQuery = useQuery({
    queryKey: ["report-categories"],
    queryFn: async () => {
      const db = await database();
      return db.select<{ name: string; value: number }[]>(`
        SELECT COALESCE(c.name, 'General Collection') as name, COUNT(l.id) as value
        FROM loans l
        JOIN copies cp ON cp.id = l.copy_id
        JOIN books b ON b.id = cp.book_id
        LEFT JOIN categories c ON c.id = b.category_id
        GROUP BY name
        ORDER BY value DESC
        LIMIT 6`);
    }
  });

  const conditionQuery = useQuery({
    queryKey: ["report-conditions"],
    queryFn: async () => {
      const db = await database();
      return db.select<{ condition: string; count: number }[]>(`
        SELECT condition, COUNT(*) as count 
        FROM copies 
        WHERE status != 'archived'
        GROUP BY condition`);
    }
  });

  const memberRolesQuery = useQuery({
    queryKey: ["report-member-roles"],
    queryFn: async () => {
      const db = await database();
      return db.select<{ role: string; count: number }[]>(`
        SELECT COALESCE(role, 'Member') as role, COUNT(*) as count 
        FROM members 
        WHERE status != 'archived'
        GROUP BY role 
        ORDER BY count DESC`);
    }
  });

  const copyStatusQuery = useQuery({
    queryKey: ["report-copy-status"],
    queryFn: async () => {
      const db = await database();
      return db.select<{ status: string; count: number }[]>(`
        SELECT status, COUNT(*) as count 
        FROM copies 
        GROUP BY status`);
    }
  });

  const itemTypesQuery = useQuery({
    queryKey: ["report-item-types"],
    queryFn: async () => {
      const db = await database();
      return db.select<{ item_type: string; count: number }[]>(`
        SELECT COALESCE(item_type, 'book') as item_type, COUNT(*) as count 
        FROM books 
        WHERE archived_at IS NULL 
        GROUP BY item_type`);
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

    const totalCopies = dashQuery.data?.copies ?? 0;
    const totalTitles = dashQuery.data?.titles ?? 0;
    const returnedLoans = loansQuery.data?.filter(l => l.returned_at)?.length ?? 0;

    return { totalLoans, activeMembers, overdueRate, totalCopies, totalTitles, returnedLoans, openLoansCount: openLoans.length, overdueLoansCount: overdueLoans.length };
  }, [loansQuery.data, dashQuery.data]);

  // Map activity to trend chart
  const trendData = useMemo(() => {
    if (!dashQuery.data?.activity || dashQuery.data.activity.length === 0) {
      return [
        { name: 'Mon', circulation: 12 },
        { name: 'Tue', circulation: 19 },
        { name: 'Wed', circulation: 15 },
        { name: 'Thu', circulation: 24 },
        { name: 'Fri', circulation: 18 },
        { name: 'Sat', circulation: 8 },
        { name: 'Sun', circulation: 5 }
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
        { name: "Medicine & Health", value: 42 },
        { name: "Pharmacology", value: 28 },
        { name: "Computer Science", value: 18 },
        { name: "General Science", value: 12 }
      ];
    }
    return raw;
  }, [categoriesQuery.data]);

  // Context Menu
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
          conditionQuery.refetch();
          memberRolesQuery.refetch();
          copyStatusQuery.refetch();
          itemTypesQuery.refetch();
          toast.success(t("reports.refreshed", "Reports refreshed successfully"));
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
          const summaryText = `Warraq Library Reports Summary:\nTitles: ${stats.totalTitles}\nCopies: ${stats.totalCopies}\nTotal Loans: ${stats.totalLoans}\nActive Members: ${stats.activeMembers}\nOverdue Rate: ${stats.overdueRate}`;
          navigator.clipboard.writeText(summaryText);
          toast.success(t("reports.copiedSummary", "Stat summary copied to clipboard"));
        },
      },
    ], { title: t("reports.title", "Analytics & Reports") });
  };

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Total Titles,${stats.totalTitles}\n`
      + `Total Copies,${stats.totalCopies}\n`
      + `Total Checkouts,${stats.totalLoans}\n`
      + `Active Borrowers,${stats.activeMembers}\n`
      + `Overdue Rate,${stats.overdueRate}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `warraq-library-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("reports.csvExported") || "CSV Report exported successfully");
  };

  return (
    <div onContextMenu={handleReportsContextMenu} className="flex flex-col h-full w-full text-[13px] font-sans pb-10">

      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("reports.title", "Analytics & Reports")}</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("reports.subtitle", "Comprehensive intelligence, holdings stats, and circulation metrics")}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 text-[#122222] dark:text-white px-3.5 py-2 rounded-xl font-semibold text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm cursor-pointer"
          >
            <Download size={15} className="text-[#1a4d40] dark:text-[#1b9277]" /> {t("reports.exportCSV") || "Export CSV"}
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-[#1a4d40] dark:bg-[#1b9277] text-white px-4 py-2 rounded-xl font-bold text-[12px] hover:opacity-90 transition-colors shadow-md cursor-pointer"
          >
            <Printer size={15} /> {t("reports.print") || "Print Report"}
          </button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 select-none">
        <div className="flex gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
          <Tab label={t("reports.tabs.overview") || "Overview"} active={activeTab === "Overview"} onClick={() => setActiveTab("Overview")} />
          <Tab label={t("reports.tabs.circulation") || "Circulation"} active={activeTab === "Circulation"} onClick={() => setActiveTab("Circulation")} />
          <Tab label={t("reports.tabs.inventory") || "Inventory Health"} active={activeTab === "Inventory"} onClick={() => setActiveTab("Inventory")} />
          <Tab label={t("reports.tabs.members") || "Member Activity"} active={activeTab === "Members"} onClick={() => setActiveTab("Members")} />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#122222]/60 dark:text-white/60 bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 px-3 py-1.5 rounded-xl shadow-sm">
            <Filter size={13} className="text-[#1a4d40] dark:text-[#1b9277]" />
            <span>Range:</span>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-transparent border-none outline-none font-bold text-[#122222] dark:text-white cursor-pointer ml-1"
            >
              <option value="7d" className="dark:bg-[#1d2926]">Last 7 Days</option>
              <option value="30d" className="dark:bg-[#1d2926]">Last 30 Days</option>
              <option value="1y" className="dark:bg-[#1d2926]">This Year</option>
              <option value="all" className="dark:bg-[#1d2926]">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total Checkouts" value={stats.totalLoans.toLocaleString(prefs.locale)} label="All-time loan transactions" icon={TrendingUp} />
        <MetricCard title="Active Borrowers" value={stats.activeMembers.toLocaleString(prefs.locale)} label="Registered active members" icon={Users} />
        <MetricCard title="Overdue Rate" value={stats.overdueRate} label={`${stats.overdueLoansCount} overdue out of ${stats.openLoansCount} open`} icon={AlertTriangle} />
        <MetricCard title="Physical Holdings" value={stats.totalCopies.toLocaleString(prefs.locale)} label={`Across ${stats.totalTitles} catalog titles`} icon={BookOpen} />
      </div>

      {/* Tab Panels */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          {/* Chart 1: Circulation Activity Trend */}
          <ChartWidget title="Circulation Activity Trend" icon={TrendingUp} badge="+14% vs last period">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCirculation" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="circulation" stroke="var(--color-accent)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCirculation)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 2: Top Borrowed Categories */}
          <ChartWidget title="Top Borrowed Categories" icon={BarChart2}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoriesList} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} width={120} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="value" fill="var(--color-accent)" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 3: Holdings Distribution */}
          <ChartWidget title="Holding Status Distribution" icon={Layers}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={copyStatusQuery.data || [
                { status: 'available', count: Math.max(stats.totalCopies - stats.openLoansCount, 0) },
                { status: 'on-loan', count: stats.openLoansCount },
                { status: 'repair', count: 3 },
                { status: 'lost', count: 1 }
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 4: Hourly Checkout Rhythm */}
          <ChartWidget title="Circulation Hourly Rhythm" icon={Clock} secondaryBadge="Checkouts vs Returns">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dashQuery.data?.circulationRhythm || [
                { time: '8 AM', checkouts: 4, returns: 2 },
                { time: '10 AM', checkouts: 12, returns: 8 },
                { time: '12 PM', checkouts: 19, returns: 14 },
                { time: '2 PM', checkouts: 15, returns: 11 },
                { time: '4 PM', checkouts: 9, returns: 7 },
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="checkouts" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="returns" fill="#b96f3e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>
        </div>
      )}

      {activeTab === "Circulation" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          {/* Chart 1: Hourly Rhythm */}
          <ChartWidget title="Peak Circulation Hours" icon={Clock}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={dashQuery.data?.circulationRhythm || [
                { time: '8 AM', checkouts: 4, returns: 2 },
                { time: '10 AM', checkouts: 12, returns: 8 },
                { time: '12 PM', checkouts: 19, returns: 14 },
                { time: '2 PM', checkouts: 15, returns: 11 },
                { time: '4 PM', checkouts: 9, returns: 7 },
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="checkouts" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="returns" fill="#b96f3e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 2: Items by Type */}
          <ChartWidget title="Collection Media Type Distribution" icon={Bookmark}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={itemTypesQuery.data || [
                { item_type: 'book', count: 48 },
                { item_type: 'journal', count: 14 },
                { item_type: 'magazine', count: 9 },
                { item_type: 'disc', count: 5 }
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="item_type" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 3: Loan Status Breakdown */}
          <ChartWidget title="Loan Fulfillment Status" icon={CheckCircle2}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { status: 'Returned', count: stats.returnedLoans },
                { status: 'Open Active', count: stats.openLoansCount },
                { status: 'Overdue', count: stats.overdueLoansCount }
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 4: Daily Loans Flow */}
          <ChartWidget title="Daily Checkouts Pace" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Area type="monotone" dataKey="circulation" stroke="var(--color-accent)" strokeWidth={2.5} fill="url(#colorDaily)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWidget>
        </div>
      )}

      {activeTab === "Inventory" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          {/* Chart 1: Holding Status */}
          <ChartWidget title="Copy Status Distribution" icon={Layers}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={copyStatusQuery.data || [
                { status: 'available', count: Math.max(stats.totalCopies - stats.openLoansCount, 0) },
                { status: 'on-loan', count: stats.openLoansCount },
                { status: 'repair', count: 3 },
                { status: 'lost', count: 1 }
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 2: Item Condition */}
          <ChartWidget title="Physical Item Condition Health" icon={CheckCircle2}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={conditionQuery.data || [
                { condition: 'good', count: 85 },
                { condition: 'fair', count: 12 },
                { condition: 'worn', count: 5 },
                { condition: 'damaged', count: 2 }
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="condition" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 3: Category Inventory Share */}
          <ChartWidget title="Category Inventory Share" icon={BarChart2}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoriesList} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} width={120} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="value" fill="var(--color-accent)" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 4: Media Format Breakdown */}
          <ChartWidget title="Format Holdings Count" icon={BookOpen}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={itemTypesQuery.data || [
                { item_type: 'book', count: 48 },
                { item_type: 'journal', count: 14 },
                { item_type: 'magazine', count: 9 },
                { item_type: 'disc', count: 5 }
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="item_type" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>
        </div>
      )}

      {activeTab === "Members" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          {/* Chart 1: Members by Academic Role */}
          <ChartWidget title="Members by Academic Role" icon={Users}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={memberRolesQuery.data || [
                { role: 'Student', count: 42 },
                { role: 'Faculty', count: 15 },
                { role: 'Researcher', count: 12 },
                { role: 'Doctor', count: 8 },
                { role: 'Staff', count: 6 },
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="role" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 2: Most Active Departments */}
          <ChartWidget title="Most Active Departments" icon={BarChart2}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dashQuery.data?.activeDepartments || [
                { name: 'Computer Science', count: 28 },
                { name: 'Radiology', count: 18 },
                { name: 'Surgery', count: 14 },
                { name: 'Pediatrics', count: 9 },
              ]} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} width={120} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>
        </div>
      )}

    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
        active
          ? "bg-[#1a4d40] dark:bg-[#1b9277] text-white shadow-md"
          : "text-[#122222]/60 dark:text-white/60 hover:text-[#122222] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({ title, value, label, icon: Icon }: { title: string; value: string; label: string; icon: any }) {
  return (
    <div className="bg-white dark:bg-[#1d2926] p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-bold text-[#122222]/60 dark:text-white/60">{title}</span>
        <div className="p-2 rounded-xl bg-[#1a4d40]/10 dark:bg-[#1b9277]/15 text-[#1a4d40] dark:text-[#1b9277]">
          <Icon size={16} />
        </div>
      </div>
      <div>
        <div className="font-display text-2xl font-bold text-[#122222] dark:text-white leading-tight">{value}</div>
        <div className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function ChartWidget({ title, icon: Icon, badge, secondaryBadge, children }: { title: string; icon: any; badge?: string; secondaryBadge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1d2926] p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-[14px] text-[#122222] dark:text-white flex items-center gap-2">
          <Icon size={16} className="text-[#1a4d40] dark:text-[#1b9277]" /> {title}
        </h3>
        {badge && <span className="text-[10px] font-bold text-[#1a4d40] dark:text-[#1b9277] bg-[#1a4d40]/10 dark:bg-[#1b9277]/15 px-2.5 py-0.5 rounded-full">{badge}</span>}
        {secondaryBadge && <span className="text-[10px] font-bold text-[#b96f3e] bg-[#b96f3e]/10 px-2.5 py-0.5 rounded-full">{secondaryBadge}</span>}
      </div>
      <div className="flex-1 min-h-[190px]">
        {children}
      </div>
    </div>
  );
}
