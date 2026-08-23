import React, { useState } from "react";
import { Download, Printer, Folder, User, MapPin, Clock, FileText, Banknote, CheckCircle2, Camera } from "lucide-react";
import { NormalizedJob } from "../types";
import { JobStatusBadge, DelayBandBadge } from "./StatusBadge";
import { EvidenceCompletenessPill } from "./EvidenceCompletenessPill";
import { formatLondonDateTime } from "../utils/date";

interface Props {
  job: NormalizedJob;
  onClose?: () => void;
}

export function PaperJobReport({ job, onClose }: Props) {
  const handlePrint = () => {
    window.print();
  };

  const handlePdfDownload = () => {
    // In production, this would trigger a puppeteer/wkhtmltopdf backend endpoint
    // For now, we use the browser's print-to-pdf mechanism.
    window.print();
  };

  const photoCategories = [
    { key: "Arrival", label: "Arrival Photo", state: job.evidenceCompleteness.arrival },
    { key: "Loaded", label: "Van Loaded Photo", state: job.evidenceCompleteness.vanLoaded },
    { key: "Empty", label: "Empty Van Photo", state: job.evidenceCompleteness.emptyVan },
    { key: "Organized", label: "Organized Cargo", state: job.evidenceCompleteness.organized },
  ];

  const photos = photoCategories.map(cat => {
    const ev = job.evidenceItems.find(e => 
      e.category.toLowerCase().includes(cat.key.toLowerCase()) && (e.thumbProxyUrl || e.driveUrl)
    );
    return {
      ...cat,
      url: ev ? (ev.thumbProxyUrl || ev.driveUrl) : null
    };
  });

  return (
    <div className="paper-sheet p-8 font-sans" style={{ backgroundColor: "#FFFFFF" }}>
      
      {/* NO-PRINT CONTROLS */}
      <div className="no-print flex items-center justify-between mb-6 pb-6 border-b border-line">
        <div className="text-[14px] font-semibold text-ink">Preview Document</div>
        <div className="flex items-center gap-3">
          <button onClick={handlePdfDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:bg-surface text-[13px] font-medium text-ink transition">
            <Download className="w-4 h-4 text-brand" /> PDF
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:bg-surface text-[13px] font-medium text-ink transition">
            <Printer className="w-4 h-4 text-muted" /> Print
          </button>
          {onClose && (
            <button onClick={onClose} className="px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink transition ml-2">
              Close
            </button>
          )}
        </div>
      </div>

      {/* DOCUMENT HEADER */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-line">
        <div className="flex items-center gap-3">
          <img src="/tmv-new-logo.png" alt="The Man Van" className="h-8 object-contain" />
          <span className="text-[16px] font-bold text-ink tracking-tight">The Man Van</span>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-3 mb-2">
            <h1 className="text-[18px] font-bold text-ink">Job Completed</h1>
            <span className="px-2.5 py-1 rounded-full bg-surface text-ink-2 text-[12px] font-mono font-semibold border border-line">
              #{job.jobId}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 text-[13px] text-muted">
            <div className="w-5 h-5 rounded-full bg-brand-soft text-brand flex items-center justify-center text-[10px] font-bold font-mono">
              {job.driverInitials || "UN"}
            </div>
            <span>{job.driverName || "Unassigned Driver"}</span>
            <span>&bull;</span>
            <span>{formatLondonDateTime(job.updated)} (London)</span>
          </div>
        </div>
      </div>

      {/* SUMMARY BAR */}
      <div className="grid grid-cols-4 gap-4 p-4 rounded-[16px] bg-[#F7F7F7] border border-line mb-8">
        <div>
          <span className="text-[11px] font-semibold uppercase text-muted tracking-wider block mb-2">Status</span>
          <JobStatusBadge status={job.status} />
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase text-muted tracking-wider block mb-2">Timing & Delay</span>
          <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase text-muted tracking-wider block mb-2">Driver</span>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-soft text-brand flex items-center justify-center text-[10px] font-bold font-mono">
              {job.driverInitials || "UN"}
            </span>
            <span className="text-[13px] font-medium text-ink">{job.driverName || "Unassigned"}</span>
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase text-muted tracking-wider block mb-2">Evidence State</span>
          <EvidenceCompletenessPill completeness={job.evidenceCompleteness} />
        </div>
      </div>

      {/* CONTENT SECTIONS */}
      <div className="grid grid-cols-2 gap-6 mb-8" style={{ pageBreakInside: 'avoid' }}>
        
        {/* Customer & Booking */}
        <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line">
          <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
            <User className="w-4 h-4" /> Customer & Booking
          </h3>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-muted mb-0.5">Customer Name</div>
              <div className="text-[14px] font-bold text-ink">{job.customerName || "Not recorded"}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-muted mb-0.5">Phone</div>
                <div className="text-[12px] font-mono text-ink-2">{job.customerPhone || "—"}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted mb-0.5">Crew</div>
                <div className="text-[12px] text-ink-2">{job.crewSize} Crew</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted mb-0.5">Email</div>
              <div className="text-[12px] text-ink-2">{job.customerEmail || "—"}</div>
            </div>
          </div>
        </div>

        {/* Route & Addresses */}
        <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line">
          <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Route & Addresses
          </h3>
          <div className="space-y-4">
            <div>
              <div className="text-[11px] text-muted mb-0.5">Pickup</div>
              <div className="text-[13px] font-medium text-ink leading-snug">{job.pickup || "Not recorded"}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted mb-0.5">Dropoff</div>
              <div className="text-[13px] font-medium text-ink leading-snug">{job.dropoff || "Not recorded"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timings */}
      <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line mb-8" style={{ pageBreakInside: 'avoid' }}>
        <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Scheduled vs Actual Timings
        </h3>
        <table className="w-full text-left text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className="pb-2 font-semibold text-muted">Stage</th>
              <th className="pb-2 font-semibold text-muted font-mono">Scheduled</th>
              <th className="pb-2 font-semibold text-muted font-mono">Actual</th>
              <th className="pb-2 font-semibold text-muted font-mono">Duration</th>
              <th className="pb-2 font-semibold text-muted">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            <tr>
              <td className="py-3 text-ink font-medium">Start</td>
              <td className="py-3 font-mono text-muted">{formatLondonDateTime(job.bookedStart)}</td>
              <td className="py-3 font-mono font-bold text-ink">{formatLondonDateTime(job.actualStart)}</td>
              <td className="py-3 font-mono text-muted">{job.bookedMinutes}m</td>
              <td className="py-3"><DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} /></td>
            </tr>
            <tr>
              <td className="py-3 text-ink font-medium">Finish</td>
              <td className="py-3 font-mono text-muted">{formatLondonDateTime(job.bookedFinish)}</td>
              <td className="py-3 font-mono font-bold text-ink">{formatLondonDateTime(job.actualFinish)}</td>
              <td className="py-3 font-mono text-muted">{job.actualMinutes ? `${job.actualMinutes}m` : "—"}</td>
              <td className="py-3 font-mono">
                {job.overtimeMinutes > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-status-amber-bg text-status-amber font-semibold text-[11px]">
                    +{job.overtimeMinutes}m overtime
                  </span>
                ) : (
                  <span className="text-muted">On schedule</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Evidence Photographs */}
      <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line mb-8" style={{ pageBreakInside: 'avoid' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4" /> Evidence Photographs
          </h3>
          <span className="text-[12px] text-muted">
            {photos.filter(p => p.url).length} of 4 captured
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {photos.map((photo, i) => (
            <div key={i} className="flex flex-col border border-line bg-white p-3 rounded-[12px]" style={{ pageBreakInside: 'avoid' }}>
              <div className="text-[12px] font-medium text-ink mb-2 text-center">{photo.label}</div>
              <div className="w-full bg-surface rounded-lg overflow-hidden flex items-center justify-center flex-1 min-h-[140px]">
                {photo.url ? (
                  <img src={photo.url} alt={photo.label} className="max-w-full max-h-[220px] object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted opacity-50">
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">No Image</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Row: Finance & Signature */}
      <div className="grid grid-cols-2 gap-6" style={{ pageBreakInside: 'avoid' }}>
        
        {/* Charges & Payment */}
        <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line relative">
          <div className="absolute top-4 right-4">
            {job.reconciled ? (
              <span className="px-2 py-0.5 rounded-full bg-status-green-bg text-status-green text-[10px] font-bold uppercase tracking-wide">
                Reconciled
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-status-amber-bg text-status-amber text-[10px] font-bold uppercase tracking-wide">
                Unreconciled
              </span>
            )}
          </div>
          
          <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Charges & Payment
          </h3>
          
          <table className="w-full text-[12px] text-ink-2">
            <tbody className="divide-y divide-line/60">
              <tr>
                <td className="py-2">Base Price</td>
                <td className="py-2 text-right font-mono font-medium text-ink">£{(job.basePrice || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-2">Extra Charges</td>
                <td className="py-2 text-right font-mono font-medium text-ink">£{(job.extraCharges || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-2">Overtime ({job.overtimeMinutes}m)</td>
                <td className="py-2 text-right font-mono font-medium text-ink">£{(job.overtimeCharge || 0).toFixed(2)}</td>
              </tr>
              <tr className="border-t-2 border-line">
                <td className="py-3 font-bold text-[14px] text-ink">Total Charges</td>
                <td className="py-3 text-right font-mono font-bold text-[14px] text-brand">£{(job.totalCharges || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Customer Sign-Off */}
        <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line">
          <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Customer Sign-Off
          </h3>
          <div className="text-[12px] text-muted mb-3">
            Confirmed by <span className="font-bold text-ink">{job.clientConfirmedName || job.customerName || "Customer"}</span>
          </div>
          
          <div className="w-full h-[120px] bg-white border border-line rounded-lg flex items-center justify-center p-2 mb-2">
            {job.signatureUrl ? (
              <img src={job.signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-[11px] font-medium text-muted uppercase tracking-wider opacity-50">No Signature Recorded</div>
            )}
          </div>
          
          <div className="text-[11px] text-muted text-right">
            Signed: {job.actualFinish ? formatLondonDateTime(job.actualFinish) : "—"}
          </div>
        </div>

      </div>

    </div>
  );
}

// Ensure Camera is imported above if not already
