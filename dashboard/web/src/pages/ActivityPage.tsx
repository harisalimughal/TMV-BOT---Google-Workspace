import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, ChevronRight } from "lucide-react";
import { fetchActivity } from "../api/client";
import { DateRangePicker } from "../components/DateRangePicker";

export function ActivityPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["activity_log", page, from, to],
    queryFn: () => fetchActivity(page, from, to)
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Field & Bot Activity Audit Log</h2>
          <p className="text-xs text-muted">Chronological audit records directly from ActivityLog tab</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
      </div>

      <div className="bg-paper rounded-xl border border-line shadow-paper overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface border-b border-line text-muted font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-mono">Timestamp</th>
                <th className="py-3 px-4 font-mono">Job ID</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">State Transition</th>
                <th className="py-3 px-4">Detail</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    Loading activity records...
                  </td>
                </tr>
              )}

              {error && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-status-red">
                    Failed to fetch activity log.
                  </td>
                </tr>
              )}

              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    No activity entries found for this timeframe.
                  </td>
                </tr>
              )}

              {!isLoading &&
                data?.items.map(act => (
                  <tr key={act.id} className="hover:bg-surface/50">
                    <td className="py-3 px-4 font-mono text-muted whitespace-nowrap">{act.timestamp}</td>
                    <td className="py-3 px-4 font-mono font-bold text-tmv-blue whitespace-nowrap">{act.jobId}</td>
                    <td className="py-3 px-4 font-semibold text-ink whitespace-nowrap">{act.driver}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-surface-2 text-ink-2 font-mono font-bold text-[11px]">
                        {act.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted whitespace-nowrap">
                      {act.fromState && act.toState ? (
                        <span className="flex items-center gap-1">
                          {act.fromState} <ChevronRight className="w-3 h-3 text-muted" /> {act.toState}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted italic max-w-sm truncate">{act.detail || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {data?.pagination && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-surface text-xs text-muted">
            <div>
              Showing <span className="font-bold text-ink">{data.items.length}</span> of{" "}
              <span className="font-bold text-ink">{data.pagination.total}</span> events
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-line bg-paper text-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-2 transition"
              >
                Previous
              </button>
              <span className="px-2 font-mono font-bold text-ink">
                Page {page} of {data.pagination.totalPages || 1}
              </span>
              <button
                disabled={!data.pagination.hasMore}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-line bg-paper text-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-2 transition"
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
