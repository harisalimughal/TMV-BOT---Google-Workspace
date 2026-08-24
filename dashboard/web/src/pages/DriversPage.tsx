import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJobs } from "../api/client";
import { 
  Plus, 
  MoreHorizontal, 
  AlertTriangle,
  Inbox,
  ShieldCheck,
  Mail,
  Phone,
  Truck
} from "lucide-react";
import { DateRangePicker } from "../components/DateRangePicker";
import { ACTIVE_DRIVERS, getAvatarColor, formatVanReg, resolveDriver } from "../utils/drivers";
import { AddDriverModal } from "../components/AddDriverModal";

interface DriverSummaryItem {
  name: string;
  code: string;
  email: string;
  phone: string;
  vehicleReg: string;
  active: boolean;
  assigned: number;
  completed: number;
  revenuePounds: number;
  cashCollectedPounds: number;
  missingEvidenceCount: number;
  avgDelayMinutes: number;
  avgDurationMinutes: number;
}

export function DriversPage() {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", "all", from, to],
    queryFn: () => fetchJobs(),
    staleTime: 30000
  });

  // Calculate stats against the single source of truth roster
  const driverStats = new Map<string, DriverSummaryItem>();
  
  // Initialize with baseline roster
  ACTIVE_DRIVERS.forEach(d => {
    driverStats.set(d.code, {
      name: d.name,
      code: d.code,
      email: d.email,
      phone: d.phone,
      vehicleReg: d.vehicleReg,
      active: d.active,
      assigned: 0,
      completed: 0,
      revenuePounds: 0,
      cashCollectedPounds: 0,
      missingEvidenceCount: 0,
      avgDelayMinutes: 0, // Placeholder calculation below
      avgDurationMinutes: 0 // Placeholder calculation below
    });
  });

  let unassignedQueue = {
    assigned: 0,
    revenuePounds: 0
  };

  const jobs = data?.items || [];

  jobs.forEach(job => {
    const r = resolveDriver(job.driverName);
    
    // Ignore legacy unmapped drivers from metrics, or put them in Unassigned
    if (r.needsReassignment || r.code === "UN") {
       unassignedQueue.assigned += 1;
       unassignedQueue.revenuePounds += job.totalCharges || 0;
       return;
    }

    const dState = driverStats.get(r.code);
    if (!dState) return;

    dState.assigned += 1;
    if (job.status === "COMPLETED") {
      dState.completed += 1;
    }
    dState.revenuePounds += job.totalCharges || 0;
    if (job.paymentStatus === "Paid") {
      dState.cashCollectedPounds += job.totalCharges || 0;
    }

    const hasMissing = Object.values(job.evidenceCompleteness || {}).some(s => s === "MISSING");
    if (hasMissing && job.status === "COMPLETED") {
      dState.missingEvidenceCount += 1;
    }
  });

  const processedDrivers = Array.from(driverStats.values());

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-[20px] font-bold text-ink">Drivers</h2>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-full font-semibold shadow-sm hover:bg-blue-700 transition"
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
          {isLoading ? "..." : `${processedDrivers.filter(d => d.active).length} active drivers`}
        </span>
      </div>

      {/* UNASSIGNED QUEUE (Isolated Top Tile) */}
      {unassignedQueue.assigned > 0 && (
        <div className="bg-[#FFFBEB] border border-amber-200 rounded-[16px] p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200 border-dashed">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-amber-900">Unassigned Jobs Queue (Includes Legacy/Unmapped Data)</h3>
              <p className="text-[13px] text-amber-700/80 mt-0.5">These jobs are active but lack assignment to the current 7-driver roster.</p>
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
          
          const completionRate = driver.assigned > 0 
            ? Math.round((driver.completed / driver.assigned) * 100) 
            : 0;

          return (
            <div
              key={driver.code}
              className="bg-white rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-line p-6 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer relative group"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] ${getAvatarColor(driver.code)}`}>
                    {driver.code}
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-[16px] flex items-center gap-1.5 leading-tight">
                      {driver.name}
                      {driver.active && (
                        <span title="Verified Active" className="cursor-help">
                          <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-bold uppercase tracking-wider ${
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

              {/* Contact / Van Reg Line */}
              <div className="flex flex-col gap-2 mb-6 text-[13px] text-muted">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {driver.email}</span>
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {driver.phone}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Truck className="w-4 h-4 text-ink-2" /> 
                  <span className="px-2 py-1 rounded-[4px] border border-line bg-surface font-mono font-bold text-ink tracking-widest text-[12px] shadow-sm uppercase">
                    {formatVanReg(driver.vehicleReg)}
                  </span>
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
                    {completionRate}% COMPLETION
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
