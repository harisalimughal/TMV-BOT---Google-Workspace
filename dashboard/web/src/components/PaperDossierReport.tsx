import React from "react";
import { NormalizedJob, toPounds } from "../types";
import { formatLondonDateTime } from "../utils/date";
import { CheckCircle2, ShieldCheck, MapPin } from "lucide-react";
import { JobStatusBadge, DelayBandBadge } from "./StatusBadge";

interface Props {
  job: NormalizedJob;
}

export function PaperDossierReport({ job }: Props) {
  const totalPounds = toPounds(job.totalCharges);
  const now = new Date().toISOString();
  
  // 10-Stage Lifecycle Audit Timeline
  const rawStages = [
    { name: "Booking Created", time: job.bookedStart, actor: "System", state: "COMPLETED" },
    { name: "Driver Assigned", time: job.bookedStart, actor: "Dispatcher", state: "COMPLETED", detail: `${job.driverName} (${job.driverInitials})` },
    { name: "En Route to Pickup", time: job.actualStart || job.bookedStart, actor: job.driverName, state: job.status !== "READY" ? "COMPLETED" : "PENDING" },
    { name: "Arrived at Pickup", time: job.actualStart, actor: job.driverName, state: job.actualStart ? "COMPLETED" : "PENDING" },
    { name: "Loading Van & Evidence", time: job.actualStart, actor: job.driverName, state: job.evidenceCompleteness.vanLoaded === "COMPLETED" ? "COMPLETED" : "PENDING" },
    { name: "In Transit to Dropoff", time: job.actualStart, actor: job.driverName, state: job.status === "IN_PROGRESS" || job.status === "COMPLETED" ? "COMPLETED" : "PENDING" },
    { name: "Unloading & Empty Van", time: job.actualFinish, actor: job.driverName, state: job.evidenceCompleteness.emptyVan === "COMPLETED" ? "COMPLETED" : "PENDING" },
    { name: "Payment Received", time: job.actualFinish, actor: "Customer / Driver", state: job.reconciled ? "COMPLETED" : "PENDING", detail: job.paymentMethod },
    { name: "Customer Sign-off", time: job.actualFinish, actor: job.clientConfirmedName || job.customerName, state: job.signatureUrl ? "COMPLETED" : "PENDING" },
    { name: "Job Completed", time: job.actualFinish, actor: "System Bot", state: job.status === "COMPLETED" ? "COMPLETED" : "PENDING" }
  ];

  let firstPendingIndex = rawStages.findIndex(s => s.state === "PENDING");
  if (firstPendingIndex === -1) firstPendingIndex = 999;
  
  const stages = rawStages.map((stg, i) => {
    let finalState = stg.state;
    // Sequential enforce: if a stage has no time, or is past the first pending, it's not completed in a certified way
    let isCertifiedComplete = stg.state === "COMPLETED" && i <= firstPendingIndex && !!stg.time;
    // Special case for Booking Created / Driver assigned which use bookedStart
    if (i < 2 && stg.state === "COMPLETED") isCertifiedComplete = true;

    return { ...stg, isCertifiedComplete };
  });

  const isCancelled = job.status === "CANCELLED";

  return (
    <div className="paper-document bg-white font-sans text-[#1A1A1A] hidden print:block absolute inset-0 z-[9999]">
      <style>{`
        @media print {
          .print-dossier-page {
            page-break-after: always;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 40px;
            box-sizing: border-box;
            background: white;
          }
          .print-dossier-page:last-child {
            page-break-after: auto;
          }
          body { background: white; margin: 0; padding: 0; }
        }
      `}</style>

      <div className="print-dossier-page">
        {/* HEADER */}
        <div className="flex items-start justify-between pb-6 border-b border-line mb-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-[24px] font-bold text-ink leading-tight">Certified Operations Dossier</h1>
            <div className="flex items-center gap-3">
              <span className="text-[16px] font-mono font-bold">{job.jobId}</span>
              <div className="px-2 py-0.5 rounded-full border border-line bg-surface text-[11px] font-bold uppercase tracking-wider">
                {job.status}
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span className="text-[12px] font-medium text-brand uppercase tracking-wider">Verified Record</span>
              <span className="text-[12px] text-muted ml-2">Generated: {formatLondonDateTime(now)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <img src="/tmv-new-logo.png" alt="The Man Van" className="w-[120px] object-contain" />
            <span className="text-[11px] font-bold text-ink tracking-wider mt-1">020 3773 9113</span>
          </div>
        </div>

        {/* KEY METRICS SUMMARY TABLE */}
        <div className="mb-8">
          <h2 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Key Metrics</h2>
          <div className="grid grid-cols-4 gap-4 p-5 bg-[#F7F7F7] rounded-[12px] border border-line">
            <div className="flex flex-col gap-1.5 border-r border-line/60 pr-4">
              <span className="text-[12px] text-muted">Total Billed</span>
              <span className="text-[16px] font-mono font-bold text-ink">£{totalPounds.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-1.5 border-r border-line/60 px-4">
              <span className="text-[12px] text-muted">Payment Status</span>
              <div>
                {job.reconciled ? (
                   <span className="px-2 py-1 rounded-md bg-status-green-bg text-status-green text-[11px] font-bold uppercase tracking-wider inline-block">Paid</span>
                ) : (
                   <span className="px-2 py-1 rounded-md bg-surface border border-line text-muted text-[11px] font-bold uppercase tracking-wider inline-block">Unpaid</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 border-r border-line/60 px-4">
              <span className="text-[12px] text-muted">Driver & Crew</span>
              <span className="text-[14px] font-bold text-ink">{job.driverName || "Unassigned"}</span>
              <span className="text-[11px] text-muted">{job.crewSize} Crew</span>
            </div>
            <div className="flex flex-col gap-1.5 pl-4">
              <span className="text-[12px] text-muted">Punctuality</span>
              <div>
                {isCancelled ? (
                  <span className="text-muted font-mono">—</span>
                ) : (
                  <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ROUTE CORRIDORS */}
        <div className="mb-8">
          <h2 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Route Corridors</h2>
          <div className="flex flex-col gap-3">
            <div className="p-4 bg-white border border-line rounded-[12px] border-l-4 border-l-status-green flex gap-4">
              <div className="w-[100px] shrink-0">
                <span className="text-[10px] font-bold text-status-green uppercase tracking-wider block">Pickup</span>
              </div>
              <div className="flex-1">
                <span className="text-[13px] text-ink font-medium leading-relaxed whitespace-pre-wrap">{job.pickup || "Address not recorded"}</span>
              </div>
            </div>
            <div className="p-4 bg-white border border-line rounded-[12px] border-l-4 border-l-[#2563EB] flex gap-4">
              <div className="w-[100px] shrink-0">
                <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider block">Dropoff</span>
              </div>
              <div className="flex-1">
                <span className="text-[13px] text-ink font-medium leading-relaxed whitespace-pre-wrap">{job.dropoff || "Address not recorded"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AUDIT LIFECYCLE TIMELINE (TABLE FORMAT) */}
        <div className="mb-8 flex-1">
          <h2 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Audit Lifecycle Timeline</h2>
          <div className="border border-line rounded-[12px] overflow-hidden">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[#F7F7F7] border-b border-line">
                <tr>
                  <th className="py-3 px-4 font-semibold text-muted w-12 text-center">#</th>
                  <th className="py-3 px-4 font-semibold text-muted">Stage</th>
                  <th className="py-3 px-4 font-semibold text-muted">Actor</th>
                  <th className="py-3 px-4 font-semibold text-muted text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stages.map((stg, i) => (
                  <tr key={i} className={stg.isCertifiedComplete ? "bg-white" : "bg-surface/30"}>
                    <td className="py-3 px-4 text-center">
                      {stg.isCertifiedComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-status-green mx-auto" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-line mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`block ${stg.isCertifiedComplete ? "font-bold text-ink" : "text-muted"}`}>
                        {stg.name}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`block ${stg.isCertifiedComplete ? "text-ink" : "text-muted"}`}>
                        {stg.actor} {stg.detail ? `• ${stg.detail}` : ""}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className={stg.isCertifiedComplete ? "text-ink" : "text-muted"}>
                        {stg.isCertifiedComplete && stg.time ? formatLondonDateTime(stg.time) : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIGNATURE SECTION */}
        {job.signatureUrl && (
          <div className="mt-4 mb-4 page-break-inside-avoid">
            <h2 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Customer Sign-off</h2>
            <div className="flex items-start gap-8 p-6 bg-[#F7F7F7] border border-line rounded-[12px]">
              <div className="w-[200px] h-[100px] bg-white border border-line rounded-lg p-2 flex items-center justify-center">
                <img src={job.signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain mix-blend-multiply" />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-[13px] text-muted">Confirmed by:</span>
                <span className="text-[14px] font-bold text-ink">{job.clientConfirmedName || job.customerName || "Customer"}</span>
                <span className="text-[12px] font-mono text-muted mt-1">Signed: {formatLondonDateTime(job.actualFinish || now)}</span>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-auto pt-4 border-t border-line flex items-center justify-between">
          <span className="text-[10px] text-muted italic">
            This document was generated by The Man Van Operations System and reflects the recorded state at time of export.
          </span>
          <span className="text-[11px] text-muted">Page 1/1</span>
        </div>
      </div>
    </div>
  );
}
