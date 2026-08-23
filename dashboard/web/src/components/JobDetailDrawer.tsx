import React, { useState } from "react";
import {
  X,
  User,
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Folder,
  Download,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  DollarSign,
  Camera,
  FileCheck,
  ChevronRight,
  Printer
} from "lucide-react";
import { NormalizedJob, toPounds } from "../types";
import { JobStatusBadge, DelayBandBadge } from "./StatusBadge";
import { EvidenceCompletenessPill } from "./EvidenceCompletenessPill";
import { ThumbnailPreview } from "./ThumbnailPreview";
import { PhotoModal } from "./PhotoModal";
import { formatLondonDateTime } from "../utils/date";

interface Props {
  job: NormalizedJob | null;
  isOpen: boolean;
  onClose: () => void;
}

export function JobDetailDrawer({ job, isOpen, onClose }: Props) {
  const [copiedId, setCopiedId] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{ title: string; url: string; driveUrl?: string } | null>(null);

  if (!isOpen || !job) return null;

  const totalPounds = toPounds(job.totalCharges);
  const basePounds = toPounds(job.basePrice);
  const extraPounds = toPounds(job.extraCharges);
  const overtimePounds = toPounds(job.overtimeCharge);

  const handleCopyJobId = () => {
    navigator.clipboard.writeText(job.jobId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePdfDownload = () => {
    window.open(`/ops/api/jobs/${encodeURIComponent(job.jobId)}/report.pdf`, "_blank");
  };

  // 10-Stage Lifecycle Audit Timeline
  const stages = [
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/40 backdrop-blur-xs flex justify-end">
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container (Slide-in from right) */}
      <div className="w-full max-w-2xl bg-paper border-l border-line shadow-pop flex flex-col h-full overflow-hidden animate-slide-in-right">
        {/* 1. Header Toolbar */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand font-mono font-bold text-xs flex items-center justify-center border border-brand/20">
              {job.driverInitials || "TMV"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-mono text-ink leading-tight">{job.jobId}</h3>
                <button
                  onClick={handleCopyJobId}
                  className="p-1 rounded text-muted hover:text-ink hover:bg-surface transition"
                  title="Copy Job ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-status-green" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-xs text-muted">Operations Dossier &bull; {job.customerName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <JobStatusBadge status={job.status} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface transition"
              title="Close Drawer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-ink">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-surface border border-line">
            <div>
              <span className="text-[11px] text-muted block mb-0.5">Total Billed</span>
              <span className="text-base font-bold font-mono text-ink block">£{totalPounds.toFixed(2)}</span>
              <span className="text-[10px] text-muted">{job.paymentMethod}</span>
            </div>
            <div>
              <span className="text-[11px] text-muted block mb-0.5">Driver & Crew</span>
              <span className="text-xs font-semibold text-ink block">{job.driverName}</span>
              <span className="text-[10px] text-muted">{job.crewSize} Crew</span>
            </div>
            <div>
              <span className="text-[11px] text-muted block mb-0.5">Punctuality</span>
              <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
            </div>
          </div>

          {/* Route & Postcodes */}
          <div className="p-4 rounded-2xl border border-line bg-paper space-y-3 shadow-card">
            <h4 className="text-xs font-bold text-ink flex items-center gap-1.5 uppercase tracking-wider text-muted">
              <MapPin className="w-3.5 h-3.5 text-brand" />
              Route Corridors
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-surface rounded-lg border border-line">
                <span className="text-[10px] font-mono font-bold text-status-green block uppercase">Pickup</span>
                <span className="font-medium text-ink block mt-0.5">{job.pickup}</span>
              </div>
              <div className="p-2.5 bg-surface rounded-lg border border-line">
                <span className="text-[10px] font-mono font-bold text-brand block uppercase">Dropoff Destination</span>
                <span className="font-medium text-ink block mt-0.5">{job.dropoff}</span>
              </div>
            </div>
          </div>

          {/* 10-Stage Lifecycle Timeline */}
          <div className="p-4 rounded-2xl border border-line bg-paper space-y-3 shadow-card">
            <h4 className="text-xs font-bold text-ink flex items-center gap-1.5 uppercase tracking-wider text-muted">
              <Clock className="w-3.5 h-3.5 text-brand" />
              Audit Lifecycle Timeline (10 Stages)
            </h4>
            <div className="relative pl-5 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
              {stages.map((stg, i) => (
                <div key={i} className="relative flex items-start justify-between text-xs">
                  <div
                    className={`absolute -left-5 top-0.5 w-3 h-3 rounded-full border-2 bg-paper ${
                      stg.state === "COMPLETED" ? "border-status-green bg-status-green-bg" : "border-line-strong"
                    }`}
                  />
                  <div>
                    <span className={`font-semibold block ${stg.state === "COMPLETED" ? "text-ink" : "text-muted"}`}>
                      {stg.name}
                    </span>
                    <span className="text-[10px] text-muted block">
                      Actor: {stg.actor} {stg.detail ? `&bull; ${stg.detail}` : ""}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted">
                    {stg.time ? formatLondonDateTime(stg.time) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Photographic Evidence Grid */}
          <div className="p-4 rounded-2xl border border-line bg-paper space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-ink flex items-center gap-1.5 uppercase tracking-wider text-muted">
                <Camera className="w-3.5 h-3.5 text-brand" />
                Evidence Photographs
              </h4>
              <EvidenceCompletenessPill completeness={job.evidenceCompleteness} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {job.evidenceItems.map((ev, i) => (
                <div key={ev.id || i} className="p-2 bg-surface rounded-lg border border-line text-center space-y-1.5">
                  <span className="text-[10px] font-medium text-muted block truncate">{ev.category}</span>
                  <ThumbnailPreview
                    src={ev.fileId ? `/ops/api/jobs/${encodeURIComponent(job.jobId)}/photos/${encodeURIComponent(ev.fileId)}` : undefined}
                    alt={`${ev.category} photo, job ${job.jobId}`}
                    state={ev.state}
                    size="lg"
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
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown & Customer Signature */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-line bg-paper space-y-2 shadow-card">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Financial Audit</span>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-muted">Base Price</span>
                  <span className="font-mono text-ink font-medium">£{basePounds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-muted">Extra Charges</span>
                  <span className="font-mono text-ink font-medium">£{extraPounds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-muted">Overtime ({job.overtimeMinutes}m)</span>
                  <span className="font-mono text-ink font-medium">£{overtimePounds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1.5 font-bold text-sm">
                  <span>Total Amount</span>
                  <span className="font-mono text-brand">£{totalPounds.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-line bg-paper flex flex-col justify-between shadow-card">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">Customer Sign-off</span>
              {job.signatureUrl ? (
                <div
                  onClick={() => setActivePhoto({ title: `${job.jobId} - Customer Signature`, url: job.signatureUrl! })}
                  className="p-2 bg-surface rounded-lg border border-line flex items-center justify-center cursor-pointer hover:border-brand transition group"
                >
                  <img
                    src={job.signatureUrl}
                    alt="Customer signature"
                    className="max-h-12 object-contain group-hover:scale-105 transition"
                    onError={e => { (e.target as HTMLElement).style.display = "none"; }}
                  />
                </div>
              ) : (
                <div className="p-4 bg-surface rounded-lg border border-dashed border-line-strong text-center text-muted text-xs">
                  No signature captured
                </div>
              )}
              <span className="text-[10px] text-muted text-center mt-1 block">
                Signer: {job.clientConfirmedName || job.customerName}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Drawer Bottom Action Footer */}
        <div className="p-4 border-t border-line bg-surface/50 flex items-center justify-between gap-3">
          <button
            onClick={handlePdfDownload}
            className="h-9 px-4 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Certified PDF</span>
          </button>

          {job.driveFolderUrl && (
            <a
              href={job.driveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3 rounded-lg border border-line bg-paper hover:bg-surface text-ink-2 text-xs font-medium transition flex items-center gap-1.5"
            >
              <Folder className="w-3.5 h-3.5 text-brand" />
              <span>Google Drive</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}

          <button
            onClick={onClose}
            className="h-9 px-3 rounded-lg border border-line bg-paper hover:bg-surface text-muted hover:text-ink text-xs font-medium transition"
          >
            Close
          </button>
        </div>
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
