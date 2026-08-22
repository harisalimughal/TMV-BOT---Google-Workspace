import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, TrendingUp, AlertTriangle, CheckCircle2, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fetchFinance } from "../api/client";
import { DateRangePicker } from "../components/DateRangePicker";

export function FinancePage() {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  const { data, isLoading, error } = useQuery({
    queryKey: ["finance_summary", from, to, groupBy],
    queryFn: () => fetchFinance(from, to, groupBy)
  });

  if (isLoading) {
    return <div className="py-16 text-center text-muted animate-pulse">Loading financial summary...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-status-red bg-paper rounded-xl border border-line">
        Failed to load financial records.
      </div>
    );
  }

  const { summary, unreconciledJobs, timeline } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Financial Audit & Reconciliation</h2>
          <p className="text-xs text-muted">All monetary values reconciled through integer Pence type</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* Top Financial Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-paper rounded-xl border border-line shadow-paper">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">Total Revenue</span>
          <span className="text-2xl font-bold font-mono text-ink block">{summary.totalRevenueFormatted}</span>
          <span className="text-[10px] text-muted">All billable charges</span>
        </div>

        <div className="p-4 bg-paper rounded-xl border border-line shadow-paper">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">Base Price Revenue</span>
          <span className="text-2xl font-bold font-mono text-ink block">£{summary.basePricePounds.toFixed(2)}</span>
          <span className="text-[10px] text-muted">Booked baseline pricing</span>
        </div>

        <div className="p-4 bg-paper rounded-xl border border-line shadow-paper">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">Extras (Congestion/Tunnel)</span>
          <span className="text-2xl font-bold font-mono text-status-orange block">£{summary.extraChargesPounds.toFixed(2)}</span>
          <span className="text-[10px] text-muted">£18 / £13 fixed charges</span>
        </div>

        <div className="p-4 bg-paper rounded-xl border border-line shadow-paper">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">Overtime Charges</span>
          <span className="text-2xl font-bold font-mono text-status-orange block">£{summary.overtimePounds.toFixed(2)}</span>
          <span className="text-[10px] text-muted">£55 per 30m blocks</span>
        </div>

        <div className="p-4 bg-paper rounded-xl border border-line shadow-paper">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">Cash Collected</span>
          <span className="text-2xl font-bold font-mono text-status-green block">£{summary.cashPounds.toFixed(2)}</span>
          <span className="text-[10px] text-muted">Physical cash in hand</span>
        </div>
      </div>

      {/* Revenue Breakdown Timeline Chart */}
      <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-ink">Revenue Component Breakdown</h3>
            <p className="text-xs text-muted">Base vs Extras vs Overtime distribution over time</p>
          </div>
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-line text-xs">
            {(["day", "week", "month"] as const).map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1 rounded-md font-semibold capitalize transition ${
                  groupBy === g ? "bg-paper text-tmv-blue shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline}>
              <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#677C93" />
              <YAxis tick={{ fontSize: 10 }} stroke="#677C93" tickFormatter={v => `£${v}`} />
              <Tooltip
                formatter={(val: any) => [`£${Number(val).toFixed(2)}`]}
                contentStyle={{ backgroundColor: "#0A1A2F", color: "#FFF", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="base" name="Base Price" fill="#1B75BC" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="extras" name="Extra Charges" fill="#29ABE2" stackId="a" />
              <Bar dataKey="overtime" name="Overtime" fill="#B4600A" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Unreconciled Financial Discrepancies Table */}
      <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-orange" />
              Financial Reconciliation Audit
            </h3>
            <p className="text-xs text-muted">
              Flags any jobs where recorded Total does not equal (Base + Extras + Overtime)
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              unreconciledJobs.length === 0 ? "bg-emerald-100 text-status-green" : "bg-amber-100 text-status-orange"
            }`}
          >
            {unreconciledJobs.length === 0 ? "All Jobs Reconciled" : `${unreconciledJobs.length} Discrepancies`}
          </span>
        </div>

        {unreconciledJobs.length === 0 ? (
          <div className="py-8 text-center text-status-green flex flex-col items-center gap-2 bg-emerald-50/40 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-xs font-semibold">100% of jobs mathematically reconcile to exact penny.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface border-b border-line text-muted font-bold text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 font-mono">Base Price (£)</th>
                  <th className="py-2.5 px-3 font-mono">Extras (£)</th>
                  <th className="py-2.5 px-3 font-mono">Overtime (£)</th>
                  <th className="py-2.5 px-3 font-mono font-bold">Recorded Total (£)</th>
                  <th className="py-2.5 px-3 font-mono text-status-red font-bold">Discrepancy (£)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono">
                {unreconciledJobs.map(rec => (
                  <tr key={rec.jobId} className="hover:bg-surface/50">
                    <td className="py-2.5 px-3 font-bold text-ink">{rec.jobId}</td>
                    <td className="py-2.5 px-3 font-sans text-ink">{rec.customerName}</td>
                    <td className="py-2.5 px-3">£{rec.basePrice.toFixed(2)}</td>
                    <td className="py-2.5 px-3">£{rec.extraCharges.toFixed(2)}</td>
                    <td className="py-2.5 px-3">£{rec.overtimeCharge.toFixed(2)}</td>
                    <td className="py-2.5 px-3 font-bold text-ink">£{rec.totalCharges.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-status-red font-bold">
                      ±£{(rec.differencePence / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
