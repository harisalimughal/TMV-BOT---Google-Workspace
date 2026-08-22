import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronRight, Download, ExternalLink, FileText } from "lucide-react";
import { fetchJobs } from "../api/client";
import { NormalizedJob } from "../types";
import { PaperJobReport } from "../components/PaperJobReport";
import { DateRangePicker } from "../components/DateRangePicker";
import { PhotoModal } from "../components/PhotoModal";

export function FinishedJobsPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<{ title: string; url: string; driveUrl?: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["finished_jobs", page, from, to],
    queryFn: () => fetchJobs({ status: "COMPLETED", page, pageSize: 20, from, to })
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Finished & Completed Jobs</h2>
          <p className="text-xs text-muted">Field audit view with evidence thumbnails and sign-off records</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading && (
          <div className="py-16 text-center text-muted animate-pulse">Loading finished jobs...</div>
        )}

        {error && (
          <div className="p-8 text-center text-status-red bg-paper rounded-xl border border-line">
            Failed to load finished jobs.
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <div className="p-12 text-center text-muted bg-paper rounded-xl border border-line">
            No completed jobs found for the selected timeframe.
          </div>
        )}

        {!isLoading &&
          data?.items.map((job: NormalizedJob) => {
            const isExpanded = expandedJobId === job.jobId;

            return (
              <div
                key={job.jobId}
                className={`bg-paper rounded-xl border transition shadow-paper overflow-hidden ${
                  isExpanded ? "border-tmv-blue ring-1 ring-tmv-blue/20" : "border-line hover:border-line-strong"
                }`}
              >
                <div
                  onClick={() => setExpandedJobId(isExpanded ? null : job.jobId)}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-status-green border border-emerald-200 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-ink">{job.jobId}</span>
                        <span className="text-xs font-semibold text-ink">{job.customerName}</span>
                      </div>
                      <span className="text-xs text-muted font-mono">{job.bookedStart}</span>
                    </div>
                  </div>

                  {/* Inline Evidence Gallery Thumbs */}
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {job.evidenceItems.map(ev => {
                      if (ev.state !== "COMPLETED" || !ev.thumbProxyUrl) return null;
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setActivePhoto({ title: `${job.jobId} - ${ev.category}`, url: ev.thumbProxyUrl!, driveUrl: ev.driveUrl })}
                          className="group relative w-10 h-10 rounded-lg overflow-hidden border border-line bg-surface cursor-pointer hover:border-tmv-blue transition shadow-sm"
                          title={`${ev.category} - Click to preview`}
                        >
                          <img
                            src={ev.thumbProxyUrl}
                            alt={ev.category}
                            className="w-full h-full object-cover group-hover:scale-110 transition"
                            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-ink block">
                        £{(job.totalCharges / 100).toFixed(2)}
                      </span>
                      <span className="text-[11px] text-muted">{job.paymentMethod}</span>
                    </div>
                    <div className="p-1 rounded bg-surface-2 text-muted">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 border-t border-line bg-surface/30">
                    <PaperJobReport job={job} onClose={() => setExpandedJobId(null)} />
                  </div>
                )}
              </div>
            );
          })}
      </div>

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
