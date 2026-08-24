import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, CheckCircle2, Banknote, AlertTriangle, ArrowRight, ShieldCheck, Plus, MoreHorizontal, Inbox, Calendar, Search } from "lucide-react";
import { fetchDrivers } from "../api/client";
import { DriverSummaryItem } from "../types";
import { DateRangePicker } from "../components/DateRangePicker";

interface Props {
  onFilterJobsByDriver?: (driverInitials: string) => void;
}

const NEW_ROSTER = [
  { fullName: "Caio Gabriel", initials: "KA", active: true },
  { fullName: "Henrique Driver", initials: "HE", active: true },
  { fullName: "Maico Lima", initials: "MK", active: true },
  { fullName: "Rafael Cruz", initials: "RF", active: true },
  { fullName: "Tiago Menagassi", initials: "TI", active: true },
  { fullName: "Wander Mendes", initials: "WM", active: true }, // Changed to WM to prevent collision
];

function AddDriverModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-6 border-b border-line flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-ink">Add New Driver</h2>
          <button onClick={onClose} className="p-2 text-muted hover:text-ink hover:bg-surface rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-ink mb-1.5">Full Name</label>
            <input type="text" className="w-full h-11 px-4 rounded-xl border border-line bg-surface focus:bg-white focus:border-brand transition text-[14px]" placeholder="e.g. John Doe" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-ink mb-1.5">Initials (Unique)</label>
            <input type="text" className="w-full h-11 px-4 rounded-xl border border-line bg-surface focus:bg-white focus:border-brand transition text-[14px]" placeholder="e.g. JD" maxLength={2} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-ink mb-1.5">Email</label>
            <input type="email" className="w-full h-11 px-4 rounded-xl border border-line bg-surface focus:bg-white focus:border-brand transition text-[14px]" placeholder="driver@example.com" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-ink mb-1.5">Phone Number</label>
            <input type="tel" className="w-full h-11 px-4 rounded-xl border border-line bg-surface focus:bg-white focus:border-brand transition text-[14px]" placeholder="+44 7700 900000" />
          </div>
        </div>
        <div className="p-6 border-t border-line flex items-center justify-end gap-3 bg-[#FAFAFA]">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold text-muted hover:text-ink hover:bg-surface transition text-[14px]">
            Cancel
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold bg-black text-white hover:bg-black/80 shadow-sm transition text-[14px]">
            Add Driver
          </button>
        </div>
      </div>
    </div>
  );
}

// Minimal X icon polyfill since we didn't import it at the top
const X = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

const getAvatarColor = (initials: string) => {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-purple-100 text-purple-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
    "bg-indigo-100 text-indigo-700",
    "bg-cyan-100 text-cyan-700",
    "bg-teal-100 text-teal-700",
  ];
  const charCode = initials.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
};

export function DriversPage({ onFilterJobsByDriver }: Props) {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["drivers_summary", from, to],
    queryFn: () => fetchDrivers(from, to)
  });

  // Data Merging and Logic Fixes
  const unassignedQueue = data?.drivers?.find((d: DriverSummaryItem) => d.initials === "UN" || d.fullName.toLowerCase().includes("unassigned"));
  const processedDrivers: DriverSummaryItem[] = [];

  if (data?.drivers) {
    data.drivers.forEach((d: DriverSummaryItem) => {
      // Isolate Unassigned
      if (d.initials === "UN" || d.fullName.toLowerCase().includes("unassigned")) { return; }
      
      let modified = { ...d };
      
      // Override Muhammad Roman collision
      if (modified.fullName === "Muhammad Roman" && modified.initials === "WD") {
        modified.initials = "MR";
      }

      // Fix completion logic (ensure 6/120 = 5% not 100%)
      modified.completionRate = modified.assigned === 0 ? 0 : Math.round((modified.completed / modified.assigned) * 100);

      processedDrivers.push(modified);
    });
  }

  // Merge new static roster if they don't exist in fetched data
  NEW_ROSTER.forEach(newDriver => {
    if (!processedDrivers.find(d => d.initials === newDriver.initials || d.fullName === newDriver.fullName)) {
      processedDrivers.push({
        initials: newDriver.initials,
        fullName: newDriver.fullName,
        email: "",
        active: newDriver.active,
        assigned: 0,
        completed: 0,
        cancelled: 0,
        completionRate: 0,
        avgDurationMinutes: 0,
        avgDelayMinutes: 0,
        revenuePounds: 0,
        cashCollectedPounds: 0,
        missingEvidenceCount: 0, revenueFormatted: "£0.00", overtimeCount: 0 });
    }
  });

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-brand" />
          <h2 className="text-[20px] font-bold text-ink">Drivers</h2>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-full font-semibold shadow-sm hover:bg-black/80 transition"
        >
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="p-2 bg-white rounded-[16px] shadow-sm border border-transparent flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl">
          {["All Time", "Today", "7 Days", "30 Days"].map((l,i) => (
            <button key={i} className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-muted hover:text-ink hover:bg-white/50 transition">
              {l}
            </button>
          ))}
        </div>
        
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        
        <div className="w-[1px] h-6 bg-line ml-2 mr-2" />
        
        <span className="text-[13px] text-muted font-medium">
          {isLoading ? "..." : `${processedDrivers.length} active drivers`}
        </span>
      </div>

      {/* UNASSIGNED QUEUE (Isolated Top Tile) */}
      {unassignedQueue && unassignedQueue.assigned > 0 && (
        <div className="bg-[#FFFBEB] border border-amber-200 rounded-[16px] p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200 border-dashed">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-amber-900">Unassigned Jobs Queue</h3>
              <p className="text-[13px] text-amber-700/80 mt-0.5">These jobs are currently active but lack driver assignments.</p>
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <span className="block text-[24px] font-bold font-mono text-amber-600">{unassignedQueue.assigned}</span>
              <span className="block text-[11px] font-semibold uppercase text-amber-600/70 tracking-wider">Jobs Pending</span>
            </div>
            <div className="text-center">
              <span className="block text-[24px] font-bold font-mono text-amber-600">£{(unassignedQueue.revenuePounds || 0).toFixed(0)}</span>
              <span className="block text-[11px] font-semibold uppercase text-amber-600/70 tracking-wider">Potential Rev</span>
            </div>
          </div>
        </div>
      )}

      {/* DRIVER CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        {!isLoading && processedDrivers.map((driver) => {
          
          const isTestAccount = driver.fullName.toLowerCase() === "hh" || driver.fullName.toLowerCase().includes("test");
          
          return (
            <div
              key={driver.initials}
              className={`bg-white rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-line p-6 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer relative group ${isTestAccount ? 'opacity-60 grayscale-[50%]' : ''}`}
            >
              {/* Header Row */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] ${getAvatarColor(driver.initials)}`}>
                    {driver.initials}
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-[15px] flex items-center gap-1.5 leading-tight">
                      {isTestAccount ? "Test Account" : driver.fullName}
                      {driver.active && !isTestAccount && (
                        <span title="Background & license verified" className="cursor-help">
                          <ShieldCheck className="w-4 h-4 text-brand" />
                        </span>
                      )}
                    </h3>
                    <span className="text-[13px] text-muted leading-tight mt-1 block">
                      {driver.email || "No email provided"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    driver.active ? "bg-status-green-bg text-status-green" : "bg-surface text-muted"
                  }`}>
                    {driver.active ? "Active" : "Inactive"}
                  </span>
                  
                  {/* Overflow menu triggers */}
                  <button className="p-1 rounded-full text-muted hover:bg-surface hover:text-ink transition opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stats Grid 2x2 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <span className="text-muted block text-[12px] mb-1">Completed Jobs</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-ink text-[18px] tabular-nums leading-none">
                      {driver.completed} / {driver.assigned}
                    </span>
                  </div>
                  <span className="text-[11px] text-status-green font-semibold mt-1.5 block tracking-wide">
                    {driver.completionRate}% COMPLETION
                  </span>
                </div>

                <div>
                  <span className="text-muted block text-[12px] mb-1">Revenue Handled</span>
                  <span className="font-bold text-ink text-[18px] tabular-nums leading-none block">
                    £{driver.revenuePounds.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-muted font-medium mt-1.5 block tracking-wide">
                    £{driver.cashCollectedPounds.toFixed(2)} CASH
                  </span>
                </div>

                <div>
                  <span className="text-muted block text-[12px] mb-1">Avg Start Delay</span>
                  <span className={`font-bold text-[16px] tabular-nums leading-none block ${driver.avgDelayMinutes > 15 ? 'text-status-red' : 'text-status-green'}`}>
                    +{driver.avgDelayMinutes} mins
                  </span>
                </div>

                <div>
                  <span className="text-muted block text-[12px] mb-1">Avg Move Time</span>
                  <span className="font-bold text-ink text-[16px] tabular-nums leading-none block">
                    {driver.avgDurationMinutes} mins
                  </span>
                </div>
              </div>

              {/* Evidence Banner */}
              {driver.missingEvidenceCount > 0 && (
                <div className={`mt-5 p-2.5 rounded-[8px] flex items-center gap-2 text-[12px] font-semibold border ${
                  driver.missingEvidenceCount >= 10 
                    ? "bg-[#FEF2F2] text-status-red border-[#FECACA]" 
                    : "bg-[#FFFBEB] text-amber-700 border-[#FDE68A]"
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{driver.missingEvidenceCount} missing/failed evidence uploads</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddDriverModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}
