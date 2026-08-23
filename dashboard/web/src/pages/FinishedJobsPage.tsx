import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Table as TableIcon,
  LayoutGrid,
  User,
  MapPin,
  Camera,
  X
} from "lucide-react";
import { fetchJobs } from "../api/client";
import { NormalizedJob } from "../types";
import { PaperJobReport } from "../components/PaperJobReport";
import { DateRangePicker } from "../components/DateRangePicker";
import { PhotoModal } from "../components/PhotoModal";
import { ThumbnailPreview } from "../components/ThumbnailPreview";
import { formatLondonDateTime } from "../utils/date";
import { toPounds } from "../types";

export function FinishedJobsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [activePhoto, setActivePhoto] = useState<{ title: string; url: string; driveUrl?: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["finished_jobs", page, pageSize, from, to],
    queryFn: () => fetchJobs({ status: "COMPLETED", page, pageSize, from, to })
  });

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-brand" />
          <h2 className="text-[20px] font-bold text-ink">Finished Jobs</h2>
        </div>
      </div>

      {/* TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex flex-wrap items-center gap-6">
          {/* Segmented Control */}
          <div className="flex items-center p-1.5 bg-white rounded-[16px] shadow-sm border border-transparent">
            
            <div className="flex items-center gap-1 bg-surface p-1 rounded-[12px]">
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
            
            <div className="w-px h-6 bg-line mx-3" />
            
            <div className="flex items-center gap-2">
              <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
            </div>

          </div>

          <span className="text-[13px] text-muted">
            {isLoading ? "Loading..." : `${data?.pagination?.total || 0} finished jobs`}
          </span>
        </div>

        <button
          onClick={() => { window.location.href = "/ops/api/jobs/export.csv?status=COMPLETED"; }}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-transparent hover:bg-surface text-ink-2 shadow-sm transition"
          title="Export CSV"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Main Table View */}
      {viewMode === "table" && (
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-4 px-4 w-10 text-center">
                    <input type="checkbox" className="rounded text-brand" />
                  </th>
                  <th className="py-4 px-2 w-10 text-center font-mono text-[12px] font-semibold text-muted">#</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em]">Job & Driver</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em]">Completed</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em]">Customer</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em] w-1/4">Route</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em] text-center">Evidence</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-[0.05em] text-center">Signature</th>
                  <th className="py-4 px-6 font-semibold text-[12px] text-muted uppercase tracking-[0.05em] text-right">Total Billed</th>
                  <th className="py-4 px-4 w-10"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {!isLoading && data?.items.map((job: NormalizedJob, index: number) => {
                  const isExpanded = expandedJobId === job.jobId;
                  const totalPounds = toPounds(job.totalCharges);
                  const rowNumber = (page - 1) * pageSize + index + 1;
                  const formattedTime = formatLondonDateTime(job.actualFinish || job.bookedFinish);
                  const routeSummary = job.pickup && job.dropoff ? `${job.pickup} -> ${job.dropoff}` : "Not recorded";
                  const photos = job.evidenceItems?.filter((e: any) => e.type === "IMAGE" && (e.thumbProxyUrl || e.driveUrl)) || [];
                  
                  const driverInit = job.driverInitials || "UN";
                  const driverColor = driverInit === "UN" ? "bg-amber-100 text-amber-700" : "bg-brand-soft text-brand";
                  const unassignedHint = driverInit === "UN" ? "bg-red-50" : "";

                  return (
                    <React.Fragment key={job.jobId}>
                      <tr
                        onClick={() => setExpandedJobId(isExpanded ? null : job.jobId)}
                        className={`h-[64px] group cursor-pointer transition select-none ${
                          isExpanded ? "bg-surface/50" : "hover:bg-surface/30"
                        } ${unassignedHint}`}
                      >
                        <td className="px-4 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded text-brand" />
                        </td>
                        <td className="px-2 text-center font-mono text-[12px] text-muted">{rowNumber}</td>

                        <td className="px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${driverColor}`}>
                              {driverInit}
                            </div>
                            <div>
                              <div className="font-medium text-brand text-[14px] leading-tight hover:underline">
                                {job.jobId}
                              </div>
                              <div className="text-[13px] text-muted leading-tight mt-0.5">{job.driverName || "Unassigned"}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 text-[14px] text-ink">{formattedTime}</td>

                        <td className="px-4">
                          <div className="flex items-center gap-2 text-[14px] text-ink">
                            <User className="w-4 h-4 text-muted shrink-0" />
                            <span className="truncate max-w-[150px]">{job.customerName || "Not recorded"}</span>
                          </div>
                        </td>

                        <td className="px-4">
                          <div className="flex items-center gap-2 text-[14px] text-ink" title={routeSummary}>
                            <MapPin className="w-4 h-4 text-muted shrink-0" />
                            <span className="truncate w-[200px] block">{routeSummary || "Not recorded"}</span>
                          </div>
                        </td>

                        <td className="px-4 text-center">
                          <div className="flex items-center justify-center">
                            {photos && photos.length > 0 ? (
                              <div className="flex items-center">
                                {photos.slice(0, 3).map((p, i) => (
                                  <div key={i} className={`w-8 h-8 rounded-lg overflow-hidden border-2 border-white bg-surface ${i > 0 ? "-ml-3" : ""}`}>
                                    {(p.thumbProxyUrl || p.driveUrl) ? (
                                      <img src={(p.thumbProxyUrl || p.driveUrl)} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-surface text-muted">
                                        <Camera className="w-3 h-3" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {photos.length > 3 && (
                                  <div className="w-8 h-8 rounded-lg border-2 border-white bg-surface flex items-center justify-center text-[11px] font-medium text-muted -ml-3 z-10">
                                    +{photos.length - 3}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted text-[13px]">-</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 text-center">
                          {job.signatureUrl ? (
                            <img
                              src={job.signatureUrl}
                              alt="Sig"
                              className="w-16 h-8 object-contain mx-auto border border-line bg-surface rounded-lg p-0.5"
                            />
                          ) : (
                            <div className="w-12 h-6 rounded-full border border-dashed border-line-strong mx-auto" />
                          )}
                        </td>

                        <td className="px-6 text-right">
                          <div className={`font-mono text-[14px] font-bold tabular-nums ${totalPounds === 0 ? "text-muted font-medium" : "text-ink"}`}>
                            £{totalPounds.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                          </div>
                        </td>

                        <td className="px-4 text-center">
                          <div className="opacity-0 group-hover:opacity-100 transition text-muted">
                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0 border-b border-line bg-surface/10">
                            <div className="p-6">
                              <PaperJobReport job={job} />
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

      {/* Cards View (Left intact for brevity, normally we'd style it too) */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data?.items.map((job: NormalizedJob) => (
             <div key={job.jobId} className="bg-white p-6 rounded-[24px] shadow-sm border border-line">
               <h3 className="font-bold text-brand mb-2">{job.jobId}</h3>
               <p className="text-sm text-ink mb-4">{job.customerName}</p>
             </div>
          ))}
        </div>
      )}

      {activePhoto && (
        <PhotoModal
          isOpen={!!activePhoto}
          onClose={() => setActivePhoto(null)}
          title={activePhoto.title}
          photoUrl={activePhoto.url}
          driveUrl={activePhoto.driveUrl}
        />
      )}
    </div>
  );
}
