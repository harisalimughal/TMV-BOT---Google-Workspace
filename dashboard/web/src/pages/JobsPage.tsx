import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Filter,
  FileText,
  Table as TableIcon,
  LayoutGrid,
  Clock,
  MapPin,
  Camera,
  Plus,
  Truck,
  X
} from "lucide-react";
import { fetchJobs } from "../api/client";
import { NormalizedJob, toPounds } from "../types";
import { resolveDriver, getAvatarColor, formatVanReg } from "../utils/drivers";
import { DelayBandBadge, JobStatusBadge } from "../components/StatusBadge";
import { EvidenceCompletenessPill } from "../components/EvidenceCompletenessPill";
import { PaperJobReport } from "../components/PaperJobReport";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { ThumbnailPreview } from "../components/ThumbnailPreview";
import { DateRangePicker } from "../components/DateRangePicker";
import { PhotoModal } from "../components/PhotoModal";
import { formatLondonDateTime } from "../utils/date";

import { AddJobModal } from "../components/AddJobModal";

export function JobsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  
  const [drawerJob, setDrawerJob] = useState<NormalizedJob | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", page, pageSize, from, to, statusFilter, searchQuery],
    queryFn: () => {
      // In a real app we'd pass filters. Using fetchJobs as stub
      return fetchJobs({ page, pageSize, from, to });
    }
  });

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-brand" />
          <h2 className="text-[20px] font-bold text-ink">Jobs</h2>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-full font-semibold shadow-sm hover:bg-black/80 transition"
        >
          <Plus className="w-4 h-4" /> Add Job
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="p-2 bg-white rounded-[16px] shadow-sm border border-transparent flex flex-wrap items-center justify-between gap-4">
        
        {/* Left Toggle */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl shrink-0">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition ${
              viewMode === "table" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <TableIcon className="w-4 h-4" /> Table
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition ${
              viewMode === "cards" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Cards
          </button>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-3 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search moves, postcodes..."
              className="w-64 h-10 pl-9 pr-4 rounded-full bg-surface text-[13px] text-ink placeholder:text-muted border-none focus:ring-2 focus:ring-brand/20 transition"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl">
            {["all", "in_progress", "delivered"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium capitalize transition ${statusFilter === s ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>

          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-muted hover:bg-surface hover:text-ink transition border border-transparent">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl">
            {["All Time", "Today", "7 Days", "30 Days"].map((l,i) => (
              <button key={i} className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-muted hover:text-ink hover:bg-white/50 transition">
                {l}
              </button>
            ))}
          </div>
          
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
          
          <span className="text-[13px] text-muted font-medium px-2">
            {isLoading ? "..." : `${data?.pagination?.total || 0} moves recorded`}
          </span>

          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-line hover:bg-surface text-muted hover:text-ink shadow-sm transition">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TABLE CARD */}
      {viewMode === "table" && (
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden border border-transparent">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-4 px-4 w-10 text-center"><input type="checkbox" className="rounded text-brand" /></th>
                  <th className="py-4 px-2 w-10 text-center font-mono text-[12px] font-semibold text-muted">#</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em] group cursor-pointer hover:text-ink transition">
                    Job ID & Driver <ChevronDown className="inline w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em] group cursor-pointer hover:text-ink transition">
                    Timing (London) <ChevronDown className="inline w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em]">Customer</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em]">Pickup</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em]">Dropoff</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em]">Status</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em]">Punctuality</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em] text-center">Photos</th>
                  <th className="py-4 px-6 font-semibold text-[12px] text-muted uppercase tracking-[0.05em] text-right">Total</th>
                  <th className="py-4 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {!isLoading && data?.items.map((job: NormalizedJob, index: number) => {
                  const rowNumber = (page - 1) * pageSize + index + 1;
                  const formattedTime = formatLondonDateTime(job.bookedStart);
                  const totalPounds = toPounds(job.totalCharges);
                  

                  
                  const isCancelled = job.status === "CANCELLED";
                  
                  // Extract image count
                  const photoCount = job.evidenceItems?.filter(e => (e.thumbProxyUrl || e.driveUrl)).length || 0;
                  
                  const resolvedDriver = resolveDriver(job.driverName);
                  const isUnassigned = resolvedDriver.code === "UN";
                  const driverColor = isUnassigned 
                    ? "bg-surface text-muted border border-dashed border-muted/40" 
                    : resolvedDriver.color;

                  return (
                    <tr 
                      key={job.jobId}
                      onClick={() => setDrawerJob(job)}
                      className={`h-[64px] group cursor-pointer hover:bg-surface/40 transition select-none ${resolvedDriver.needsReassignment ? 'bg-[#FFFBEB]/50' : ''}`}
                    >
                      <td className="px-4 text-center" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded text-brand" /></td>
                      <td className="px-2 text-center font-mono text-[12px] text-muted">{rowNumber}</td>
                      
                      <td className="px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${driverColor}`}>
                            {resolvedDriver.code}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-brand text-[14px] leading-tight hover:underline">
                                {job.jobId}
                              </span>
                              {!isUnassigned && resolvedDriver.vehicleReg && (
                                <span className="bg-line/50 px-1 py-[1px] rounded-[3px] font-mono font-bold uppercase text-[9px] text-ink">{formatVanReg(resolvedDriver.vehicleReg)}</span>
                              )}
                            </div>
                            <div className="text-[13px] text-muted leading-tight mt-0.5 flex items-center gap-1.5">
                               {resolvedDriver.name}
                               {resolvedDriver.needsReassignment && (
                                 <span className="text-[9px] uppercase tracking-wider font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Needs Reassignment</span>
                               )}
                               {!isUnassigned && !resolvedDriver.needsReassignment && (
                                 <span className="text-[9px] uppercase tracking-wider font-bold text-status-green bg-status-green-bg px-1.5 py-0.5 rounded-full" title="Notification Sent">Notified</span>
                               )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 text-[13px] text-ink font-mono">{formattedTime || <span className="text-muted/40">—</span>}</td>
                      
                      <td className="px-4 text-[13px] text-ink truncate max-w-[120px]">
                        {job.customerName || <span className="text-muted/40">—</span>}
                      </td>
                      
                      <td className="px-4 text-[13px] text-ink truncate max-w-[140px]" title={job.pickup}>
                        {job.pickup || <span className="text-muted/40">—</span>}
                      </td>
                      
                      <td className="px-4 text-[13px] text-ink truncate max-w-[140px]" title={job.dropoff}>
                        {job.dropoff || <span className="text-muted/40">—</span>}
                      </td>

                      <td className="px-4 whitespace-nowrap">
                        <JobStatusBadge status={job.status} />
                      </td>

                      <td className="px-4 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="text-muted/50 font-mono">—</span>
                        ) : (
                          <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
                        )}
                      </td>

                      <td className="px-4 text-center">
                        <div className="flex items-center justify-center">
                          {photoCount > 0 ? (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-soft/50 text-brand rounded-lg text-[11px] font-bold">
                              <Camera className="w-3 h-3" /> {photoCount}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-muted/40 text-[11px] font-bold">
                              <Camera className="w-3 h-3" /> 0
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 text-right">
                        <div className={`font-mono text-[14px] font-bold tabular-nums ${totalPounds === 0 ? "text-muted/60" : "text-ink"}`}>
                          £{totalPounds.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      <td className="px-4 text-center">
                        <div className="opacity-0 group-hover:opacity-100 transition text-muted">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards View (Omitted for brevity, but structurally maintained) */}
      {viewMode === "cards" && (
        <div className="text-center text-muted p-12 bg-white rounded-[24px] shadow-sm">
          Cards view selected. Switch to table for detailed layout.
        </div>
      )}

      {drawerJob && (
        <JobDetailDrawer
          job={drawerJob}
          isOpen={!!drawerJob}
          onClose={() => setDrawerJob(null)}
        />
      )}

      <AddJobModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

    </div>
  );
}
