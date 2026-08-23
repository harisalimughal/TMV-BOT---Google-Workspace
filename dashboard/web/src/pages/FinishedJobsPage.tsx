import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  Table as TableIcon,
  LayoutGrid,
  FileText
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
    <div className="space-y-4 max-w-full">
      {/* Toolbar Row */}
      <div className="bg-paper p-3 rounded border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm hover:shadow-md transition">
        <div className="flex items-center gap-3">
          <div className="flex items-center p-0.5 bg-surface rounded border border-line text-[13px]">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[13px] font-medium transition ${
                viewMode === "table" ? "bg-paper text-ink shadow-sm hover:shadow-md transition font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[13px] font-medium transition ${
                viewMode === "cards" ? "bg-paper text-ink shadow-sm hover:shadow-md transition font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>

          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
          <span className="text-[13px] text-muted font-mono">
            {isLoading ? "Loading..." : `${data?.pagination?.total || 0} finished jobs`}
          </span>
        </div>

        <button
          onClick={() => { window.location.href = "/ops/api/jobs/export.csv?status=COMPLETED"; }}
          className="p-1.5 rounded border border-line bg-surface hover:bg-surface-2 text-ink-2 transition"
          title="Export Finished Jobs CSV"
        >
          <Download className="w-4 h-4 text-muted" />
        </button>
      </div>

      {/* Main Table View */}
      {viewMode === "table" && (
        <div className="bg-paper rounded-xl border border-line shadow-sm hover:shadow-md transition overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-230px)]">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead className="bg-surface border-b border-line-strong text-muted text-[13px] font-medium sticky top-0 z-20">
                <tr className="h-10">
                  <th className="py-2 px-3 w-8 text-center ">
                    <input type="checkbox" className="rounded text-brand" />
                  </th>
                  <th className="py-2 px-2 w-8 text-center font-mono text-[11px] text-muted ">
                    #
                  </th>

                  {/* Frozen Identity Column Header */}
                  <th className="py-2 px-3 w-56 font-medium sticky left-0 bg-surface z-30  shadow-sm">
                    Job & Driver
                  </th>

                  <th className="py-2 px-3 w-40 font-medium ">
                    Completed (London)
                  </th>

                  <th className="py-2 px-3 w-48 font-medium ">
                    Customer
                  </th>

                  <th className="py-2 px-3 min-w-[200px] font-medium ">
                    Route
                  </th>

                  <th className="py-2 px-3 w-36 font-medium  text-center">
                    Evidence Photos
                  </th>

                  <th className="py-2 px-3 w-28 font-medium  text-center">
                    Signature
                  </th>

                  <th className="py-2 px-3 w-28 font-medium  text-right font-mono">
                    Total Billed
                  </th>

                  <th className="py-2 px-3 w-12 text-center"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line bg-paper">
                {isLoading && (
                  <>
                    {[...Array(6)].map((_, i) => (
                      <tr key={i} className="h-14 animate-pulse">
                        <td className="py-3 px-3 text-center "><div className="w-3.5 h-3.5 bg-surface rounded mx-auto" /></td>
                        <td className="py-3 px-2 text-center "><div className="w-3 h-3 bg-surface rounded mx-auto" /></td>
                        <td className="py-3 px-3  sticky left-0 bg-paper"><div className="w-24 h-4 bg-surface rounded" /></td>
                        <td className="py-3 px-3 "><div className="w-24 h-4 bg-surface rounded" /></td>
                        <td className="py-3 px-3 "><div className="w-28 h-6 bg-surface rounded" /></td>
                        <td className="py-3 px-3 "><div className="w-36 h-6 bg-surface rounded" /></td>
                        <td className="py-3 px-3 "><div className="w-20 h-7 bg-surface rounded" /></td>
                        <td className="py-3 px-3 "><div className="w-16 h-4 bg-surface rounded" /></td>
                        <td className="py-3 px-3 "><div className="w-14 h-4 bg-surface rounded ml-auto" /></td>
                        <td className="py-3 px-3"></td>
                      </tr>
                    ))}
                  </>
                )}

                {error && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-status-red">
                      Failed to fetch finished jobs.
                    </td>
                  </tr>
                )}

                {!isLoading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-muted">
                      <div className="w-10 h-10 rounded-pill bg-surface flex items-center justify-center mx-auto mb-2 text-muted">
                        <FileText className="w-5 h-5 opacity-60" />
                      </div>
                      <p className="text-[12px] font-semibold text-ink">No finished jobs</p>
                      <p className="text-[13px] text-muted">No delivered jobs match the timeframe.</p>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  data?.items.map((job: NormalizedJob, index: number) => {
                    const isExpanded = expandedJobId === job.jobId;
                    const totalPounds = toPounds(job.totalCharges);
                    const rowNumber = (page - 1) * pageSize + index + 1;
                    const formattedTime = formatLondonDateTime(job.actualFinish || job.bookedFinish);

                    return (
                      <React.Fragment key={job.jobId}>
                        <tr
                          onClick={() => setExpandedJobId(isExpanded ? null : job.jobId)}
                          className={`h-14 cursor-pointer transition select-none ${
                            isExpanded ? "bg-brand-soft" : "hover:bg-surface"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center " onClick={e => e.stopPropagation()}>
                            <input type="checkbox" className="rounded text-brand" />
                          </td>

                          <td className="py-2.5 px-2 text-center font-mono text-[11px] text-muted ">
                            {rowNumber}
                          </td>

                          {/* Frozen Identity Column */}
                          <td
                            className={`py-2.5 px-3  sticky left-0 z-10 transition ${
                              isExpanded ? "bg-brand-soft" : "bg-paper hover:bg-surface"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-pill bg-brand-soft text-brand font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                {job.driverInitials || "UN"}
                              </div>
                              <div className="overflow-hidden">
                                <span className="font-mono font-semibold text-brand text-[13px] block truncate hover:underline">
                                  {job.jobId}
                                </span>
                                <span className="text-[11px] text-ink-2 truncate block">{job.driverName}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-ink-2 " title={job.actualFinish || ""}>
                            {formattedTime}
                          </td>

                          <td className="py-2.5 px-3 ">
                            <div className="h-7 px-2.5 py-1 bg-surface border border-line rounded flex items-center text-[13px] text-ink truncate" title={job.customerName}>
                              <span className="truncate">{job.customerName}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 ">
                            <div className="h-7 px-2.5 py-1 bg-surface border border-line rounded flex items-center text-[13px] text-ink truncate max-w-xs" title={`${job.pickup} -> ${job.dropoff}`}>
                              <span className="truncate">{job.pickup} &rarr; {job.dropoff}</span>
                            </div>
                          </td>

                          {/* Evidence Strip */}
                          <td className="py-2.5 px-3 " onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {job.evidenceItems.slice(0, 3).map((ev, i) => (
                                <ThumbnailPreview
                                  key={ev.id || i}
                                  src={ev.fileId ? `/ops/api/jobs/${encodeURIComponent(job.jobId)}/photos/${encodeURIComponent(ev.fileId)}` : undefined}
                                  alt={`${ev.category} photo, job ${job.jobId}`}
                                  state={ev.state}
                                  size="sm"
                                  onClick={() => {
                                    if (ev.fileId) {
                                      setActivePhoto({
                                        title: `${job.jobId} - ${ev.category}`,
                                        url: `/ops/api/jobs/${encodeURIComponent(job.jobId)}/photos/${encodeURIComponent(ev.fileId)}`,
                                        driveUrl: ev.driveUrl
                                      });
                                    }
                                  }}
                                />
                              ))}
                              {job.evidenceItems.length > 3 && (
                                <span className="w-7 h-7 rounded bg-surface border border-line flex items-center justify-center font-mono text-[10px] text-muted font-bold">
                                  +{job.evidenceItems.length - 3}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Signature */}
                          <td className="py-2.5 px-3  text-center" onClick={e => e.stopPropagation()}>
                            {job.signatureUrl ? (
                              <button
                                onClick={() => setActivePhoto({ title: `${job.jobId} - Signature`, url: job.signatureUrl! })}
                                className="h-7 px-2 bg-paper border border-line rounded flex items-center justify-center mx-auto hover:border-brand transition"
                              >
                                <img
                                  src={job.signatureUrl}
                                  alt="Signature"
                                  className="h-5 max-w-[60px] object-contain"
                                  onError={e => { (e.target as HTMLElement).style.display = "none"; }}
                                />
                              </button>
                            ) : (
                              <span className="text-[12px] text-muted">Not captured</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-semibold text-ink ">
                            £{totalPounds.toFixed(2)}
                          </td>

                          <td className="py-2.5 px-3 text-center text-muted hover:text-brand">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-brand" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="p-6 bg-bg border-b border-line">
                              <PaperJobReport job={job} onClose={() => setExpandedJobId(null)} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Sticky Pagination Bar */}
          {data?.pagination && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-paper text-[13px] text-muted sticky bottom-0">
              <div>
                Showing <span className="font-mono text-ink font-semibold">1–{data.items.length}</span> of{" "}
                <span className="font-mono text-ink font-semibold">{data.pagination.total}</span> finished jobs
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-2.5 py-1 rounded border border-line bg-paper text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition"
                >
                  Prev
                </button>
                <span className="px-2 font-mono text-ink">
                  {page} / {data.pagination.totalPages || 1}
                </span>
                <button
                  disabled={!data.pagination.hasMore}
                  onClick={() => setPage(page + 1)}
                  className="px-2.5 py-1 rounded border border-line bg-paper text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && (
        <PhotoModal
          isOpen={true}
          onClose={() => setActivePhoto(null)}
          title={activePhoto.title}
          photoUrl={activePhoto.url}
          driveUrl={activePhoto.driveUrl}
        />
      )}
    </div>
  );
}
