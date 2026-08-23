import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, CheckCircle2, Banknote, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { fetchDrivers } from "../api/client";
import { DriverSummaryItem } from "../types";
import { DateRangePicker } from "../components/DateRangePicker";

interface Props {
  onFilterJobsByDriver?: (driverInitials: string) => void;
}

export function DriversPage({ onFilterJobsByDriver }: Props) {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["drivers_summary", from, to],
    queryFn: () => fetchDrivers(from, to)
  });

  return (
    <div className="space-y-4 max-w-full">
      {/* Header Toolbar */}
      <div className="bg-paper p-3 rounded border border-line flex flex-wrap items-center justify-between gap-3 shadow-card">
        <div className="flex items-center gap-3">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          <span className="text-xs text-muted font-mono">
            {isLoading ? "Loading..." : `${data?.drivers?.length || 0} drivers`}
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-paper rounded border border-line animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-8 text-center text-status-red bg-paper rounded border border-line shadow-card">
          Failed to load driver statistics.
        </div>
      )}

      {/* Driver Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!isLoading &&
          data?.drivers.map((driver: DriverSummaryItem) => (
            <div
              key={driver.initials}
              className="p-5 bg-paper rounded border border-line shadow-card flex flex-col justify-between hover:border-line-strong transition"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-pill bg-brand-soft text-brand font-mono font-bold text-xs flex items-center justify-center">
                      {driver.initials}
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink text-sm flex items-center gap-1.5">
                        {driver.fullName}
                        {driver.active && <ShieldCheck className="w-3.5 h-3.5 text-brand" />}
                      </h3>
                      <span className="text-xs text-muted font-mono">{driver.email || "No email"}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-pill text-xs font-medium ${
                      driver.active
                        ? "bg-status-green-bg text-status-green border border-status-green/20"
                        : "bg-surface text-muted border border-line"
                    }`}
                  >
                    {driver.active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-line text-xs">
                  <div>
                    <span className="text-muted block text-[11px]">Completed Jobs</span>
                    <span className="font-semibold font-mono text-ink text-base">
                      {driver.completed} / {driver.assigned}
                    </span>
                    <span className="text-[10px] text-status-green font-medium block">
                      {driver.completionRate}% completion
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Revenue Handled</span>
                    <span className="font-semibold font-mono text-ink text-base">
                      £{driver.revenuePounds.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted block">
                      £{driver.cashCollectedPounds.toFixed(2)} cash
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Avg Start Delay</span>
                    <span
                      className={`font-semibold font-mono text-sm ${
                        driver.avgDelayMinutes > 15 ? "text-status-red" : "text-ink"
                      }`}
                    >
                      +{driver.avgDelayMinutes} mins
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Avg Move Time</span>
                    <span className="font-semibold font-mono text-ink text-sm">
                      {driver.avgDurationMinutes} mins
                    </span>
                  </div>
                </div>

                {driver.missingEvidenceCount > 0 && (
                  <div className="mt-3 p-2 bg-status-red-bg border border-status-red/20 rounded flex items-center gap-2 text-xs text-status-red font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{driver.missingEvidenceCount} missing/failed evidence</span>
                  </div>
                )}
              </div>

              {onFilterJobsByDriver && (
                <button
                  onClick={() => onFilterJobsByDriver(driver.initials)}
                  className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-medium text-brand hover:underline transition"
                >
                  <span>View all jobs for {driver.initials}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
