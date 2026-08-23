import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Download } from "lucide-react";
import { fetchActivity } from "../api/client";
import { DateRangePicker } from "../components/DateRangePicker";
import { formatLondonDateTime } from "../utils/date";

export function ActivityPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["activity_log", page, from, to],
    queryFn: () => fetchActivity(page, from, to)
  });

  return (
    <div className="space-y-4 max-w-full">
      {/* Toolbar */}
      <div className="bg-paper p-3 rounded border border-line flex flex-wrap items-center justify-between gap-3 shadow-card">
        <div className="flex items-center gap-3">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
          <span className="text-xs text-muted font-mono">
            {isLoading ? "Loading..." : `${data?.pagination?.total || 0} activity events`}
          </span>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-paper rounded border border-line-strong shadow-card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-230px)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface border-b border-line-strong text-muted text-xs font-medium sticky top-0 z-20">
              <tr className="h-10">
                <th className="py-2 px-3 w-8 text-center border-r border-line">
                  <input type="checkbox" className="rounded text-brand" />
                </th>
                <th className="py-2 px-3 w-44 font-medium border-r border-line font-mono">Recorded (London)</th>
                <th className="py-2 px-3 w-36 font-medium border-r border-line font-mono">Job ID</th>
                <th className="py-2 px-3 w-32 font-medium border-r border-line">Driver</th>
                <th className="py-2 px-3 w-48 font-medium border-r border-line">Action</th>
                <th className="py-2 px-3 w-48 font-medium border-r border-line">State Transition</th>
                <th className="py-2 px-3 min-w-[200px] font-medium">Detail</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line bg-paper">
              {isLoading && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <tr key={i} className="h-[52px] animate-pulse">
                      <td className="py-3 px-3 text-center border-r border-line"><div className="w-3.5 h-3.5 bg-surface rounded mx-auto" /></td>
                      <td className="py-3 px-3 border-r border-line"><div className="w-24 h-4 bg-surface rounded" /></td>
                      <td className="py-3 px-3 border-r border-line"><div className="w-20 h-4 bg-surface rounded" /></td>
                      <td className="py-3 px-3 border-r border-line"><div className="w-16 h-4 bg-surface rounded" /></td>
                      <td className="py-3 px-3 border-r border-line"><div className="w-24 h-5 bg-surface rounded-pill" /></td>
                      <td className="py-3 px-3 border-r border-line"><div className="w-28 h-4 bg-surface rounded" /></td>
                      <td className="py-3 px-3"><div className="w-48 h-4 bg-surface rounded" /></td>
                    </tr>
                  ))}
                </>
              )}

              {error && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-status-red">
                    Failed to fetch activity log.
                  </td>
                </tr>
              )}

              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted">
                    <div className="w-10 h-10 rounded-pill bg-surface flex items-center justify-center mx-auto mb-2 text-muted">
                      <FileText className="w-5 h-5 opacity-60" />
                    </div>
                    <p className="text-btn text-ink">No activity records</p>
                    <p className="text-xs text-muted">No bot or field events recorded for this timeframe.</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                data?.items.map(act => (
                  <tr key={act.id} className="h-[52px] hover:bg-surface transition">
                    <td className="py-2.5 px-3 text-center border-r border-line">
                      <input type="checkbox" className="rounded text-brand" />
                    </td>

                    <td className="py-2.5 px-3 font-mono text-ink-2 text-[11px] whitespace-nowrap border-r border-line" title={act.timestamp}>
                      {formatLondonDateTime(act.timestamp)}
                    </td>

                    <td className="py-2.5 px-3 font-mono font-semibold text-brand text-xs whitespace-nowrap border-r border-line">
                      {act.jobId}
                    </td>

                    <td className="py-2.5 px-3 font-medium text-ink whitespace-nowrap border-r border-line">
                      {act.driver}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap border-r border-line">
                      <span className="px-2 py-0.5 rounded-pill bg-surface border border-line text-ink text-[11px] font-mono font-medium">
                        {act.action}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-muted whitespace-nowrap border-r border-line">
                      {act.fromState && act.toState ? (
                        <span className="flex items-center gap-1 text-ink-2">
                          {act.fromState} <ChevronRight className="w-3 h-3 text-muted" /> {act.toState}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-ink-2 text-xs truncate max-w-sm" title={act.detail}>
                      {act.detail || "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Sticky Pagination Bar */}
        {data?.pagination && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-paper text-xs text-muted sticky bottom-0">
            <div>
              Showing <span className="font-mono text-ink font-semibold">1–{data.items.length}</span> of{" "}
              <span className="font-mono text-ink font-semibold">{data.pagination.total}</span> events
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2.5 py-1 rounded border border-line bg-paper text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition"
              >
                Prev
              </button>
              <span className="px-2 font-mono text-ink">
                {page} / {data.pagination.totalPages || 1}
              </span>
              <button
                disabled={!data.pagination.hasMore}
                onClick={() => setPage(page + 1)}
                className="px-2.5 py-1 rounded border border-line bg-paper text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
