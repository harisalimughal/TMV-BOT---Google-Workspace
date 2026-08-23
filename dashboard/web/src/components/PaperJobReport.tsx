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
import { ThumbnailPreview } from "./ThumbnailPreview";
import { formatLondonDateTime } from "../utils/date";

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

  const photoCategories = [
    { key: "arrival", label: "Arrival Photo", short: "Arrival", state: job.evidenceCompleteness.arrival },
    { key: "van_loaded", label: "Van Loaded Photo", short: "Van Loaded", state: job.evidenceCompleteness.vanLoaded },
    { key: "empty_van", label: "Empty Van Photo", short: "Empty Van", state: job.evidenceCompleteness.emptyVan },
    { key: "organized", label: "Organized Cargo", short: "Organized", state: job.evidenceCompleteness.organized }
  ];

  return (
    <div className="paper-sheet p-8 my-2 text-ink max-w-4xl mx-auto border border-line bg-paper shadow-pop rounded">
      {/* Action Toolbar */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-line">
        <div className="flex items-center gap-3.5">
          <img
            src="/tmv-wide-logo.png"
            alt="The Man Van"
            className="h-10 object-contain rounded"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-mono text-ink">{job.jobId}</h2>
              <button
                onClick={handleCopyJobId}
                className="p-1 rounded text-muted hover:text-ink hover:bg-surface transition"
                title="Copy Job ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-status-green" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-muted">The Man Van &bull; Field Operations Audit &amp; Sign-off</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {job.driveFolderUrl && (
            <a
              href={job.driveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-line text-xs font-medium text-ink-2 hover:bg-surface transition"
            >
              <Folder className="w-3.5 h-3.5 text-brand" />
              Drive
            </a>
          )}
          <button
            onClick={handlePdfDownload}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-line text-xs font-medium text-ink-2 hover:bg-surface transition"
          >
            <Download className="w-3.5 h-3.5 text-brand" />
            PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-line text-xs font-medium text-ink-2 hover:bg-surface transition"
          >
            <Printer className="w-3.5 h-3.5 text-muted" />
            Print
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded bg-surface hover:bg-surface-2 text-xs font-medium text-ink transition ml-1"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Section 1: Top Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-3.5 rounded bg-surface mb-6 border border-line text-xs">
        <div>
          <span className="text-[11px] font-medium text-muted block mb-1">Status</span>
          <JobStatusBadge status={job.status} />
        </div>
        <div>
          <span className="text-[11px] font-medium text-muted block mb-1">Timing & Delay</span>
          <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
        </div>
        <div>
          <span className="text-[11px] font-medium text-muted block mb-1">Driver</span>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-pill bg-brand-soft text-brand flex items-center justify-center text-[10px] font-bold font-mono">
              {job.driverInitials || "UN"}
            </span>
            <span className="text-xs font-medium text-ink">{job.driverName}</span>
          </div>
        </div>
        <div>
          <span className="text-[11px] font-medium text-muted block mb-1">Evidence State</span>
          <EvidenceCompletenessPill completeness={job.evidenceCompleteness} />
        </div>
      </div>

      {/* Customer & Route Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-4 rounded border border-line bg-paper">
          <h3 className="text-xs font-medium text-muted mb-3 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-brand" />
            Customer & Booking
          </h3>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-muted block text-[11px]">Customer Name</span>
              <span className="font-semibold text-ink text-sm">{job.customerName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted block text-[11px]">Phone</span>
                <span className="font-mono text-ink-2">{job.customerPhone || "—"}</span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Crew</span>
                <span className="text-ink-2">{job.crewSize} Crew</span>
              </div>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Email</span>
              <span className="text-ink-2 truncate block">{job.customerEmail || "—"}</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded border border-line bg-paper">
          <h3 className="text-xs font-medium text-muted mb-3 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand" />
            Route & Addresses
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-muted block text-[11px]">Pickup</span>
              <p className="font-medium text-ink">{job.pickup}</p>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Dropoff</span>
              <p className="font-medium text-ink">{job.dropoff}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timings Table */}
      <div className="p-4 rounded border border-line bg-paper mb-6">
        <h3 className="text-xs font-medium text-muted mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-brand" />
          Scheduled vs Actual Timings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-muted text-[11px]">
                <th className="pb-1.5 font-medium">Stage</th>
                <th className="pb-1.5 font-medium font-mono">Scheduled</th>
                <th className="pb-1.5 font-medium font-mono">Actual</th>
                <th className="pb-1.5 font-medium font-mono">Duration</th>
                <th className="pb-1.5 font-medium">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              <tr>
                <td className="py-2 text-ink">Start</td>
                <td className="py-2 font-mono text-muted">{formatLondonDateTime(job.bookedStart)}</td>
                <td className="py-2 font-mono font-medium text-ink">{formatLondonDateTime(job.actualStart)}</td>
                <td className="py-2 font-mono text-muted">{job.bookedMinutes}m</td>
                <td className="py-2"><DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} /></td>
              </tr>
              <tr>
                <td className="py-2 text-ink">Finish</td>
                <td className="py-2 font-mono text-muted">{formatLondonDateTime(job.bookedFinish)}</td>
                <td className="py-2 font-mono font-medium text-ink">{formatLondonDateTime(job.actualFinish)}</td>
                <td className="py-2 font-mono text-muted">{job.actualMinutes ? `${job.actualMinutes}m` : "—"}</td>
                <td className="py-2 font-mono text-xs">
                  {job.overtimeMinutes > 0 ? (
                    <span className="text-status-amber font-medium">+{job.overtimeMinutes}m overtime</span>
                  ) : (
                    <span className="text-muted">On schedule</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Photographs (4-Step Audit) */}
      <div className="p-4 rounded border border-line bg-paper mb-6">
        <h3 className="text-xs font-medium text-muted mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-brand" />
            Evidence Photographs
          </span>
          <span className="text-xs text-muted">
            {job.evidenceItems.filter(e => e.state === "COMPLETED").length} of 4 captured
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photoCategories.map(({ key, label, short, state }) => {
            const ev = job.evidenceItems.find(e => e.category.toLowerCase().includes(key.toLowerCase()) || e.category.toLowerCase().includes(short.toLowerCase()));
            const fileId = ev?.fileId;
            const thumbUrl = fileId ? `/ops/api/jobs/${encodeURIComponent(job.jobId)}/photos/${encodeURIComponent(fileId)}` : undefined;

            return (
              <div key={key} className="p-2.5 bg-surface rounded border border-line flex flex-col items-center justify-between text-center">
                <span className="text-xs font-medium text-ink mb-1.5 block truncate w-full">{label}</span>
                <ThumbnailPreview
                  src={thumbUrl}
                  alt={`${label}, job ${job.jobId}`}
                  state={state}
                  size="lg"
                  onClick={() => {
                    if (thumbUrl) {
                      setActivePhoto({
                        title: `${job.jobId} - ${label}`,
                        url: thumbUrl,
                        driveUrl: ev?.driveUrl
                      });
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Charges & Signature */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Charges */}
        <div className="p-4 rounded border border-line bg-paper">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-muted flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-brand" />
              Charges & Payment
            </h3>
            <span
              className={`px-2 py-0.5 rounded-pill text-xs font-medium ${
                job.reconciled ? "bg-status-green-bg text-status-green" : "bg-status-amber-bg text-status-amber"
              }`}
            >
              {job.reconciled ? "Reconciled" : "Unreconciled"}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-line">
              <span className="text-muted">Base Price</span>
              <span className="font-mono text-ink">£{(job.basePrice / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line">
              <span className="text-muted">Extra Charges</span>
              <span className="font-mono text-ink">£{(job.extraCharges / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line">
              <span className="text-muted">Overtime ({job.overtimeMinutes}m)</span>
              <span className="font-mono text-ink">£{(job.overtimeCharge / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-t border-line font-semibold text-sm">
              <span className="text-ink">Total Charges</span>
              <span className="font-mono text-brand">£{(job.totalCharges / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Customer Signature */}
        <div className="p-4 rounded border border-line bg-paper flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-medium text-muted mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
              Customer Sign-Off
            </h3>
            <div className="text-xs text-muted mb-2">
              Confirmed by <span className="font-semibold text-ink">{job.clientConfirmedName || job.customerName}</span>
            </div>
          </div>

          <div className="p-2.5 bg-surface rounded border border-line flex items-center justify-between">
            {job.signatureUrl ? (
              <div
                onClick={() => setActivePhoto({ title: `${job.jobId} - Customer Signature`, url: job.signatureUrl! })}
                className="cursor-pointer group flex items-center gap-3"
              >
                <img
                  src={job.signatureUrl}
                  alt={`Customer signature, job ${job.jobId}`}
                  className="max-h-12 object-contain group-hover:scale-105 transition"
                  onError={e => { (e.target as HTMLElement).style.display = "none"; }}
                />
                <span className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted italic">No signature recorded</span>
            )}
          </div>
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
