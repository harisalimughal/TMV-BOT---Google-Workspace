import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Banknote,
  Users,
  Camera,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { fetchSummary } from "../api/client";
import { DateRangePicker } from "../components/DateRangePicker";

interface Props {
  onSelectSection: (id: string) => void;
}

export function OverviewPage({ onSelectSection }: Props) {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["summary", from, to],
    queryFn: () => fetchSummary(from, to)
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-paper rounded-xl border border-line" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-72 bg-paper rounded-xl border border-line" />
          <div className="h-72 bg-paper rounded-xl border border-line" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-paper rounded-xl border border-line">
        <AlertTriangle className="w-8 h-8 text-status-red mx-auto mb-2" />
        <h3 className="text-base font-bold text-ink mb-1">Failed to load overview data</h3>
        <p className="text-xs text-muted mb-4">The Google Sheets dataset could not be parsed.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-lg bg-navy-900 text-white text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const { kpis, charts } = data;

  return (
    <div className="space-y-8">
      {/* Date Filter & Range Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Operational Overview & Metrics</h2>
          <p className="text-xs text-muted">Real-time telemetry aggregated from field workbook tabs</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Total Jobs */}
        <div
          onClick={() => onSelectSection("jobs")}
          className="p-4 bg-paper rounded-xl border border-line shadow-paper hover:border-tmv-blue cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Jobs</span>
            <Truck className="w-4 h-4 text-tmv-blue" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">{kpis.totalJobs}</div>
          <span className="text-[10px] text-muted">{kpis.scheduled} scheduled, {kpis.inProgress} active</span>
        </div>

        {/* Completed Jobs */}
        <div
          onClick={() => onSelectSection("finished")}
          className="p-4 bg-paper rounded-xl border border-line shadow-paper hover:border-status-green cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-status-green" />
          </div>
          <div className="text-2xl font-bold font-mono text-status-green">{kpis.completed}</div>
          <span className="text-[10px] text-status-green font-medium">
            {kpis.totalJobs > 0 ? `${Math.round((kpis.completed / kpis.totalJobs) * 100)}% completion` : "0%"}
          </span>
        </div>

        {/* Total Revenue */}
        <div
          onClick={() => onSelectSection("finance")}
          className="p-4 bg-paper rounded-xl border border-line shadow-paper hover:border-tmv-blue cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
            <Banknote className="w-4 h-4 text-tmv-blue" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">{kpis.revenueFormatted}</div>
          <span className="text-[10px] text-muted">£{kpis.cashCollectedPounds.toFixed(2)} cash collected</span>
        </div>

        {/* Extra Charges */}
        <div
          onClick={() => onSelectSection("finance")}
          className="p-4 bg-paper rounded-xl border border-line shadow-paper hover:border-status-orange cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Extras & Overtime</span>
            <TrendingUp className="w-4 h-4 text-status-orange" />
          </div>
          <div className="text-2xl font-bold font-mono text-status-orange">
            £{(kpis.extraChargesPounds + kpis.overtimePounds).toFixed(2)}
          </div>
          <span className="text-[10px] text-muted">£{kpis.overtimePounds.toFixed(2)} overtime</span>
        </div>

        {/* Late Jobs */}
        <div
          onClick={() => onSelectSection("jobs")}
          className="p-4 bg-paper rounded-xl border border-line shadow-paper hover:border-status-red cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Late / Delayed</span>
            <Clock className="w-4 h-4 text-status-red" />
          </div>
          <div className="text-2xl font-bold font-mono text-status-red">{kpis.late}</div>
          <span className="text-[10px] text-muted">Avg {kpis.avgDelayMinutes}m delay</span>
        </div>

        {/* Active Drivers */}
        <div
          onClick={() => onSelectSection("drivers")}
          className="p-4 bg-paper rounded-xl border border-line shadow-paper hover:border-navy-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Field Drivers</span>
            <Users className="w-4 h-4 text-navy-800" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">{kpis.driversWorkingCount}</div>
          <span className="text-[10px] text-muted">Active in timeframe</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time Chart */}
        <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Revenue Over Time</h3>
              <p className="text-xs text-muted">Daily booked & executed total (£)</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.revenueOverTime}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B75BC" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1B75BC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#677C93" />
                <YAxis tick={{ fontSize: 10 }} stroke="#677C93" tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  formatter={(val: any) => [`£${Number(val).toFixed(2)}`, "Revenue"]}
                  contentStyle={{ backgroundColor: "#0A1A2F", color: "#FFF", borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenuePounds" stroke="#1B75BC" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Jobs by Driver Bar Chart */}
        <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Driver Workload</h3>
              <p className="text-xs text-muted">Completed vs Active jobs by driver</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.jobsByDriver}>
                <XAxis dataKey="driverName" tick={{ fontSize: 10 }} stroke="#677C93" />
                <YAxis tick={{ fontSize: 10 }} stroke="#677C93" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0A1A2F", color: "#FFF", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="completed" name="Completed" fill="#17804A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" name="Active / Scheduled" fill="#1B75BC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown Donut */}
        <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Job Status Breakdown</h3>
              <p className="text-xs text-muted">Proportion of scheduled, active and completed jobs</p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.statusBreakdown}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {charts.statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0A1A2F", color: "#FFF", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs">
            {charts.statusBreakdown.map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-muted">{s.label}:</span>
                <span className="font-bold font-mono text-ink">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Payment Method Distribution</h3>
              <p className="text-xs text-muted">Breakdown by cash, card and bank transfer</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.paymentMethodSplit} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#677C93" tickFormatter={v => `£${v}`} />
                <YAxis dataKey="method" type="category" tick={{ fontSize: 10 }} stroke="#677C93" width={90} />
                <Tooltip
                  formatter={(val: any) => [`£${Number(val).toFixed(2)}`, "Total Volume"]}
                  contentStyle={{ backgroundColor: "#0A1A2F", color: "#FFF", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="totalPounds" fill="#25436B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
