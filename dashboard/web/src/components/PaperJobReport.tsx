import React, { useState } from "react";
import {
  FileText,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Truck,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Folder,
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { NormalizedJob } from "../types";
import { DelayBandBadge, JobStatusBadge } from "./StatusBadge";
import { EvidenceCompletenessPill } from "./EvidenceCompletenessPill";
import { PhotoModal } from "./PhotoModal";

interface Props {
  job: NormalizedJob;
  onClose?: () => void;
}

export function PaperJobReport({ job, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{ title: string; url: string; driveUrl?: string } | null>(null);

  const handleCopyJobId = () => {
    navigator.clipboard.writeText(job.jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePdfDownload = () => {
    window.open(`/ops/api/jobs/${encodeURIComponent(job.jobId)}/report.pdf`, "_blank");
  };

  return (
    <div className="paper-sheet p-8 my-4 text-ink max-w-5xl mx-auto border border-line bg-paper shadow-paper-lg rounded-xl">
      {/* Action Toolbar */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center text-tmv-cyan font-bold text-lg font-mono">
            TMV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-ink tracking-tight">{job.jobId}</h2>
              <button
                onClick={handleCopyJobId}
                className="p-1 rounded text-muted hover:text-ink hover:bg-surface-2 transition"
                title="Copy Job ID"
              >
                {copied ? <Check className="w-4 h-4 text-status-green" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted">Operations Job Record & Field Audit</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {job.driveFolderUrl && (
            <a
              href={job.driveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink-2 hover:bg-surface-2 transition"
            >
              <Folder className="w-4 h-4 text-tmv-blue" />
              Drive Folder
            </a>
          )}
          <button
            onClick={handlePdfDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink-2 hover:bg-surface-2 transition"
          >
            <Download className="w-4 h-4 text-tmv-blue" />
            Export PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink-2 hover:bg-surface-2 transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-line text-xs font-semibold text-ink transition ml-2"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Section 1: Top Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-surface mb-8 border border-line">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">Status</span>
          <JobStatusBadge status={job.status} />
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">Timing & Delay</span>
          <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">Driver</span>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-navy-800 text-white flex items-center justify-center text-xs font-bold font-mono">
              {job.driverInitials || "UN"}
            </span>
            <span className="text-sm font-semibold text-ink">{job.driverName}</span>
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">Evidence State</span>
          <EvidenceCompletenessPill completeness={job.evidenceCompleteness} />
        </div>
      </div>

      {/* Section 2 & 3: Customer & Route */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Customer Details */}
        <div className="p-5 rounded-xl border border-line bg-paper">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-tmv-blue" />
            Customer & Booking
          </h3>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-muted block">Customer Name</span>
              <span className="text-base font-bold text-ink">{job.customerName}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted block">Phone</span>
                <span className="text-sm font-mono font-medium text-ink flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted" />
                  {job.customerPhone || "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted block">Crew Size</span>
                <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-muted" />
                  {job.crewSize} Crew
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted block">Email</span>
              <span className="text-sm text-ink flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted" />
                {job.customerEmail || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Route Details */}
        <div className="p-5 rounded-xl border border-line bg-paper">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-tmv-blue" />
            Route & Locations
          </h3>
          <div className="space-y-4">
            <div className="relative pl-6">
              <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-tmv-blue border-2 border-white shadow-sm" />
              <span className="text-xs text-muted block">Pickup Address</span>
              <p className="text-sm font-semibold text-ink">{job.pickup}</p>
            </div>
            <div className="relative pl-6">
              <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-status-green border-2 border-white shadow-sm" />
              <span className="text-xs text-muted block">Dropoff Address</span>
              <p className="text-sm font-semibold text-ink">{job.dropoff}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Timings Table */}
      <div className="p-5 rounded-xl border border-line bg-paper mb-8">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-tmv-blue" />
          Scheduled vs Actual Timings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="pb-2 font-semibold">Stage</th>
                <th className="pb-2 font-semibold">Scheduled (London)</th>
                <th className="pb-2 font-semibold">Actual (London)</th>
                <th className="pb-2 font-semibold">Duration</th>
                <th className="pb-2 font-semibold">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              <tr>
                <td className="py-2.5 font-medium text-ink">Start</td>
                <td className="py-2.5 font-mono text-muted">{job.bookedStart || "—"}</td>
                <td className="py-2.5 font-mono font-semibold text-ink">{job.actualStart || "—"}</td>
                <td className="py-2.5 font-mono text-muted">{job.bookedMinutes} mins (booked)</td>
                <td className="py-2.5">
                  <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-ink">Finish</td>
                <td className="py-2.5 font-mono text-muted">{job.bookedFinish || "—"}</td>
                <td className="py-2.5 font-mono font-semibold text-ink">{job.actualFinish || "—"}</td>
                <td className="py-2.5 font-mono font-semibold text-ink">
                  {job.actualMinutes ? `${job.actualMinutes} mins (actual)` : "—"}
                </td>
                <td className="py-2.5 font-mono text-muted">
                  {job.overtimeMinutes > 0 ? (
                    <span className="text-status-orange font-bold">+{job.overtimeMinutes}m Overtime</span>
                  ) : (
                    "Within booking"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {!job.timingTrustworthy && (
          <div className="mt-3 p-3 rounded-lg bg-status-orange-bg border border-amber-300 flex items-center gap-2 text-xs text-status-orange">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Timing Notice:</strong> Recorded timestamps carry non-London timezone offsets. Durations may have slight discrepancies.
            </span>
          </div>
        )}
      </div>

      {/* Section 6: Evidence Gallery */}
      <div className="p-5 rounded-xl border border-line bg-paper mb-8">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-tmv-blue" />
            Field Evidence Gallery
          </span>
          <span className="text-xs font-normal text-muted font-mono">
            {job.evidenceItems.filter(e => e.state === "COMPLETED").length} of 5 verified
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {(["Arrival", "VanLoaded", "EmptyVan", "Organized", "Signature"] as const).map(cat => {
            const ev = job.evidenceItems.find(e => e.category === cat);
            const state = ev?.state || "MISSING";

            return (
              <div
                key={cat}
                className={`relative rounded-xl border p-3 flex flex-col items-center text-center justify-between min-h-[160px] transition ${
                  state === "COMPLETED"
                    ? "border-emerald-200 bg-emerald-50/30 hover:border-emerald-400"
                    : state === "PROCESSING"
                    ? "border-amber-200 bg-amber-50/30"
                    : state === "FAILED"
                    ? "border-rose-200 bg-rose-50/30"
                    : "border-line bg-surface/50 opacity-80"
                }`}
              >
                <span className="text-xs font-bold text-ink mb-2">{cat}</span>

                {state === "COMPLETED" && ev?.thumbProxyUrl ? (
                  <div
                    onClick={() => setActivePhoto({ title: `${job.jobId} - ${cat}`, url: ev.thumbProxyUrl!, driveUrl: ev.driveUrl })}
                    className="cursor-pointer group relative w-full h-24 rounded-lg overflow-hidden border border-emerald-300 bg-white"
                  >
                    <img
                      src={ev.thumbProxyUrl}
                      alt={cat}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      onError={(e) => {
                        // Fallback icon if image fails to render
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/30 transition flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </div>
                ) : state === "PROCESSING" ? (
                  <div className="w-full h-24 rounded-lg border border-dashed border-amber-300 flex flex-col items-center justify-center bg-amber-50">
                    <Clock className="w-6 h-6 text-status-orange animate-spin mb-1" />
                    <span className="text-[10px] font-semibold text-status-orange">Processing...</span>
                  </div>
                ) : state === "FAILED" ? (
                  <div className="w-full h-24 rounded-lg border border-dashed border-rose-300 flex flex-col items-center justify-center bg-rose-50 p-2 text-center">
                    <AlertTriangle className="w-6 h-6 text-status-red mb-1" />
                    <span className="text-[10px] font-bold text-status-red">Failed</span>
                    <span className="text-[9px] text-muted line-clamp-1">{ev?.error}</span>
                  </div>
                ) : (
                  <div className="w-full h-24 rounded-lg border border-dashed border-line flex flex-col items-center justify-center bg-surface-2 text-muted">
                    <FileText className="w-6 h-6 mb-1 opacity-40" />
                    <span className="text-[10px] font-medium">Missing</span>
                  </div>
                )}

                <div className="mt-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      state === "COMPLETED"
                        ? "bg-emerald-100 text-status-green"
                        : state === "PROCESSING"
                        ? "bg-amber-100 text-status-orange"
                        : state === "FAILED"
                        ? "bg-rose-100 text-status-red"
                        : "bg-gray-100 text-muted"
                    }`}
                  >
                    {state}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 7 & 8: Charges & Customer Signature */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Charges & Reconciliation */}
        <div className="p-5 rounded-xl border border-line bg-paper">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-tmv-blue" />
              Charges & Payment
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                job.reconciled ? "bg-emerald-100 text-status-green" : "bg-amber-100 text-status-orange"
              }`}
            >
              {job.reconciled ? "Reconciled" : "Unreconciled"}
            </span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-line">
              <span className="text-muted">Base Price</span>
              <span className="font-mono font-semibold text-ink">£{(job.basePrice / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line">
              <span className="text-muted">Extra Charges (Congestion/Tunnel)</span>
              <span className="font-mono font-semibold text-ink">£{(job.extraCharges / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line">
              <span className="text-muted">Overtime ({job.overtimeMinutes} mins)</span>
              <span className="font-mono font-semibold text-ink">£{(job.overtimeCharge / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-line font-bold text-sm">
              <span className="text-ink">Total Charges</span>
              <span className="font-mono text-tmv-blue">£{(job.totalCharges / 100).toFixed(2)}</span>
            </div>

            <div className="pt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-muted block">Payment Method</span>
                <span className="font-semibold text-ink">{job.paymentMethod || "Not recorded"}</span>
              </div>
              <div>
                <span className="text-muted block">Payment Status</span>
                <span className="font-semibold text-ink">{job.paymentStatus || "Not recorded"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Confirmation */}
        <div className="p-5 rounded-xl border border-line bg-paper flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-tmv-blue" />
              Customer Confirmation
            </h3>
            <div className="mb-3">
              <span className="text-xs text-muted block">Confirmed By</span>
              <span className="text-sm font-bold text-ink">{job.clientConfirmedName || job.customerName}</span>
            </div>
          </div>

          <div className="p-3 bg-surface rounded-lg border border-line text-center">
            {job.signatureUrl ? (
              <div
                onClick={() => setActivePhoto({ title: `${job.jobId} - Customer Signature`, url: job.signatureUrl! })}
                className="cursor-pointer group flex flex-col items-center"
              >
                <img
                  src={job.signatureUrl}
                  alt="Customer Signature"
                  className="max-h-20 object-contain mx-auto group-hover:scale-105 transition"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <span className="text-[10px] text-tmv-blue font-semibold mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View Signature
                </span>
              </div>
            ) : (
              <div className="py-4 text-muted text-xs italic">No digital signature recorded on file</div>
            )}
          </div>
        </div>
      </div>

      {/* Section 9: Audit Trail */}
      {job.activity.length > 0 && (
        <div className="p-5 rounded-xl border border-line bg-paper">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-tmv-blue" />
            Audit Activity Trail
          </h3>
          <div className="space-y-3">
            {job.activity.map((act, index) => (
              <div key={index} className="flex items-start gap-3 text-xs pb-2 border-b border-line/60 last:border-0">
                <span className="font-mono text-muted whitespace-nowrap">{act.timestamp}</span>
                <span className="font-semibold text-ink">{act.driver}</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-2 font-mono text-[11px] font-bold">
                  {act.action}
                </span>
                {act.fromState && act.toState && (
                  <span className="text-muted flex items-center gap-1 font-mono text-[10px]">
                    {act.fromState} <ChevronRight className="w-3 h-3" /> {act.toState}
                  </span>
                )}
                {act.detail && <span className="text-muted ml-auto italic">{act.detail}</span>}
              </div>
            ))}
          </div>
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
