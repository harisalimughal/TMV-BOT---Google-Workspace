import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fetchFinance } from "../api/client";
import { DateRangePicker } from "../components/DateRangePicker";
import { formatLondonDate } from "../utils/date";

export function FinancePage() {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  const { data, isLoading, error } = useQuery({
    queryKey: ["finance_summary", from, to, groupBy],
    queryFn: () => fetchFinance(from, to, groupBy)
  });

  if (isLoading) {
    return (
      <div className="bg-paper rounded border border-line p-12 text-center text-muted shadow-card">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-pill animate-spin mx-auto mb-3" />
        <span className="text-xs">Loading financial records...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-status-red bg-paper rounded border border-line shadow-card">
        Failed to load financial records.
      </div>
    );
  }

  const { summary, unreconciledJobs, timeline } = data;

  return (
    <div className="space-y-4 max-w-full">
      {/* Header Toolbar */}
      <div className="bg-paper p-3 rounded border border-line flex flex-wrap items-center justify-between gap-3 shadow-card">
        <div className="flex items-center gap-3">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          <span className="text-xs text-muted">Reconciliation of Base Price, Extra Charges, Overtime and Payments</span>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-surface rounded border border-line text-xs font-medium">
          {(["day", "week", "month"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setGroupBy(mode)}
              className={`px-2.5 py-1 rounded capitalize transition ${
                groupBy === mode ? "bg-paper text-ink shadow-card font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-paper rounded border border-line shadow-card">
          <span className="text-xs text-muted font-medium block mb-1">Total Revenue</span>
          <span className="text-2xl font-semibold font-mono text-ink block">{summary.totalRevenueFormatted}</span>
          <span className="text-[11px] text-muted">All billable charges</span>
        </div>

        <div className="p-4 bg-paper rounded border border-line shadow-card">
          <span className="text-xs text-muted font-medium block mb-1">Base Price</span>
          <span className="text-2xl font-semibold font-mono text-ink block">£{summary.basePricePounds.toFixed(2)}</span>
          <span className="text-[11px] text-muted">Booked baseline</span>
        </div>

        <div className="p-4 bg-paper rounded border border-line shadow-card">
          <span className="text-xs text-muted font-medium block mb-1">Extra Charges</span>
          <span className="text-2xl font-semibold font-mono text-ink block">£{summary.extraChargesPounds.toFixed(2)}</span>
          <span className="text-[11px] text-muted">Congestion / Tunnel</span>
        </div>

        <div className="p-4 bg-paper rounded border border-line shadow-card">
          <span className="text-xs text-muted font-medium block mb-1">Overtime</span>
          <span className="text-2xl font-semibold font-mono text-ink block">£{summary.overtimePounds.toFixed(2)}</span>
          <span className="text-[11px] text-muted">£55 per 30 mins</span>
        </div>

        <div className="p-4 bg-paper rounded border border-line shadow-card">
          <span className="text-xs text-muted font-medium block mb-1">Cash Collected</span>
          <span className="text-2xl font-semibold font-mono text-status-green block">£{summary.cashPounds.toFixed(2)}</span>
          <span className="text-[11px] text-muted">Physical cash</span>
        </div>
      </div>

      {/* Unreconciled Invoices Alert */}
      {unreconciledJobs.length > 0 && (
        <div className="p-4 bg-paper rounded border border-status-red/30 shadow-card space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-red" />
            <h3 className="text-btn text-status-red">
              {unreconciledJobs.length} Unreconciled Invoices
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface border-b border-line text-muted font-medium text-[11px]">
                <tr className="h-8">
                  <th className="py-1.5 px-3">Job ID</th>
                  <th className="py-1.5 px-3">Customer</th>
                  <th className="py-1.5 px-3">Driver</th>
                  <th className="py-1.5 px-3 text-right font-mono">Base (£)</th>
                  <th className="py-1.5 px-3 text-right font-mono">Extras (£)</th>
                  <th className="py-1.5 px-3 text-right font-mono">Overtime (£)</th>
                  <th className="py-1.5 px-3 text-right font-mono">Total Recorded (£)</th>
                  <th className="py-1.5 px-3 text-right font-mono">Discrepancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {unreconciledJobs.map((j: any) => (
                  <tr key={j.jobId} className="h-9 hover:bg-surface">
                    <td className="py-1.5 px-3 font-mono font-medium text-brand">{j.jobId}</td>
                    <td className="py-1.5 px-3">{j.customerName}</td>
                    <td className="py-1.5 px-3 font-mono text-muted">{j.driverInitials}</td>
                    <td className="py-1.5 px-3 font-mono text-right">£{j.basePrice.toFixed(2)}</td>
                    <td className="py-1.5 px-3 font-mono text-right">£{j.extraCharges.toFixed(2)}</td>
                    <td className="py-1.5 px-3 font-mono text-right">£{j.overtimeCharge.toFixed(2)}</td>
                    <td className="py-1.5 px-3 font-mono font-semibold text-right">£{j.totalCharges.toFixed(2)}</td>
                    <td className="py-1.5 px-3 font-mono font-semibold text-status-red text-right">
                      £{j.discrepancy.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue Component Timeline Chart */}
      <div className="p-5 bg-paper rounded border border-line shadow-card">
        <div className="mb-4">
          <h3 className="text-btn text-ink">Revenue Streams Breakdown</h3>
          <p className="text-xs text-muted">Base vs Extra Charges vs Overtime over time</p>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline}>
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#98A2B3" }} tickFormatter={formatLondonDate} />
              <YAxis tick={{ fontSize: 11, fill: "#98A2B3" }} tickFormatter={v => `£${v}`} />
              <Tooltip
                formatter={(val: number) => [`£${val.toFixed(2)}`, ""]}
                contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E6E9EF", color: "#101828", borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,40,.10)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="base" fill="#1B75BC" stackId="a" name="Base Price" />
              <Bar dataKey="extras" fill="#29ABE2" stackId="a" name="Extra Charges" />
              <Bar dataKey="overtime" fill="#B54708" stackId="a" name="Overtime" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
