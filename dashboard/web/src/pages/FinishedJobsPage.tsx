import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FolderOpen,
  Camera,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { SubmissionDetailDrawer } from "../components/SubmissionDetailDrawer";
import { FolderActionDropdown } from "../components/FolderActionDropdown";
import { PaperDossierReport } from "../components/PaperDossierReport";
import { FileText } from "lucide-react";
import { fetchJobs } from "../api/client";
import { NormalizedJob, toPounds } from "../types";
import { DateRangePicker } from "../components/DateRangePicker";
import { formatLondonDateTime } from "../utils/date";
const isTestOrIncomplete = (job: any) => { return job.customerName === "hh" || String(job.pickup).includes("test") || String(job.dropoff).includes("test"); };
import { resolveDriver, formatVanReg } from "../utils/drivers";

export function FinishedJobsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<NormalizedJob | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", "COMPLETED", page, pageSize, from, to],
    queryFn: () => fetchJobs({ status: "COMPLETED", page, pageSize, from, to })
  });

  const isTestOrIncomplete = (job: NormalizedJob) => {
    const cust = (job.customerName || "").toLowerCase();
    const p = (job.pickup || "").toLowerCase();
    const d = (job.dropoff || "").toLowerCase();
    
    if (cust.includes("test") || cust === "hh" || cust === "number test") return true;
    if (p.length < 5 || d.length < 5) return true;
    if (!p.includes(" ") || !d.includes(" ")) return true; // Single word route
    
    return false;
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between px-2">
        <h1 className="text-[20px] font-bold text-ink">Finished Jobs</h1>
        
        <div className="flex items-center gap-3">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
          <div className="w-px h-6 bg-line mx-2" />
          <button
            onClick={() => { window.location.href = "/ops/api/jobs/export.csv?status=COMPLETED"; }}
            className="h-10 px-4 rounded-[12px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium shadow-sm transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            className="h-10 px-4 rounded-[12px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium shadow-sm transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="h-64 bg-white rounded-[24px] border border-line animate-pulse flex items-center justify-center">
          <span className="text-muted font-medium">Loading records...</span>
        </div>
      )}

      {error && (
        <div className="p-8 text-center text-status-red bg-status-red-bg rounded-[24px] border border-status-red/20 shadow-sm">
          Failed to load finished jobs.
        </div>
      )}

      {/* Main Table View */}
      {!isLoading && !error && (
        <div className="bg-white rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-line overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[14px] border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-line bg-[#F7F7F7]/50">
                  <th className="py-4 px-4 w-12 text-center font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">#</th>
                  <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Driver</th>
                  <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Customer</th>
                  <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em] min-w-[240px]">Pickup → Drop-off</th>
                  <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Started</th>
                  <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Finished</th>
                  <th className="py-4 px-6 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em] text-right">Total (£)</th>
                  <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em] text-center">Photos</th>
                  <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em] text-center">Signature</th>
                  <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em] text-center">Docs</th>
                  <th className="py-4 px-4 w-10"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {data?.items.map((job: NormalizedJob, index: number) => {
                  const isExpanded = expandedJobId === job.jobId;
                  const totalPounds = toPounds(job.totalCharges);
                  const rowNumber = (page - 1) * pageSize + index + 1;
                  
                  const startedTime = job.actualStart ? formatLondonDateTime(job.actualStart) : "—";
                  const finishedTime = job.actualFinish ? formatLondonDateTime(job.actualFinish) : "—";
                  
                  const p = job.pickup || <span className="text-[14px] font-normal text-[#B0B0B0] italic">Not recorded</span>;
                  const d = job.dropoff || <span className="text-[14px] font-normal text-[#B0B0B0] italic">Not recorded</span>;
                  const routeSummary = `${p} → ${d}`;
                  
                  const photos = job.evidenceItems?.filter((e: any) => e.type === "IMAGE" && (e.thumbProxyUrl || e.driveUrl)) || [];
                  const isTest = isTestOrIncomplete(job);
                  const resolvedDriver = resolveDriver(job.driverName);
                  const isUnassigned = resolvedDriver.code === "UN";

                  return (
                    <React.Fragment key={job.jobId}>
                      <tr
                        onClick={() => setPreviewJob(job)}
                        className={`h-[64px] group cursor-pointer transition select-none ${
                          isExpanded ? "bg-surface/50" : "hover:bg-[#F9FAFB]"
                        } ${isTest ? "opacity-70" : ""} ${resolvedDriver.needsReassignment ? 'bg-[#FFFBEB]/50' : ''}`}
                      >
                        <td className="px-4 text-center font-mono text-[14px] font-bold text-muted tabular-nums">{rowNumber}</td>

                        <td className="px-4">
                          <div className="flex flex-col items-start justify-center leading-tight">
                            <button 
                              className={`font-semibold text-[14px] ${isUnassigned ? "text-muted" : "text-brand"}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {resolvedDriver.name}
                            </button>
                            {!isUnassigned && resolvedDriver.vehicleReg && (
                              <span className="bg-line/50 px-1 py-[1px] mt-0.5 rounded-[3px] font-mono font-bold uppercase text-[9px] text-ink">{formatVanReg(resolvedDriver.vehicleReg)}</span>
                            )}
                            {resolvedDriver.needsReassignment && (
                              <span className="text-[11px] uppercase tracking-[0.02em] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 mt-2 rounded-[6px]">Needs Reassignment</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 text-[14px] text-ink">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[150px]">{job.customerName || "—"}</span>
                            {isTest && (
                              <span className="px-1.5 py-0.5 rounded-[4px] bg-surface border border-line text-muted text-[10px] font-semibold uppercase tracking-wider" title="Test or Incomplete Record">
                                Test
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4">
                          <div className="flex items-center gap-2 text-[13px] text-muted" title={routeSummary}>
                            <span className="truncate max-w-[160px] text-[14px] font-normal text-ink">{p}</span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[160px] text-[14px] font-normal text-ink">{d}</span>
                          </div>
                        </td>

                        <td className="px-4 text-[13px] font-normal text-muted tabular-nums whitespace-nowrap">{startedTime}</td>
                        <td className="px-4 text-[13px] font-normal text-muted tabular-nums whitespace-nowrap">{finishedTime}</td>

                        <td className="px-6 text-right">
                          <div className="font-mono text-[15px] font-bold tabular-nums text-ink">
                            {totalPounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>

                        <td className="px-4 text-center">
                          <div className="flex items-center justify-center">
                            {photos.length > 0 ? (
                              <div className="flex items-center">
                                {photos.slice(0, 3).map((p, i) => (
                                  <div key={i} className={`w-8 h-8 rounded-lg overflow-hidden border-2 border-white bg-surface ${i > 0 ? "-ml-3" : ""}`}>
                                    <img src={(p.thumbProxyUrl || p.driveUrl)} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                                {photos.length > 3 && (
                                  <div className="w-8 h-8 rounded-lg border-2 border-white bg-surface flex items-center justify-center text-[11px] font-medium text-muted -ml-3 z-10">
                                    +{photos.length - 3}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Camera className="w-4 h-4 text-muted mx-auto opacity-50" />
                            )}
                          </div>
                        </td>

                        <td className="px-4 text-center">
                          {job.signatureUrl ? (
                            <img
                              src={job.signatureUrl}
                              alt="Sig"
                              className="w-12 h-6 object-contain mx-auto border border-line bg-white rounded-[4px] p-0.5"
                            />
                          ) : (
                            <div className="w-12 h-6 rounded-[4px] border border-dashed border-line-strong mx-auto" />
                          )}
                        </td>
                        
                        <td className="px-4 text-center">
      <FolderActionDropdown 
        hasFolderUrl={!!job.driveFolderUrl}
        onOpenFolder={() => window.open(job.driveFolderUrl, "_blank")}
        onPreview={() => setPreviewJob(job)}
        onDownload={() => {
          setPreviewJob(job);
          setTimeout(() => {
            const originalTitle = document.title;
            const dateStr = new Date().toISOString().slice(0, 10);
            document.title = `Job_Completed_${job.jobId}_${job.driverName?.replace(/\s+/g, '')}_${dateStr}`;
            window.print();
            document.title = originalTitle;
          }, 500);
        }}
      />
    </td>

                        <td className="px-4 text-center">
                          <div className="opacity-0 group-hover:opacity-100 transition text-muted">
                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </div>
                        </td>
                      </tr>

                      
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Pagination (simple) */}
      {!isLoading && !error && data?.pagination && (
         <div className="flex items-center justify-between px-2 text-[13px] text-muted">
           <span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.pagination.total)} of {data.pagination.total}</span>
           <div className="flex gap-2">
             <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-line rounded-[8px] bg-white hover:bg-surface disabled:opacity-50 transition font-medium text-ink">Previous</button>
             <button disabled={page * pageSize >= data.pagination.total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-line rounded-[8px] bg-white hover:bg-surface disabled:opacity-50 transition font-medium text-ink">Next</button>
           </div>
         </div>
      )}
          {previewJob && (
        <SubmissionDetailDrawer
          job={previewJob}
          isOpen={!!previewJob}
          onClose={() => setPreviewJob(null)}
          onNavigate={(dir) => {
            if (!data?.items) return;
            const idx = data.items.findIndex((j: any) => j.jobId === previewJob.jobId);
            if (dir === 'next' && idx < data.items.length - 1) setPreviewJob(data.items[idx + 1]);
            if (dir === 'prev' && idx > 0) setPreviewJob(data.items[idx - 1]);
          }}
          hasNext={data?.items ? data.items.findIndex((j: any) => j.jobId === previewJob.jobId) < data.items.length - 1 : false}
          hasPrev={data?.items ? data.items.findIndex((j: any) => j.jobId === previewJob.jobId) > 0 : false}
        />
      )}
    </div>
  );
}
