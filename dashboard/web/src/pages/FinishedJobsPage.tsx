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
import { PdfPreviewModal } from "../components/PdfPreviewModal";
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
                  <th className="py-4 px-4 w-12 text-center font-semibold text-[12px] text-muted uppercase tracking-wider">#</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Driver</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Customer</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider min-w-[240px]">Pickup → Drop-off</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Started</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Finished</th>
                  <th className="py-4 px-6 font-semibold text-[12px] text-muted uppercase tracking-wider text-right">Total (£)</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider text-center">Photos</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider text-center">Signature</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider text-center">Docs</th>
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
                  
                  const p = job.pickup || "Not recorded";
                  const d = job.dropoff || "Not recorded";
                  const routeSummary = `${p} → ${d}`;
                  
                  const photos = job.evidenceItems?.filter((e: any) => e.type === "IMAGE" && (e.thumbProxyUrl || e.driveUrl)) || [];
                  const isTest = isTestOrIncomplete(job);
                  const resolvedDriver = resolveDriver(job.driverName);
                  const isUnassigned = resolvedDriver.code === "UN";

                  return (
                    <React.Fragment key={job.jobId}>
                      <tr
                        onClick={() => setExpandedJobId(isExpanded ? null : job.jobId)}
                        className={`h-[64px] group cursor-pointer transition select-none ${
                          isExpanded ? "bg-surface/50" : "hover:bg-[#F9FAFB]"
                        } ${isTest ? "opacity-70" : ""} ${resolvedDriver.needsReassignment ? 'bg-[#FFFBEB]/50' : ''}`}
                      >
                        <td className="px-4 text-center font-mono text-[12px] text-muted">{rowNumber}</td>

                        <td className="px-4">
                          <div className="flex flex-col items-start justify-center leading-tight">
                            <button 
                              className={`font-medium text-[14px] ${isUnassigned ? 'text-muted' : 'text-[#2563EB] hover:underline'}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {resolvedDriver.name}
                            </button>
                            {!isUnassigned && resolvedDriver.vehicleReg && (
                              <span className="bg-line/50 px-1 py-[1px] mt-0.5 rounded-[3px] font-mono font-bold uppercase text-[9px] text-ink">{formatVanReg(resolvedDriver.vehicleReg)}</span>
                            )}
                            {resolvedDriver.needsReassignment && (
                              <span className="text-[9px] uppercase tracking-wider font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 mt-0.5 rounded-full">Needs Reassignment</span>
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
                            <span className="truncate max-w-[160px] text-ink">{p}</span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[160px] text-ink">{d}</span>
                          </div>
                        </td>

                        <td className="px-4 text-[13px] text-muted">{startedTime}</td>
                        <td className="px-4 text-[13px] text-muted">{finishedTime}</td>

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
                          <button 
                            className="p-1.5 rounded-md text-muted hover:text-[#2563EB] hover:bg-[#2563EB]/10 transition inline-flex items-center justify-center"
                            title="Open Evidence Folder"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (job.driveFolderUrl) window.open(job.driveFolderUrl, "_blank");
                            }}
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                        </td>

                        <td className="px-4 text-center">
                          <div className="opacity-0 group-hover:opacity-100 transition text-muted">
                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={11} className="p-0 border-b border-line bg-[#FAFAFA]">
                            <div className="p-6 text-[13px] text-muted flex items-center gap-2">
                               {/* Drawer handles the deep dive on the active Jobs page, keeping Finished jobs expanded view simple for now */}
                               <AlertTriangle className="w-4 h-4 text-amber-500" />
                               <span className="font-medium text-ink">Job Details Panel</span>
                               <span className="mx-2 text-line-strong">|</span>
                               <span>Full historical record for {job.jobId}</span>
                            </div>
                          </td>
                        </tr>
                      )}
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
        <>
          <PaperDossierReport job={previewJob} />
          <PdfPreviewModal
            job={previewJob}
            isOpen={!!previewJob}
            onClose={() => setPreviewJob(null)}
            onDownload={() => {
              setPreviewJob(null);
              setTimeout(() => window.print(), 100);
            }}
          />
        </>
      )}
    </div>
  );
}
