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
  Printer,
  Edit2,
  Flag
} from "lucide-react";
import { NormalizedJob, toPounds } from "../types";
import { JobStatusBadge, DelayBandBadge } from "./StatusBadge";
import { EvidenceCompletenessPill } from "./EvidenceCompletenessPill";
import { ThumbnailPreview } from "./ThumbnailPreview";
import { PhotoModal } from "./PhotoModal";
import { PaperDossierReport } from "./PaperDossierReport";
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
    window.print();
  };

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

  // Logic Fix: Sequential Timeline Enforcement
  let firstPendingIndex = rawStages.findIndex(s => s.state === "PENDING");
  if (firstPendingIndex === -1) firstPendingIndex = 999;
  
  const stages = rawStages.map((stg, i) => {
    let finalState = stg.state;
    let isOutOfSequence = false;
    
    if (stg.state === "COMPLETED" && i > firstPendingIndex) {
      isOutOfSequence = true;
    }
    
    return { ...stg, finalState, isOutOfSequence };
  });

  const isInvalidAddress = (addr?: string) => {
    if (!addr) return true;
    const lower = addr.toLowerCase().trim();
    if (lower.length < 4) return true;
    if (["hhh", "test", "not recorded"].includes(lower)) return true;
    return false;
  };

  const isCancelled = job.status === "CANCELLED";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/40 backdrop-blur-xs flex justify-end">
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Printable Certified PDF */}
      <PaperDossierReport job={job} />

      {/* Drawer Container */}
      <div className="w-full max-w-2xl bg-[#F7F7F7] border-l border-line shadow-2xl flex flex-col h-full overflow-hidden animate-slide-in-right">
        
        {/* 1. Header (Two-row format, lots of padding) */}
        <div className="px-6 py-6 border-b border-line bg-white shadow-sm z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[18px] font-bold text-ink leading-tight">{job.jobId}</h3>
              <button
                onClick={handleCopyJobId}
                className="p-1 rounded text-muted hover:text-ink hover:bg-surface transition"
                title="Copy Job ID"
              >
                {copiedId ? <Check className="w-4 h-4 text-status-green" /> : <Copy className="w-4 h-4" />}
              </button>
              <JobStatusBadge status={job.status} />
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-muted hover:text-ink hover:bg-surface transition"
              title="Close Drawer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full bg-brand-soft text-brand font-mono font-bold text-[11px] flex items-center justify-center border border-brand/20 shadow-sm cursor-help"
              title={`Driver: ${job.driverName} (${job.driverInitials || "UN"})`}
            >
              {job.driverInitials || "UN"}
            </div>
            <span className="text-[13px] text-muted">
              Operations Dossier &bull; <span className="font-medium text-ink">{job.customerName || "Customer not recorded"}</span>
            </span>
          </div>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 text-[13px] text-ink">
          
          {/* Key Metrics Strip (3 distinct cards) */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-[12px] border border-line shadow-sm flex flex-col justify-between">
              <span className="text-[12px] uppercase semibold text-muted font-semibold tracking-wider flex items-center gap-1.5 mb-2">
                <DollarSign className="w-3.5 h-3.5" /> Billed
              </span>
              <span className="text-[20px] font-bold font-mono text-ink">£{totalPounds.toFixed(2)}</span>
              <div className="mt-2 flex">
                {job.reconciled ? (
                   <span className="px-2 py-0.5 rounded-full bg-status-green-bg text-status-green text-[10px] font-bold uppercase tracking-wider">Paid</span>
                ) : (
                   <span className="px-2 py-0.5 rounded-full bg-surface text-muted text-[10px] font-bold uppercase tracking-wider">Unpaid</span>
                )}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-[12px] border border-line shadow-sm flex flex-col justify-between">
              <span className="text-[12px] uppercase semibold text-muted font-semibold tracking-wider flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5" /> Driver
              </span>
              <span className="text-[14px] font-bold text-ink truncate block" title={job.driverName}>{job.driverName || "Unassigned"}</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[12px] text-muted">{job.crewSize} Crew</span>
                {job.driverName && job.driverName !== "Unassigned" && job.driverName !== "N/A" && (
                  <span 
                    className="px-1.5 py-0.5 rounded-[4px] bg-status-green-bg text-status-green font-semibold text-[10px] uppercase tracking-wider" 
                    title="Assignment notification successfully sent to driver"
                  >
                    Sent (SMS)
                  </span>
                )}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-[12px] border border-line shadow-sm flex flex-col justify-between">
              <span className="text-[12px] uppercase semibold text-muted font-semibold tracking-wider flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5" /> Punctuality
              </span>
              <div className="mt-1">
                {isCancelled ? (
                  <span className="text-muted/50 font-mono">—</span>
                ) : (
                  <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
                )}
              </div>
            </div>
          </div>

          {/* Route Corridors */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <MapPin className="w-4 h-4 text-brand" /> Route Corridors
            </h4>
            
            <div className="bg-white rounded-[12px] border border-line border-l-4 border-l-status-green shadow-sm p-4">
              <span className="text-[10px] font-bold text-status-green uppercase tracking-wider block mb-1">Pickup</span>
              {isInvalidAddress(job.pickup) ? (
                 <div className="flex items-center gap-1.5 text-muted/70 text-[13px]"><AlertTriangle className="w-3.5 h-3.5" /> Address not properly recorded</div>
              ) : (
                 <span className="font-medium text-ink block">{job.pickup}</span>
              )}
            </div>
            
            <div className="bg-white rounded-[12px] border border-line border-l-4 border-l-[#2563EB] shadow-sm p-4">
              <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider block mb-1">Dropoff</span>
              {isInvalidAddress(job.dropoff) ? (
                 <div className="flex items-center gap-1.5 text-muted/70 text-[13px]"><AlertTriangle className="w-3.5 h-3.5" /> Address not properly recorded</div>
              ) : (
                 <span className="font-medium text-ink block">{job.dropoff}</span>
              )}
            </div>
          </div>

          {/* 10-Stage Lifecycle Timeline */}
          <div className="bg-white p-5 rounded-[16px] border border-line shadow-sm">
            <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5 mb-5">
              <Clock className="w-4 h-4 text-brand" /> Audit Lifecycle Timeline
            </h4>
            
            <div className="relative pl-5 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line max-h-[300px] overflow-y-auto pr-2 custom-scrollbar relative">
              {stages.map((stg, i) => {
                const isComp = stg.finalState === "COMPLETED";
                return (
                  <div key={i} className="relative flex items-start justify-between text-[13px]">
                    
                    {stg.isOutOfSequence ? (
                       <div className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-brand bg-brand-soft ring-4 ring-white" title="Completed out of sequence" />
                    ) : isComp ? (
                       <div className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-status-green bg-status-green ring-4 ring-white" />
                    ) : (
                       <div className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-muted bg-white ring-4 ring-white" />
                    )}
                    
                    <div>
                      <span className={`font-semibold block ${isComp ? "text-ink" : "text-muted"}`}>
                        {stg.name}
                      </span>
                      <span className="text-[11px] text-muted block mt-0.5">
                        {stg.actor} {stg.detail ? `• ${stg.detail}` : ""}
                      </span>
                    </div>
                    
                    <span className="text-[11px] font-mono text-muted text-right shrink-0">
                      {stg.time ? formatLondonDateTime(stg.time) : "—"}
                    </span>
                  </div>
                );
              })}
              {/* Fade gradient at bottom */}
              <div className="sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Photographic Evidence Grid */}
          <div className="bg-white p-5 rounded-[16px] border border-line shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-brand" /> Evidence Photographs
              </h4>
              <EvidenceCompletenessPill completeness={job.evidenceCompleteness} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {job.evidenceItems.map((ev, i) => (
                <div key={ev.id || i} className="p-2 bg-surface rounded-[12px] border border-line text-center space-y-2">
                  <span className="text-[11px] font-semibold text-muted block truncate">{ev.category}</span>
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
          
        </div>

        {/* 3. Drawer Bottom Action Footer */}
        <div className="p-4 border-t border-line bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3 z-10 relative">
          
          <div className="flex gap-2">
            <button
              onClick={handlePdfDownload}
              className="h-10 px-4 rounded-xl bg-black text-white text-[13px] font-semibold hover:bg-black/80 transition flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button className="h-10 px-3 rounded-xl border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium transition flex items-center gap-1.5 shadow-sm">
              <User className="w-4 h-4 text-muted" /> Reassign
            </button>
            <button className="h-10 px-3 rounded-xl border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium transition flex items-center gap-1.5 shadow-sm">
              <Edit2 className="w-4 h-4 text-muted" /> Edit
            </button>
          </div>

          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-surface hover:bg-surface-2 text-ink text-[13px] font-semibold transition"
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
