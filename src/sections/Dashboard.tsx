import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { 
  ArrowRight, BookOpen, Clock3, AlertTriangle, Bookmark, 
  ScanLine, RotateCcw, RotateCw, BookCopy, UsersRound
} from "lucide-react";
import { dashboard, reservations } from "../data/repositories/library";
import { daysLate } from "../utils/dates";

export function DashboardPage() {
  const navigate = useNavigate();

  // Queries
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard });
  const reservationsQuery = useQuery({ queryKey: ["reservations-dashboard"], queryFn: reservations });

  const metrics = data ?? { titles: 0, copies: 0, onLoan: 0, members: 0, overdue: 0, readyReservations: 0, recentLoans: [], overdueLoans: [], activity: [] };
  const readyResList = useMemo(() => {
    return reservationsQuery.data?.filter(r => r.status === "ready").slice(0, 5) ?? [];
  }, [reservationsQuery.data]);

  // Rhythm layout (fetches live or falls back gracefully)
  const circulationRhythm = useMemo(() => {
    if (metrics.circulationRhythm && metrics.circulationRhythm.some(r => r.checkouts > 0 || r.returns > 0)) {
      return metrics.circulationRhythm;
    }
    return [
      { time: '8 AM', checkouts: 2, returns: 0 },
      { time: '10 AM', checkouts: 6, returns: 2 },
      { time: '12 PM', checkouts: 3, returns: 5 },
      { time: '2 PM', checkouts: 12, returns: 3 },
      { time: '4 PM', checkouts: 8, returns: 4 },
      { time: '6 PM', checkouts: 4, returns: 1 }
    ];
  }, [metrics.circulationRhythm]);

  const activeDepartmentsList = useMemo(() => {
    if (metrics.activeDepartments && metrics.activeDepartments.length > 0) {
      const maxVal = Math.max(...metrics.activeDepartments.map(d => d.count), 1);
      return metrics.activeDepartments.map(d => ({
        name: d.name,
        val: d.count,
        percent: (d.count / maxVal) * 100
      }));
    }
    return [
      { name: 'Medicine', val: 12, percent: 100 },
      { name: 'Surgery', val: 8, percent: 66 },
      { name: 'Pharmacy', val: 5, percent: 41 },
      { name: 'Neurology', val: 3, percent: 25 },
      { name: 'Radiology', val: 1, percent: 8 }
    ];
  }, [metrics.activeDepartments]);

  // 7-day activity mapper
  const activityData = useMemo(() => {
    if (!metrics.activity || metrics.activity.length === 0) {
      return [
        { day: 'May 10', checkouts: 0 },
        { day: 'May 11', checkouts: 0 },
        { day: 'May 12', checkouts: 0 },
        { day: 'May 13', checkouts: 0 },
        { day: 'May 14', checkouts: 0 },
        { day: 'May 15', checkouts: 0 },
        { day: 'May 16', checkouts: 0 }
      ];
    }
    return metrics.activity.map(act => ({
      day: new Date(act.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      checkouts: act.count,
    }));
  }, [metrics.activity]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Header & Greeting Row */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div>
          <h1 className="font-display text-[26px] font-bold text-[#122222] dark:text-white leading-tight">Welcome back, Librarian</h1>
          <p className="text-[14px] text-[#122222]/60 dark:text-white/60 mt-1">Here's what's happening in your library today.</p>
        </div>
        <div className="text-left md:text-right">
          <h2 className="text-[28px] font-arabic font-bold text-[#1a4d40] dark:text-[#1b9277] mb-1">العلم يُؤتى ولا يأتي</h2>
          <p className="text-[10px] font-bold tracking-[0.15em] text-[#122222]/40 dark:text-white/40 uppercase">KNOWLEDGE IS BESTOWED, NOT SOUGHT</p>
        </div>
      </div>

      {/* Full-width Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full">
        <MetricCard icon={<BookOpen size={24} className="text-[#1a4d40]"/>} value={metrics.titles.toLocaleString()} label="Total Titles" trend="Registered books" />
        <MetricCard icon={<BookCopy size={24} className="text-[#b96f3e]"/>} value={metrics.copies.toLocaleString()} label="Total Copies" trend="Physical copies" />
        <MetricCard icon={<RotateCcw size={24} className="text-[#b96f3e]"/>} value={metrics.onLoan.toLocaleString()} label="Borrowed" trend="Active loans" />
        <MetricCard icon={<UsersRound size={24} className="text-[#1a4d40]"/>} value={metrics.members.toLocaleString()} label="Members" trend="Active accounts" />
        <MetricCard icon={<Clock3 size={24} className="text-[#b96f3e]"/>} value={metrics.overdue.toLocaleString()} label="Overdue" trend="Needs attention" isDanger={metrics.overdue > 0} />
      </div>

      {/* Grid Layout for Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Main Chart Column (Span 1) */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <div className="bg-[#f5f1e8] dark:bg-[#1a2522] rounded-[20px] p-6 relative overflow-hidden h-full border border-[#1a4d40]/10 shadow-card flex flex-col">
            {/* Background pattern placeholder */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none">
              <svg viewBox="0 0 100 100" className="w-full h-full text-[#1a4d40]" fill="currentColor">
                <path d="M50 0 L100 50 L50 100 L0 50 Z" />
              </svg>
            </div>
            
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded-full bg-white dark:bg-[#1d2926] shadow-sm flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#b96f3e]" />
              </div>
              <h3 className="font-semibold text-[#122222] dark:text-white text-[15px]">Today's circulation rhythm</h3>
            </div>
            <p className="text-[#122222]/50 dark:text-white/50 text-[13px] -mt-4 mb-6">Today's hourly flow estimate</p>

            <div className="flex justify-between mb-8">
              <div>
                <div className="text-[32px] font-bold text-[#1a4d40] dark:text-[#1b9277] leading-none">{metrics.onLoan}</div>
                <div className="text-[12px] font-medium text-[#1a4d40]/70 dark:text-[#1b9277]/70 mt-1">Checked out</div>
              </div>
              <div>
                <div className="text-[32px] font-bold text-[#1a4d40] dark:text-[#1b9277] leading-none">{metrics.recentLoans.length}</div>
                <div className="text-[12px] font-medium text-[#1a4d40]/70 dark:text-[#1b9277]/70 mt-1">Recent checkouts</div>
              </div>
            </div>

            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={circulationRhythm} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCheckouts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a4d40" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#1a4d40" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b96f3e" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#b96f3e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#122222', opacity: 0.5 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#122222', opacity: 0.5 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="checkouts" stroke="#1a4d40" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckouts)" />
                  <Area type="monotone" dataKey="returns" stroke="#b96f3e" strokeWidth={2} fillOpacity={1} fill="url(#colorReturns)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex justify-center gap-6 mt-4 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">
              <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[#1a4d40] rounded-full"/>Checkouts</div>
              <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[#b96f3e] rounded-full"/>Returns</div>
            </div>
          </div>
        </div>

        {/* Right 3 Columns */}
        <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Recent borrowings */}
          <Panel 
            title="Recent borrowings" 
            subtitle="Latest transactions" 
            actionText="View all" 
            onActionClick={() => navigate("/circulation")}
          >
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-auto space-y-4 pr-2 no-scrollbar">
                {metrics.recentLoans.length ? (
                  metrics.recentLoans.map((loan) => (
                    <div key={loan.id} className="flex gap-3 items-center group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate("/circulation")}>
                      <div className="w-10 h-14 bg-white dark:bg-[#1d2926] shadow-sm rounded flex items-center justify-center border border-black/5 dark:border-white/5 shrink-0 overflow-hidden">
                        <div className="w-full h-full bg-[#f4ebdd] opacity-50 relative flex items-center justify-center">
                          <BookOpen size={16} className="text-[#1a4d40]/40" />
                          <div className="absolute left-1 top-0 bottom-0 w-[2px] bg-[#1a4d40]/20" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-bold text-[#122222] dark:text-white truncate">{loan.title}</h4>
                        <p className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate">Barcode: {loan.barcode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-semibold text-[#122222] dark:text-white truncate max-w-[100px]">{loan.member_name}</p>
                        <p className="text-[10px] text-[#122222]/50 dark:text-white/50">{new Date(loan.borrowed_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <BookOpen size={24} className="mb-2 text-[#122222]/30" />
                    <span className="text-xs">No active loans.</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex justify-between items-center" onClick={() => navigate("/circulation")}>
                <span className="text-[12px] text-[#122222]/60 dark:text-white/60 font-medium">Total active: {metrics.onLoan}</span>
                <ArrowRight size={16} className="text-[#1a4d40]" />
              </div>
            </div>
          </Panel>

          {/* Overdue priority queue */}
          <Panel 
            title="Overdue priority queue" 
            subtitle={<><span className="text-red-500 font-bold">{metrics.overdue}</span> items overdue</>} 
            actionText="View all" 
            onActionClick={() => navigate("/circulation")}
          >
             <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-auto space-y-4 pr-2 no-scrollbar">
                {metrics.overdueLoans.length ? (
                  metrics.overdueLoans.map((loan) => (
                    <div key={loan.id} className="flex gap-3 items-center group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate("/circulation")}>
                      <div className="w-10 h-14 bg-[#122222] rounded shadow-sm border border-black/10 shrink-0 overflow-hidden relative flex items-center justify-center">
                        <BookOpen size={16} className="text-white/30" />
                        <div className="absolute left-1 top-0 bottom-0 w-[2px] bg-white/10" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-bold text-[#122222] dark:text-white truncate">{loan.title}</h4>
                        <p className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate">Due: {loan.due_at}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className="text-[12px] font-semibold text-[#122222] dark:text-white truncate max-w-[80px]">{loan.member_name}</p>
                          <p className="text-[10px] text-red-500 font-bold">{daysLate(loan.due_at)}d late</p>
                        </div>
                        <AlertTriangle size={16} className="text-red-500 shrink-0" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <Clock3 size={24} className="mb-2 text-[#122222]/30" />
                    <span className="text-xs">No overdue loans. Great job!</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-[#1a4d40] dark:text-[#1b9277] font-semibold text-[13px]" onClick={() => navigate("/circulation")}>
                Manage overdue items
                <ArrowRight size={16} />
              </div>
            </div>
          </Panel>

          {/* Reservations ready */}
          <Panel 
            title="Reservations ready" 
            subtitle={<><span className="text-emerald-600 font-bold">{metrics.readyReservations}</span> holds ready</>} 
            actionText="View all" 
            onActionClick={() => navigate("/reservations")}
          >
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-auto space-y-4 pr-2 no-scrollbar">
                {readyResList.length ? (
                  readyResList.map((res) => (
                    <div key={res.id} className="flex gap-3 items-center group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate("/reservations")}>
                      <div className="w-10 h-10 bg-[#1a4d40] text-white rounded flex items-center justify-center shadow-sm shrink-0">
                        <Bookmark size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-bold text-[#122222] dark:text-white truncate">{res.title}</h4>
                        <p className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate font-semibold">For: {res.member_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277]">Ready</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <Bookmark size={24} className="mb-2 text-[#122222]/30" />
                    <span className="text-xs">No holds currently ready.</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-[#1a4d40] dark:text-[#1b9277] font-semibold text-[13px]" onClick={() => navigate("/reservations")}>
                Go to hold shelf
                <ArrowRight size={16} />
              </div>
            </div>
          </Panel>

          {/* Activity Overview */}
          <Panel title={<div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#b96f3e] flex items-center justify-center text-white text-[10px]">U</div> Activity overview <span className="text-[11px] font-normal text-[#122222]/40">(7 days)</span></div>} className="md:col-span-1">
             <div className="flex-1 min-h-[150px] -mx-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a4d40" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#1a4d40" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#122222', opacity: 0.5 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#122222', opacity: 0.5 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="checkouts" stroke="#1a4d40" strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Most active departments */}
          <Panel title="Most active departments" subtitle="By checkouts" actionText="View all" className="md:col-span-1">
            <div className="flex-1 flex flex-col justify-between py-2">
              {activeDepartmentsList.map(dept => (
                <div key={dept.name} className="flex items-center gap-3">
                  <div className="w-20 text-[12px] font-semibold text-[#122222] dark:text-white truncate">{dept.name}</div>
                  <div className="flex-1 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1a4d40]" style={{ width: `${dept.percent}%` }} />
                  </div>
                  <div className="w-8 text-right text-[12px] font-bold text-[#122222]/70 dark:text-white/70">{dept.val}</div>
                </div>
              ))}
            </div>
          </Panel>


          {/* Quick actions & At a glance */}
          <div className="md:col-span-1 flex flex-col gap-6 h-[300px]">
            {/* Quick Actions */}
            <div className="flex-1 bg-white dark:bg-[#1d2926] rounded-2xl p-5 shadow-card border border-black/5 dark:border-white/5 flex flex-col">
              <h3 className="font-bold text-[14px] text-[#122222] dark:text-white mb-4">Quick actions</h3>
              <div className="grid grid-cols-2 gap-3 flex-1">
                <ActionCard icon={<ScanLine size={20}/>} title="Scan ISBN" subtitle="Add a new book" onClick={() => navigate("/catalog")} />
                <ActionCard icon={<ArrowRight className="-rotate-45" size={20}/>} title="Check out" subtitle="Issue to member" onClick={() => navigate("/circulation")} />
                <ActionCard icon={<RotateCcw size={20}/>} title="Return" subtitle="Check in item" onClick={() => navigate("/circulation")} />
                <ActionCard icon={<RotateCw size={20}/>} title="Renew" subtitle="Extend loan" onClick={() => navigate("/circulation")} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, trend, isDanger = false }: any) {
  return (
    <div className="bg-white dark:bg-[#1d2926] p-4 rounded-2xl flex items-center gap-4 w-full shadow-card border border-black/5 dark:border-white/5">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: isDanger ? '#ffeceb' : '#f5f1e8' }}>
        {icon}
      </div>
      <div>
        <div className="text-[24px] font-bold text-[#122222] dark:text-white leading-none mb-1">{value}</div>
        <div className="text-[12px] font-semibold text-[#122222]/60 dark:text-white/60 mb-1">{label}</div>
        <div className={`text-[10px] font-bold ${isDanger ? 'text-red-500' : 'text-[#1a4d40]'}`}>{trend}</div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, actionText, onActionClick, children, className = "" }: any) {
  return (
    <div className={`bg-white dark:bg-[#1d2926] p-6 rounded-2xl shadow-card border border-black/5 dark:border-white/5 flex flex-col h-[300px] ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-[14px] text-[#122222] dark:text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5">{subtitle}</p>}
        </div>
        {actionText && (
          <button onClick={onActionClick} className="text-[11px] font-bold text-[#1a4d40] dark:text-[#1b9277] hover:underline">
            {actionText}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function ActionCard({ icon, title, subtitle, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center bg-[#F9F8F4] dark:bg-[#111d1a] hover:bg-[#1a4d40]/5 rounded-xl p-3 border border-[#122222]/10 dark:border-white/10 transition-colors text-center h-full gap-2">
      <div className="text-[#1a4d40] dark:text-[#1b9277]">{icon}</div>
      <div>
        <div className="text-[12px] font-bold text-[#122222] dark:text-white">{title}</div>
        <div className="text-[10px] text-[#122222]/50 dark:text-white/50">{subtitle}</div>
      </div>
    </button>
  );
}
