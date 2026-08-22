import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, AlertCircle, Info, ExternalLink, Filter } from "lucide-react";
import { fetchExceptions } from "../api/client";
import { ExceptionItem } from "../types";
import { DateRangePicker } from "../components/DateRangePicker";

interface Props {
  onOpenJob?: (jobId: string) => void;
}

export function ExceptionsPage({ onOpenJob }: Props) {
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["exceptions_page", selectedType, from, to],
    queryFn: () => fetchExceptions(selectedType, from, to)
  });

  if (isLoading) {
    return <div className="py-16 text-center text-muted animate-pulse">Loading exceptions report...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-status-red bg-paper rounded-xl border border-line">
        Failed to load exceptions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink">Operational Exceptions & Quality Control</h2>
            <span className="px-2 py-0.5 rounded-full bg-status-red text-white text-xs font-bold font-mono">
              {data.total}
            </span>
          </div>
          <p className="text-xs text-muted">
            Live unhandled system errors from ExceptionReport sheet + derived field quality alerts
          </p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* Exception Type Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-paper rounded-xl border border-line shadow-paper">
        <button
          onClick={() => setSelectedType("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            selectedType === "ALL" ? "bg-navy-900 text-white shadow-sm" : "bg-surface text-ink-2 hover:bg-surface-2"
          }`}
        >
          All Types ({data.unfilteredTotal})
        </button>
        {data.types.map(t => (
          <button
            key={t.type}
            onClick={() => setSelectedType(t.type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
              selectedType === t.type ? "bg-tmv-blue text-white shadow-sm" : "bg-surface text-ink-2 hover:bg-surface-2"
            }`}
          >
            {t.type} ({t.count})
          </button>
        ))}
      </div>

      {/* Exceptions List Table */}
      <div className="bg-paper rounded-xl border border-line shadow-paper overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface border-b border-line text-muted font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-28">Severity</th>
                <th className="py-3 px-4">Exception Type</th>
                <th className="py-3 px-4 font-mono">Job ID</th>
                <th className="py-3 px-4">Customer & Driver</th>
                <th className="py-3 px-4">Detail</th>
                <th className="py-3 px-4 font-mono">Timestamp</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-status-green font-medium">
                    No exceptions found for this filter.
                  </td>
                </tr>
              )}

              {data.items.map((ex: ExceptionItem) => (
                <tr key={ex.id} className="hover:bg-surface/60 transition">
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {ex.severity === "CRITICAL" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-status-red border border-rose-200">
                        <AlertCircle className="w-3 h-3" /> Critical
                      </span>
                    ) : ex.severity === "WARNING" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-status-orange border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Warning
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-tmv-blue border border-blue-200">
                        <Info className="w-3 h-3" /> Info
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-ink whitespace-nowrap">
                    {ex.type}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-tmv-blue whitespace-nowrap">
                    {ex.jobId}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-ink block">{ex.customerName}</span>
                    <span className="text-muted text-[11px]">{ex.driverName}</span>
                  </td>
                  <td className="py-3.5 px-4 text-ink-2 max-w-md">
                    {ex.detail}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-muted text-[11px] whitespace-nowrap">
                    {ex.timestamp}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    {ex.jobId !== "UNKNOWN" && onOpenJob && (
                      <button
                        onClick={() => onOpenJob(ex.jobId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface text-tmv-blue hover:bg-surface-2 font-semibold transition"
                      >
                        Inspect <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
