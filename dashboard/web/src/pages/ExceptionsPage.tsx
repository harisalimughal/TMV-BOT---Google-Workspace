import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ExternalLink,
  RefreshCw,
  FileText,
  ShieldAlert,
  CheckCircle2,
  Filter,
  X,
  Eye,
  ArrowRight
} from "lucide-react";
import { fetchExceptions } from "../api/client";
import { ExceptionItem } from "../types";
import { DateRangePicker } from "../components/DateRangePicker";
import { formatLondonDateTime } from "../utils/date";

interface Props {
  onOpenJob?: (jobId: string) => void;
}

export function ExceptionsPage({ onOpenJob }: Props) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["exceptions_page", selectedType, from, to],
    queryFn: () => fetchExceptions(selectedType, from, to)
  });

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span className="text-xs font-medium text-muted">Auditing operational exception logs...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-status-red bg-paper rounded-lg border border-line shadow-card">
        <AlertCircle className="w-6 h-6 mx-auto mb-2 text-status-red" />
        <h3 className="text-sm font-semibold text-ink">Failed to load exceptions</h3>
        <button
          onClick={() => refetch()}
          className="mt-3 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-dark transition"
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate severity counts
  const criticalCount = data.items.filter(i => i.severity === "CRITICAL").length;
  const warningCount = data.items.filter(i => i.severity === "WARNING").length;
  const infoCount = data.items.filter(i => i.severity === "INFO" || !i.severity).length;

  const filteredItems = data.items.filter(item => {
    if (selectedSeverity !== "ALL" && item.severity !== selectedSeverity) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchJob = item.jobId?.toLowerCase().includes(q);
      const matchCust = item.customerName?.toLowerCase().includes(q);
      const matchDriver = item.driverName?.toLowerCase().includes(q);
      const matchDetail = item.detail?.toLowerCase().includes(q);
      if (!matchJob && !matchCust && !matchDriver && !matchDetail) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-full">
      {/* 1. SEVERITY SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Critical Card */}
        <div
          onClick={() => setSelectedSeverity(selectedSeverity === "CRITICAL" ? "ALL" : "CRITICAL")}
          className={`p-4 rounded-lg border transition cursor-pointer shadow-card flex items-center justify-between ${
            selectedSeverity === "CRITICAL"
              ? "bg-status-red-bg border-status-red/40 ring-2 ring-status-red/20"
              : "bg-paper border-line hover:border-status-red/30"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-status-red text-xs font-bold uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              <span>Critical Exceptions</span>
            </div>
            <div className="text-2xl font-bold font-mono text-ink">{criticalCount}</div>
            <span className="text-[11px] text-muted block">Immediate dispatcher intervention</span>
          </div>
          <span className="px-2 py-1 rounded-full bg-status-red text-white text-xs font-bold font-mono">
            P1
          </span>
        </div>

        {/* Warning Card */}
        <div
          onClick={() => setSelectedSeverity(selectedSeverity === "WARNING" ? "ALL" : "WARNING")}
          className={`p-4 rounded-lg border transition cursor-pointer shadow-card flex items-center justify-between ${
            selectedSeverity === "WARNING"
              ? "bg-status-amber-bg border-status-amber/40 ring-2 ring-status-amber/20"
              : "bg-paper border-line hover:border-status-amber/30"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-status-amber text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>Needs Attention</span>
            </div>
            <div className="text-2xl font-bold font-mono text-ink">{warningCount}</div>
            <span className="text-[11px] text-muted block">Delays, missing photos, overtime</span>
          </div>
          <span className="px-2 py-1 rounded-full bg-status-amber text-white text-xs font-bold font-mono">
            P2
          </span>
        </div>

        {/* Informational Card */}
        <div
          onClick={() => setSelectedSeverity(selectedSeverity === "INFO" ? "ALL" : "INFO")}
          className={`p-4 rounded-lg border transition cursor-pointer shadow-card flex items-center justify-between ${
            selectedSeverity === "INFO"
              ? "bg-brand-soft border-brand/40 ring-2 ring-brand/20"
              : "bg-paper border-line hover:border-brand/30"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-brand text-xs font-bold uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Informational Alerts</span>
            </div>
            <div className="text-2xl font-bold font-mono text-ink">{infoCount}</div>
            <span className="text-[11px] text-muted block">Schedule changes & sign-offs</span>
          </div>
          <span className="px-2 py-1 rounded-full bg-brand text-white text-xs font-bold font-mono">
            P3
          </span>
        </div>
      </div>

      {/* 2. FILTER TOOLBAR */}
      <div className="bg-paper p-3.5 rounded-lg border border-line flex flex-wrap items-center justify-between gap-3 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exceptions..."
              className="w-full h-8 pl-3 pr-7 bg-surface border border-line rounded-lg text-xs text-ink placeholder:text-muted focus:bg-paper focus:border-brand transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-2 text-muted hover:text-ink">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-1 p-0.5 bg-surface rounded-lg border border-line text-xs">
            <button
              onClick={() => setSelectedType("ALL")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedType === "ALL" ? "bg-paper text-ink shadow-2xs font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              All Categories ({data.unfilteredTotal})
            </button>
            {data.types.slice(0, 5).map(t => (
              <button
                key={t.type}
                onClick={() => setSelectedType(t.type)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium font-mono transition ${
                  selectedType === t.type ? "bg-paper text-brand shadow-2xs font-semibold" : "text-muted hover:text-ink"
                }`}
              >
                {t.type} ({t.count})
              </button>
            ))}
          </div>

          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        </div>

        <span className="text-xs text-muted font-mono">
          {filteredItems.length} active exceptions shown
        </span>
      </div>

      {/* 3. EXCEPTIONS DATA TABLE */}
      <div className="bg-paper rounded-lg border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface/80 backdrop-blur-xs border-b border-line text-muted text-xs font-semibold sticky top-0 z-20">
              <tr className="h-10">
                <th className="py-2 px-3 w-8 text-center border-r border-line">
                  <input type="checkbox" className="rounded text-brand" />
                </th>
                <th className="py-2 px-3 w-28 font-semibold border-r border-line">Severity</th>
                <th className="py-2 px-3 w-56 font-semibold border-r border-line font-mono">Category</th>
                <th className="py-2 px-3 w-36 font-semibold border-r border-line font-mono">Job ID</th>
                <th className="py-2 px-3 w-48 font-semibold border-r border-line">Customer / Driver</th>
                <th className="py-2 px-3 min-w-[240px] font-semibold border-r border-line">Operational Detail</th>
                <th className="py-2 px-3 w-40 font-semibold border-r border-line font-mono">Timestamp (London)</th>
                <th className="py-2 px-3 w-20 text-center font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line bg-paper">
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted">
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center mx-auto mb-2 text-status-green">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-ink">Zero exceptions found</p>
                    <p className="text-xs text-muted">All moves in this filter scope are running smoothly.</p>
                  </td>
                </tr>
              )}

              {filteredItems.map((ex: ExceptionItem) => (
                <tr key={ex.id} className="h-[52px] hover:bg-surface/80 transition">
                  <td className="py-2.5 px-3 text-center border-r border-line">
                    <input type="checkbox" className="rounded text-brand" />
                  </td>

                  {/* Severity Badge */}
                  <td className="py-2.5 px-3 whitespace-nowrap border-r border-line">
                    {ex.severity === "CRITICAL" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-status-red-bg text-status-red border border-status-red/20">
                        <AlertCircle className="w-3 h-3" /> Critical
                      </span>
                    ) : ex.severity === "WARNING" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-status-amber-bg text-status-amber border border-status-amber/20">
                        <AlertTriangle className="w-3 h-3" /> Warning
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface text-ink-2 border border-line">
                        <Info className="w-3 h-3 text-muted" /> Info
                      </span>
                    )}
                  </td>

                  {/* Type */}
                  <td className="py-2.5 px-3 font-mono font-medium text-ink text-xs whitespace-nowrap border-r border-line">
                    {ex.type}
                  </td>

                  {/* Job ID */}
                  <td className="py-2.5 px-3 font-mono font-bold text-brand text-xs whitespace-nowrap border-r border-line">
                    {ex.jobId}
                  </td>

                  {/* Customer / Driver */}
                  <td className="py-2.5 px-3 border-r border-line">
                    <div className="h-7 px-2.5 py-1 bg-surface border border-line rounded-lg flex items-center text-xs text-ink truncate" title={`${ex.customerName} (${ex.driverName})`}>
                      <span className="truncate">{ex.customerName} &bull; <span className="text-muted font-mono font-medium">{ex.driverName}</span></span>
                    </div>
                  </td>

                  {/* Detail */}
                  <td className="py-2.5 px-3 text-ink-2 text-xs border-r border-line max-w-sm truncate" title={ex.detail}>
                    {ex.detail}
                  </td>

                  {/* Timestamp */}
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted whitespace-nowrap border-r border-line">
                    {formatLondonDateTime(ex.timestamp)}
                  </td>

                  {/* Action */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {ex.jobId !== "UNKNOWN" && onOpenJob ? (
                      <button
                        onClick={() => onOpenJob(ex.jobId)}
                        className="px-2.5 py-1 rounded-lg bg-surface hover:bg-brand hover:text-white text-brand text-xs font-semibold transition"
                      >
                        Inspect
                      </button>
                    ) : (
                      "—"
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
