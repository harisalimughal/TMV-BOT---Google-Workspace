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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Driver Performance & Field Telemetry</h2>
          <p className="text-xs text-muted">Aggregated stats joined across Drivers, Bookings and Workflow State</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-56 bg-paper rounded-xl border border-line" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-8 text-center text-status-red bg-paper rounded-xl border border-line">
          Failed to load driver statistics.
        </div>
      )}

      {/* Driver Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!isLoading &&
          data?.drivers.map((driver: DriverSummaryItem) => (
            <div
              key={driver.initials}
              className="p-6 bg-paper rounded-xl border border-line shadow-paper flex flex-col justify-between hover:border-line-strong transition"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-navy-900 text-tmv-cyan font-bold font-mono text-base flex items-center justify-center shadow">
                      {driver.initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-ink text-sm flex items-center gap-1.5">
                        {driver.fullName}
                        {driver.active && <ShieldCheck className="w-4 h-4 text-tmv-blue" />}
                      </h3>
                      <span className="text-xs text-muted">{driver.email || "No email"}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      driver.active ? "bg-emerald-100 text-status-green" : "bg-gray-100 text-muted"
                    }`}
                  >
                    {driver.active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 py-4 border-y border-line text-xs">
                  <div>
                    <span className="text-muted block text-[11px]">Completed Jobs</span>
                    <span className="font-bold font-mono text-ink text-base">
                      {driver.completed} / {driver.assigned}
                    </span>
                    <span className="text-[10px] text-status-green font-semibold block">
                      {driver.completionRate}% completion rate
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Revenue Handled</span>
                    <span className="font-bold font-mono text-ink text-base">
                      £{driver.revenuePounds.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted block">
                      £{driver.cashCollectedPounds.toFixed(2)} cash collected
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Avg Start Delay</span>
                    <span
                      className={`font-bold font-mono text-sm ${
                        driver.avgDelayMinutes > 15 ? "text-status-red" : "text-ink"
                      }`}
                    >
                      {driver.avgDelayMinutes} mins
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Avg Job Duration</span>
                    <span className="font-bold font-mono text-ink text-sm">
                      {driver.avgDurationMinutes} mins
                    </span>
                  </div>
                </div>

                {driver.missingEvidenceCount > 0 && (
                  <div className="mt-3 p-2 bg-status-red-bg border border-red-200 rounded-lg flex items-center gap-2 text-[11px] text-status-red font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{driver.missingEvidenceCount} missing/failed evidence uploads</span>
                  </div>
                )}
              </div>

              {onFilterJobsByDriver && (
                <button
                  onClick={() => onFilterJobsByDriver(driver.initials)}
                  className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-xs font-semibold text-tmv-blue hover:text-tmv-blue-dark transition"
                >
                  <span>View all jobs for {driver.initials}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
