import React, { useState } from "react";
import { ChevronUp, ChevronDown, Radio, Volume2, VolumeX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchActivity } from "../api/client";
import { formatLondonTimeOnly } from "../utils/date";

export function LiveActivityTicker() {
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery({
    queryKey: ["ticker_activity"],
    queryFn: () => fetchActivity(1),
    refetchInterval: 12000
  });

  const latestEvents = data?.items.slice(0, 5) || [];
  const latest = latestEvents[0];

  return (
    <div className="bg-paper border-t border-line text-ink text-xs px-6 py-2 flex flex-col transition-all z-20 sticky bottom-0 shadow-card">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Live Connection Telemetry */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-green"></span>
          </span>
          <span className="font-mono text-[11px] font-semibold text-brand">LIVE DISPATCH FEED</span>
          <span className="hidden sm:inline text-[11px] text-muted font-mono border-l border-line pl-2.5">
            London Fleet Active
          </span>
        </div>

        {/* Middle: Latest Event Banner */}
        <div className="flex-1 overflow-hidden flex items-center gap-2 text-[11px]">
          {latest ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-muted text-[10px]">{formatLondonTimeOnly(latest.timestamp)}</span>
              <span className="font-mono font-semibold text-brand text-[11px]">[{latest.jobId}]</span>
              <span className="font-medium text-ink">{latest.driver}:</span>
              <span className="text-ink-2 truncate">{latest.action} &bull; {latest.detail || "State updated"}</span>
            </div>
          ) : (
            <span className="text-muted italic">Monitoring field actions across London...</span>
          )}
        </div>

        {/* Right: Expand Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface hover:bg-surface-2 text-ink-2 text-[11px] font-mono transition border border-line"
          >
            <span>{expanded ? "Hide Feed" : "Recent Events"}</span>
            {expanded ? <ChevronDown className="w-3 h-3 text-muted" /> : <ChevronUp className="w-3 h-3 text-muted" />}
          </button>
        </div>
      </div>

      {/* Expanded Multi-Event Feed */}
      {expanded && (
        <div className="pt-2.5 mt-2 border-t border-line space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
          {latestEvents.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-surface transition">
              <span className="text-muted text-[10px]">{formatLondonTimeOnly(ev.timestamp)}</span>
              <span className="text-brand font-semibold">{ev.jobId}</span>
              <span className="text-ink font-medium">{ev.driver}</span>
              <span className="px-1.5 py-0.2 bg-surface rounded text-[10px] text-ink-2 border border-line">
                {ev.action}
              </span>
              <span className="text-muted truncate">{ev.detail || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
