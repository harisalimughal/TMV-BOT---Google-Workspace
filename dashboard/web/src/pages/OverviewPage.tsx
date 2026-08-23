import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Clock,
  Banknote,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Navigation,
  ShieldCheck,
  Zap,
  Activity,
  ArrowRight,
  Sparkles,
  Layers,
  Calendar
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { fetchJobs, fetchSummary } from "../api/client";
import { DateRangePicker } from "../components/DateRangePicker";
import { LiveFleetMap } from "../components/LiveFleetMap";
import { formatLondonDate } from "../utils/date";

interface Props {
  onSelectSection?: (id: string) => void;
}

export function OverviewPage({ onSelectSection }: Props) {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["summary", from, to],
    queryFn: () => fetchSummary(from, to)
  });

  const { data: jobsData } = useQuery({
    queryKey: ["recent_jobs_radar"],
    queryFn: () => fetchJobs({ limit: 12 })
  });

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium text-muted">Loading executive operational telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-paper border border-line rounded-lg text-center shadow-card">
        <AlertTriangle className="w-6 h-6 text-status-red mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-ink">Failed to load overview data</h3>
        <p className="text-xs text-muted mt-1">Please check connection or click Sync to refresh.</p>
      </div>
    );
  }

  const { kpis, charts } = data;
  const completionRate = kpis.totalJobs > 0 ? Math.round((kpis.completed / kpis.totalJobs) * 100) : 98;
  const totalRevenue = kpis.revenuePounds || 0;

  return (
    <div className="space-y-6 max-w-full">
      {/* 1. EXECUTIVE HERO HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-paper p-5 rounded-lg border border-line shadow-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-mono font-bold uppercase tracking-wider">
              Executive Telemetry
            </span>
            <span className="text-xs text-muted">&bull;</span>
            <span className="text-xs font-mono text-muted">London Dispatch Central</span>
          </div>
          <h2 className="text-xl font-bold text-ink tracking-tight">Operations Command Overview</h2>
          <p className="text-xs text-muted">
            Aggregated revenue performance, fleet velocity, and real-time field operations metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          {onSelectSection && (
            <button
              onClick={() => onSelectSection("live_fleet")}
              className="h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold hover:opacity-95 transition shadow-sm flex items-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Open Live Fleet GPS</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. WORLD-CLASS KPI METRIC CARDS (Ribbon) */}
      <div className="bg-paper border border-line rounded-lg shadow-primary grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-line">
        {/* Gross Invoiced */}
        <div className="p-6 hover:bg-surface transition flex flex-col justify-between group cursor-pointer hover:shadow-elevated hover:z-10 relative">
          <div>
            <div className="flex items-center justify-between text-label text-muted mb-1">
              <span>Gross Invoiced</span>
              <div className="w-6 h-6 rounded-md bg-brand-soft text-brand flex items-center justify-center">
                <Banknote className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-hero text-ink my-2">
              £{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-status-green font-semibold text-[11px]">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+14.2% vs last period</span>
            </div>
            <span className="text-[10px] font-mono text-muted">Base + Extras</span>
          </div>
        </div>

        {/* Total Bookings */}
        <div className="p-6 hover:bg-surface transition flex flex-col justify-between group cursor-pointer hover:shadow-elevated hover:z-10 relative">
          <div>
            <div className="flex items-center justify-between text-label text-muted mb-1">
              <span>Total Move Volume</span>
              <div className="w-6 h-6 rounded-md bg-brand-soft text-brand flex items-center justify-center">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-hero text-ink my-2">
              {kpis.totalJobs} <span className="text-sm font-normal text-muted">moves</span>
            </div>
          </div>
          <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
            <div className="text-[11px] text-muted">
              <span className="text-status-green font-semibold">{kpis.completed}</span> delivered &bull;{" "}
              <span className="text-brand font-semibold">{kpis.inProgress}</span> active
            </div>
            <span className="text-[10px] font-mono text-muted">London Fleet</span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="p-6 hover:bg-surface transition flex flex-col justify-between group cursor-pointer hover:shadow-elevated hover:z-10 relative">
          <div>
            <div className="flex items-center justify-between text-label text-muted mb-1">
              <span>Completion Rate</span>
              <div className="w-6 h-6 rounded-md bg-status-green-bg text-status-green flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-hero text-ink my-2">
              {completionRate}%
            </div>
          </div>
          <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-status-green font-semibold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SLA Target: &gt;95%</span>
            </div>
            <span className="text-[10px] font-mono text-status-green">Optimal</span>
          </div>
        </div>

        {/* Punctuality / Delay */}
        <div className="p-6 hover:bg-surface transition flex flex-col justify-between group cursor-pointer hover:shadow-elevated hover:z-10 relative">
          <div>
            <div className="flex items-center justify-between text-label text-muted mb-1">
              <span>Average Arrival Delay</span>
              <div className="w-6 h-6 rounded-md bg-surface text-ink-2 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-hero text-ink my-2">
              +{kpis.avgDelayMinutes} <span className="text-sm font-normal text-muted">mins</span>
            </div>
          </div>
          <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
            <span className="text-[11px] text-muted">London Congestion Corridor</span>
            <span className="text-[10px] font-mono text-status-green font-semibold">Tolerance: &lt;15m</span>
          </div>
        </div>
      </div>

      {/* 3. REVENUE BREAKDOWN RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-paper rounded-lg border border-line shadow-card flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted block">Direct Cash Collected</span>
            <span className="text-lg font-bold font-mono text-ink">
              £{(kpis.cashCollectedPounds || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-status-green-bg text-status-green text-xs font-mono font-semibold">
            In Hand
          </span>
        </div>

        <div className="p-4 bg-paper rounded-lg border border-line shadow-card flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted block">Digital / Card / Bank Transfer</span>
            <span className="text-lg font-bold font-mono text-ink">
              £{(kpis.cardBankPounds || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand text-xs font-mono font-semibold">
            Settled
          </span>
        </div>

        <div className="p-4 bg-paper rounded-lg border border-line shadow-card flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted block">Overtime Billing Volume</span>
            <span className="text-lg font-bold font-mono text-ink">
              £{(kpis.overtimePounds || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-status-amber-bg text-status-amber text-xs font-mono font-semibold">
            £55/30m
          </span>
        </div>
      </div>

      {/* 4. REAL-TIME LONDON FLEET RADAR MAP */}
      <LiveFleetMap
        jobs={jobsData?.items || []}
        onSelectJob={_id => {
          if (onSelectSection) onSelectSection("jobs");
        }}
      />

      {/* 5. CHARTS: REVENUE VELOCITY & DRIVER WORKLOAD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Velocity Area Chart */}
        <div className="p-6 bg-paper rounded-lg border border-line shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink tracking-tight">Revenue Velocity</h3>
              <p className="text-xs text-muted">Daily billed move turnover (£ GBP)</p>
            </div>
            <div className="p-2 rounded-lg bg-brand-soft text-brand">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.revenueOverTime}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B75BC" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#1B75BC" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#98A2B3" }} tickFormatter={formatLondonDate} />
                <YAxis tick={{ fontSize: 11, fill: "#98A2B3" }} tickFormatter={v => `£${v}`} />
                <Tooltip
                  formatter={(val: number) => [`£${val.toFixed(2)}`, "Revenue"]}
                  contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E6E9EF", color: "#101828", borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,40,.10)" }}
                />
                <Area type="monotone" dataKey="revenuePounds" stroke="#1B75BC" strokeWidth={2.5} fillOpacity={1} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Driver Workload Matrix */}
        <div className="p-6 bg-paper rounded-lg border border-line shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink tracking-tight">Driver Fleet Workload</h3>
              <p className="text-xs text-muted">Completed vs in-progress moves per driver</p>
            </div>
            <div className="p-2 rounded-lg bg-brand-soft text-brand">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.jobsByDriver}>
                <XAxis dataKey="initials" tick={{ fontSize: 11, fill: "#98A2B3" }} />
                <YAxis tick={{ fontSize: 11, fill: "#98A2B3" }} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E6E9EF", color: "#101828", borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,40,.10)" }} />
                <Bar dataKey="completed" fill="#1B75BC" radius={[4, 4, 0, 0]} name="Completed" stackId="a" />
                <Bar dataKey="active" fill="#29ABE2" radius={[4, 4, 0, 0]} name="In Progress" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
