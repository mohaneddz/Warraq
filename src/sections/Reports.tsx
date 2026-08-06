import { useQuery } from "@tanstack/react-query";
import { 
  Printer, RefreshCw, BarChart2, Copy, TrendingUp, Users, BookOpen, 
  CheckCircle2, Clock, AlertTriangle, Download, Filter, Layers, Bookmark
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

import { dashboard, loans } from "../data/repositories/library";
import { supabase, unwrap } from "../data/supabaseClient";
import { daysLate } from "../utils/dates";
import { useMemo, useRef, useState } from "react";
import { captureChart, waitForChartsToSettle } from "../utils/chartCapture";
import { useTranslation } from "react-i18next";

import { useUiStore } from "../store/uiStore";
import { useLibrarySettingsStore } from "../store/librarySettingsStore";
import { useContextMenu } from "../components/ui/ContextMenu";
import { toast } from "sonner";
import { generateReportsPdf } from "../utils/reportsPdf";

function countBy<T extends string>(values: (T | null | undefined)[], fallback: string): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const key = raw?.trim() || fallback;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function ReportsPage() {
  const { t } = useTranslation();
  const prefs = useUiStore((state) => state.preferences);
  const librarySettings = useLibrarySettingsStore((s) => s.settings);
  const [activeTab, setActiveTab] = useState<"Overview" | "Circulation" | "Inventory" | "Members">("Overview");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "1y" | "all">("30d");
  const [pdfExporting, setPdfExporting] = useState(false);
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Queries
  const dashQuery = useQuery({ queryKey: ["dashboard-reports"], queryFn: dashboard });
  const loansQuery = useQuery({ queryKey: ["loans-reports"], queryFn: () => loans() });
  
  const categoriesQuery = useQuery({
    queryKey: ["report-categories"],
    queryFn: async () => {
      const rows = unwrap<{ copies: { books: { categories: { name: string } | null } | null } | null }[]>(
        await supabase.from("loans").select("copies(books(categories(name)))")
      );
      return countBy(rows.map((r) => r.copies?.books?.categories?.name), "General Collection")
        .slice(0, 6)
        .map((c) => ({ name: c.name, value: c.count }));
    }
  });

  const conditionQuery = useQuery({
    queryKey: ["report-conditions"],
    queryFn: async () => {
      const rows = unwrap<{ condition: string }[]>(await supabase.from("copies").select("condition").neq("status", "archived"));
      return countBy(rows.map((r) => r.condition), "good").map((c) => ({ condition: c.name, count: c.count }));
    }
  });

  const memberRolesQuery = useQuery({
    queryKey: ["report-member-roles"],
    queryFn: async () => {
      const rows = unwrap<{ role: string | null }[]>(await supabase.from("members").select("role").neq("status", "archived"));
      return countBy(rows.map((r) => r.role), "Member").map((c) => ({ role: c.name, count: c.count }));
    }
  });

  const copyStatusQuery = useQuery({
    queryKey: ["report-copy-status"],
    queryFn: async () => {
      const rows = unwrap<{ status: string }[]>(await supabase.from("copies").select("status"));
      return countBy(rows.map((r) => r.status), "available").map((c) => ({ status: c.name, count: c.count }));
    }
  });

  const itemTypesQuery = useQuery({
    queryKey: ["report-item-types"],
    queryFn: async () => {
      const rows = unwrap<{ item_type: string | null }[]>(await supabase.from("books").select("item_type").is("archived_at", null));
      return countBy(rows.map((r) => r.item_type), "book").map((c) => ({ item_type: c.name, count: c.count }));
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

  // Map activity to trend chart — an empty week is real data (nothing circulated), not a
  // reason to substitute made-up numbers.
  const trendData = useMemo(() => {
    return (dashQuery.data?.activity ?? []).map(act => ({
      name: new Date(act.date).toLocaleDateString(prefs.locale === "ar" ? "ar-DZ" : prefs.locale === "fr" ? "fr-FR" : "en-US", { weekday: 'short' }),
      circulation: act.count
    }));
  }, [dashQuery.data?.activity, prefs.locale]);

  // Trend badge computed from the real week-over-week split instead of a fixed "+14%".
  const trendBadge = useMemo(() => {
    if (trendData.length < 2) return null;
    const mid = Math.floor(trendData.length / 2);
    const firstHalf = trendData.slice(0, mid).reduce((s, d) => s + d.circulation, 0);
    const secondHalf = trendData.slice(mid).reduce((s, d) => s + d.circulation, 0);
    if (firstHalf === 0) return secondHalf > 0 ? "+100%" : null;
    const pct = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}%`;
  }, [trendData]);

  // Map top categories — real data only; an empty catalog shows an empty chart.
  const categoriesList = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

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
        label: t("reports.printReport", "Export PDF Report"),
        icon: Printer,
        onClick: handleExportPdf,
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

  // Builds a purpose-made PDF — not a screenshot of the app page — with the same four
  // sections as the on-screen tabs (Overview, Circulation, Inventory Health, Member Activity),
  // each rendered as its own page with a clean header, KPI strip, chart images, and data tables.
  const handleExportPdf = async () => {
    if (pdfExporting) return;
    setPdfExporting(true);
    const toastId = toast.loading(t("reports.generatingPdf", "Generating PDF report…") as string);
    const originalTab = activeTab;

    try {
      // Only one tab's charts are mounted in the DOM at a time, so each tab is switched to in
      // turn, given a moment to render and settle its entrance animation, then captured — the
      // original tab is restored once every chart image has been collected.
      const chartKeysByTab: Record<typeof activeTab, string[]> = {
        Overview: ["circulationTrend", "topCategories", "statusDistribution", "hourlyRhythm"],
        Circulation: ["peakHours", "mediaTypeDist", "fulfillmentStatus", "dailyPace"],
        Inventory: ["copyStatusDist", "conditionHealth", "categoryShare", "formatHoldingsCount"],
        Members: ["membersByRole", "activeDepts"],
      };
      const captured: Record<string, { dataUrl: string; width: number; height: number } | null> = {};
      for (const tab of Object.keys(chartKeysByTab) as (typeof activeTab)[]) {
        setActiveTab(tab);
        await waitForChartsToSettle();
        for (const key of chartKeysByTab[tab]) {
          captured[key] = await captureChart(chartRefs.current[key]);
        }
      }
      setActiveTab(originalTab);
      await waitForChartsToSettle(50);

      const chartFor = (key: string, title: string): ReturnType<typeof buildChart> | undefined => {
        const c = captured[key];
        return c ? buildChart(title, c) : undefined;
      };

      await buildAndSavePdf(chartFor);
      toast.success((t("reports.pdfExported", "PDF report generated successfully") as string), { id: toastId });
    } catch (err: any) {
      setActiveTab(originalTab);
      toast.error(err?.message || String(err), { id: toastId });
    } finally {
      setPdfExporting(false);
    }
  };

  function buildChart(title: string, chart: { dataUrl: string; width: number; height: number }) {
    return { title, dataUrl: chart.dataUrl, width: chart.width, height: chart.height };
  }

  const buildAndSavePdf = async (chartFor: (key: string, title: string) => ReturnType<typeof buildChart> | undefined) => {
    const rangeLabels: Record<typeof timeRange, string> = {
      "7d": (t("reports.ranges.7d") || "Last 7 Days") as string,
      "30d": (t("reports.ranges.30d") || "Last 30 Days") as string,
      "1y": (t("reports.ranges.1y") || "This Year") as string,
      "all": (t("reports.ranges.all") || "All Time") as string,
    };

    const overviewChartTitle = (key: string, fallback: string) => (t(`reports.charts.${key}`) || fallback) as string;

    await generateReportsPdf({
      libraryName: librarySettings.library_name || "Warraq Library",
      librarySubtitle: (t("reports.title", "Analytics & Reports") as string),
      generatedAt: new Date(),
      rangeLabel: rangeLabels[timeRange],
      locale: prefs.locale,
      kpis: [
        { label: (t("reports.metrics.totalCheckouts") || "Total Checkouts") as string, value: stats.totalLoans.toLocaleString(prefs.locale), sub: (t("reports.metrics.totalCheckoutsSub") || "All-time loan transactions") as string },
        { label: (t("reports.metrics.activeBorrowers") || "Active Borrowers") as string, value: stats.activeMembers.toLocaleString(prefs.locale), sub: (t("reports.metrics.activeBorrowersSub") || "Registered active members") as string },
        { label: (t("reports.metrics.overdueRate") || "Overdue Rate") as string, value: stats.overdueRate, sub: `${stats.overdueLoansCount} overdue of ${stats.openLoansCount} open` },
        { label: (t("reports.metrics.physicalHoldings") || "Physical Holdings") as string, value: stats.totalCopies.toLocaleString(prefs.locale), sub: `Across ${stats.totalTitles} catalog titles` },
      ],
      sections: [
        {
          id: "overview",
          title: (t("reports.tabs.overview") || "Overview") as string,
          subtitle: (t("reports.subtitle", "Comprehensive intelligence, holdings stats, and circulation metrics") as string),
          charts: [
            chartFor("circulationTrend", overviewChartTitle("circulationTrend", "Circulation Activity Trend")),
            chartFor("topCategories", overviewChartTitle("topCategories", "Top Borrowed Categories")),
            chartFor("statusDistribution", overviewChartTitle("statusDistribution", "Holding Status Distribution")),
            chartFor("hourlyRhythm", overviewChartTitle("hourlyRhythm", "Circulation Hourly Rhythm")),
          ].filter((c): c is NonNullable<typeof c> => !!c),
          tables: [
            { title: (t("reports.charts.circulationTrend") || "Circulation Activity Trend") as string, columns: [t("reports.columns.day", "Day"), t("reports.columns.circulation", "Circulation")], rows: trendData.map(d => [d.name, d.circulation]) },
            { title: (t("reports.charts.topCategories") || "Top Borrowed Categories") as string, columns: [t("reports.columns.category", "Category"), t("reports.columns.loans", "Loans")], rows: categoriesList.map(c => [c.name, c.value]) },
          ],
        },
        {
          id: "circulation",
          title: (t("reports.tabs.circulation") || "Circulation") as string,
          subtitle: t("reports.sectionSubtitles.circulation", "Loan fulfillment, peak hours, and collection type breakdown"),
          charts: [
            chartFor("peakHours", overviewChartTitle("peakHours", "Peak Circulation Hours")),
            chartFor("mediaTypeDist", overviewChartTitle("mediaTypeDist", "Collection Media Type Distribution")),
            chartFor("fulfillmentStatus", overviewChartTitle("fulfillmentStatus", "Loan Fulfillment Status")),
            chartFor("dailyPace", overviewChartTitle("dailyPace", "Daily Checkouts Pace")),
          ].filter((c): c is NonNullable<typeof c> => !!c),
          tables: [
            {
              title: (t("reports.charts.fulfillmentStatus") || "Loan Fulfillment Status") as string, columns: [t("reports.columns.status", "Status"), t("reports.columns.count", "Count")], rows: [
                [translateLabel("Returned"), stats.returnedLoans],
                [translateLabel("Open Active"), stats.openLoansCount],
                [translateLabel("Overdue"), stats.overdueLoansCount],
              ]
            },
            { title: (t("reports.charts.peakHours") || "Peak Circulation Hours") as string, columns: [t("reports.columns.time", "Time"), t("reports.columns.checkouts", "Checkouts"), t("reports.columns.returns", "Returns")], rows: (dashQuery.data?.circulationRhythm ?? []).map(r => [r.time, r.checkouts, r.returns]) },
            { title: (t("reports.charts.mediaTypeDist") || "Collection Media Type Distribution") as string, columns: [t("reports.columns.type", "Type"), t("reports.columns.count", "Count")], rows: (itemTypesQuery.data ?? []).map(d => [translateLabel(d.item_type), d.count]) },
          ],
        },
        {
          id: "inventory",
          title: (t("reports.tabs.inventory") || "Inventory Health") as string,
          subtitle: t("reports.sectionSubtitles.inventory", "Copy status, condition, and category share across the collection"),
          charts: [
            chartFor("copyStatusDist", overviewChartTitle("copyStatusDist", "Copy Status Distribution")),
            chartFor("conditionHealth", overviewChartTitle("conditionHealth", "Physical Item Condition Health")),
            chartFor("categoryShare", overviewChartTitle("categoryShare", "Category Inventory Share")),
            chartFor("formatHoldingsCount", overviewChartTitle("formatHoldingsCount", "Format Holdings Count")),
          ].filter((c): c is NonNullable<typeof c> => !!c),
          tables: [
            { title: (t("reports.charts.copyStatusDist") || "Copy Status Distribution") as string, columns: [t("reports.columns.status", "Status"), t("reports.columns.count", "Count")], rows: (copyStatusQuery.data ?? []).map(d => [translateLabel(d.status), d.count]) },
            { title: (t("reports.charts.conditionHealth") || "Physical Item Condition Health") as string, columns: [t("reports.columns.condition", "Condition"), t("reports.columns.count", "Count")], rows: (conditionQuery.data ?? []).map(d => [translateLabel(d.condition), d.count]) },
            { title: (t("reports.charts.categoryShare") || "Category Inventory Share") as string, columns: [t("reports.columns.category", "Category"), t("reports.columns.copies", "Copies")], rows: categoriesList.map(c => [c.name, c.value]) },
          ],
        },
        {
          id: "members",
          title: (t("reports.tabs.members") || "Member Activity") as string,
          subtitle: t("reports.sectionSubtitles.members", "Membership roles and departmental engagement"),
          charts: [
            chartFor("membersByRole", overviewChartTitle("membersByRole", "Members by Academic Role")),
            chartFor("activeDepts", overviewChartTitle("activeDepts", "Most Active Departments")),
          ].filter((c): c is NonNullable<typeof c> => !!c),
          tables: [
            { title: (t("reports.charts.membersByRole") || "Members by Academic Role") as string, columns: [t("reports.columns.role", "Role"), t("reports.columns.count", "Count")], rows: (memberRolesQuery.data ?? []).map(d => [translateLabel(d.role), d.count]) },
            { title: (t("reports.charts.activeDepts") || "Most Active Departments") as string, columns: [t("reports.columns.department", "Department"), t("reports.columns.loans", "Loans")], rows: (dashQuery.data?.activeDepartments ?? []).map((d: any) => [d.name, d.count]) },
          ],
        },
      ],
    });
  };

  // Helper for localized status/condition/role names in charts
  const translateLabel = (st: string) => {
    const map: Record<string, string> = {
      available: t("reports.statusLabels.available") || "Available",
      "on-loan": t("reports.statusLabels.onloan") || "On Loan",
      reserved: t("reports.statusLabels.reserved") || "Reserved",
      repair: t("reports.statusLabels.repair") || "In Maintenance",
      lost: t("reports.statusLabels.lost") || "Lost",
      archived: t("reports.statusLabels.archived") || "Archived",
      Returned: t("reports.statusLabels.returned") || "Returned",
      "Open Active": t("reports.statusLabels.openActive") || "Active Loan",
      Overdue: t("reports.statusLabels.overdue") || "Overdue",
      good: t("catalog.condition.good") || "Good",
      fair: t("catalog.condition.fair") || "Fair",
      worn: t("catalog.condition.worn") || "Worn",
      damaged: t("catalog.condition.damaged") || "Damaged",
      visitor: t("members.roles.visitor") || "Visitor",
      student: t("members.roles.student") || "Student",
      staff: t("members.roles.staff") || "Staff",
      medic: t("members.roles.medic") || "Medic",
      other: t("members.roles.other") || "Other",
      book: t("itemTypes.book") || "Book",
      fyp: t("itemTypes.fyp") || "FYP / PFE",
      journal: t("itemTypes.journal") || "Journal",
    };
    return map[st] || st;
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
            onClick={handleExportPdf}
            className="flex items-center gap-2 bg-[#1a4d40] dark:bg-[#1b9277] text-white px-4 py-2 rounded-xl font-bold text-[12px] hover:opacity-90 transition-colors shadow-md cursor-pointer"
          >
            <Printer size={15} /> {t("reports.print") || "Export PDF"}
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
            <span>{t("reports.range") || "Range:"}</span>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-transparent border-none outline-none font-bold text-[#122222] dark:text-white cursor-pointer ml-1"
            >
              <option value="7d" className="dark:bg-[#1d2926]">{t("reports.ranges.7d") || "Last 7 Days"}</option>
              <option value="30d" className="dark:bg-[#1d2926]">{t("reports.ranges.30d") || "Last 30 Days"}</option>
              <option value="1y" className="dark:bg-[#1d2926]">{t("reports.ranges.1y") || "This Year"}</option>
              <option value="all" className="dark:bg-[#1d2926]">{t("reports.ranges.all") || "All Time"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title={t("reports.metrics.totalCheckouts") || "Total Checkouts"} value={stats.totalLoans.toLocaleString(prefs.locale)} label={t("reports.metrics.totalCheckoutsSub") || "All-time loan transactions"} icon={TrendingUp} />
        <MetricCard title={t("reports.metrics.activeBorrowers") || "Active Borrowers"} value={stats.activeMembers.toLocaleString(prefs.locale)} label={t("reports.metrics.activeBorrowersSub") || "Registered active members"} icon={Users} />
        <MetricCard title={t("reports.metrics.overdueRate") || "Overdue Rate"} value={stats.overdueRate} label={t("reports.metrics.overdueRateSub", { overdue: stats.overdueLoansCount, open: stats.openLoansCount }) || `${stats.overdueLoansCount} overdue out of ${stats.openLoansCount} open`} icon={AlertTriangle} />
        <MetricCard title={t("reports.metrics.physicalHoldings") || "Physical Holdings"} value={stats.totalCopies.toLocaleString(prefs.locale)} label={t("reports.metrics.physicalHoldingsSub", { titles: stats.totalTitles }) || `Across ${stats.totalTitles} catalog titles`} icon={BookOpen} />
      </div>

      {/* Tab Panels */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          {/* Chart 1: Circulation Activity Trend */}
          <ChartWidget title={t("reports.charts.circulationTrend") || "Circulation Activity Trend"} icon={TrendingUp} badge={trendBadge ? `${trendBadge} ${t("reports.charts.vsLastPeriodSuffix") || "vs previous period"}` : undefined} chartRef={(el) => { chartRefs.current["circulationTrend"] = el; }}>
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
          <ChartWidget title={t("reports.charts.topCategories") || "Top Borrowed Categories"} icon={BarChart2} chartRef={(el) => { chartRefs.current["topCategories"] = el; }}>
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
          <ChartWidget title={t("reports.charts.statusDistribution") || "Holding Status Distribution"} icon={Layers} chartRef={(el) => { chartRefs.current["statusDistribution"] = el; }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(copyStatusQuery.data ?? []).map(d => ({ ...d, status: translateLabel(d.status) }))} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 4: Hourly Checkout Rhythm */}
          <ChartWidget title={t("reports.charts.hourlyRhythm") || "Circulation Hourly Rhythm"} icon={Clock} secondaryBadge={t("reports.charts.checkoutsVsReturns") || "Checkouts vs Returns"} chartRef={(el) => { chartRefs.current["hourlyRhythm"] = el; }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dashQuery.data?.circulationRhythm ?? []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
          <ChartWidget title={t("reports.charts.peakHours") || "Peak Circulation Hours"} icon={Clock} chartRef={(el) => { chartRefs.current["peakHours"] = el; }}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={dashQuery.data?.circulationRhythm ?? []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="checkouts" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="returns" fill="#b96f3e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 2: Items by Type */}
          <ChartWidget title={t("reports.charts.mediaTypeDist") || "Collection Media Type Distribution"} icon={Bookmark} chartRef={(el) => { chartRefs.current["mediaTypeDist"] = el; }}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={(itemTypesQuery.data ?? []).map(d => ({ ...d, item_type: translateLabel(d.item_type) }))} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="item_type" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 3: Loan Status Breakdown */}
          <ChartWidget title={t("reports.charts.fulfillmentStatus") || "Loan Fulfillment Status"} icon={CheckCircle2} chartRef={(el) => { chartRefs.current["fulfillmentStatus"] = el; }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { status: translateLabel('Returned'), count: stats.returnedLoans },
                { status: translateLabel('Open Active'), count: stats.openLoansCount },
                { status: translateLabel('Overdue'), count: stats.overdueLoansCount }
              ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 4: Daily Loans Flow */}
          <ChartWidget title={t("reports.charts.dailyPace") || "Daily Checkouts Pace"} icon={TrendingUp} chartRef={(el) => { chartRefs.current["dailyPace"] = el; }}>
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
          <ChartWidget title={t("reports.charts.copyStatusDist") || "Copy Status Distribution"} icon={Layers} chartRef={(el) => { chartRefs.current["copyStatusDist"] = el; }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(copyStatusQuery.data ?? []).map(d => ({ ...d, status: translateLabel(d.status) }))} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 2: Item Condition */}
          <ChartWidget title={t("reports.charts.conditionHealth") || "Physical Item Condition Health"} icon={CheckCircle2} chartRef={(el) => { chartRefs.current["conditionHealth"] = el; }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(conditionQuery.data ?? []).map(d => ({ ...d, condition: translateLabel(d.condition) }))} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="condition" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 3: Category Inventory Share */}
          <ChartWidget title={t("reports.charts.categoryShare") || "Category Inventory Share"} icon={BarChart2} chartRef={(el) => { chartRefs.current["categoryShare"] = el; }}>
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
          <ChartWidget title={t("reports.charts.formatHoldingsCount") || "Format Holdings Count"} icon={BookOpen} chartRef={(el) => { chartRefs.current["formatHoldingsCount"] = el; }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(itemTypesQuery.data ?? []).map(d => ({ ...d, item_type: translateLabel(d.item_type) }))} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
          <ChartWidget title={t("reports.charts.membersByRole") || "Members by Academic Role"} icon={Users} chartRef={(el) => { chartRefs.current["membersByRole"] = el; }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(memberRolesQuery.data ?? []).map(d => ({ ...d, role: translateLabel(d.role) }))} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="role" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', background: '#122222', color: '#fff' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {/* Chart 2: Most Active Departments */}
          <ChartWidget title={t("reports.charts.activeDepts") || "Most Active Departments"} icon={BarChart2} chartRef={(el) => { chartRefs.current["activeDepts"] = el; }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dashQuery.data?.activeDepartments ?? []} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
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

function ChartWidget({ title, icon: Icon, badge, secondaryBadge, chartRef, children }: { title: string; icon: any; badge?: string; secondaryBadge?: string; chartRef?: (el: HTMLDivElement | null) => void; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1d2926] p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col min-w-0">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-[14px] text-[#122222] dark:text-white flex items-center gap-2">
          <Icon size={16} className="text-[#1a4d40] dark:text-[#1b9277]" /> {title}
        </h3>
        {badge && <span className="text-[10px] font-bold text-[#1a4d40] dark:text-[#1b9277] bg-[#1a4d40]/10 dark:bg-[#1b9277]/15 px-2.5 py-0.5 rounded-full">{badge}</span>}
        {secondaryBadge && <span className="text-[10px] font-bold text-[#b96f3e] bg-[#b96f3e]/10 px-2.5 py-0.5 rounded-full">{secondaryBadge}</span>}
      </div>
      <div className="flex-1 min-h-[190px] min-w-0 w-full" ref={chartRef}>
        {children}
      </div>
    </div>
  );
}
