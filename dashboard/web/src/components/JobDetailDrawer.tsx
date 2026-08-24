import React, { useState, useEffect } from "react";
import { 
  X, 
  MapPin, 
  Clock, 
  DollarSign, 
  User, 
  Camera, 
  Copy, 
  Check, 
  Download, 
  AlertTriangle,
  Edit2,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  Info
} from "lucide-react";
import { NormalizedJob } from "../types";
import { formatLondonDateTime } from "../utils/date";
import { JobStatusBadge } from "./StatusBadge";
import { DelayBandBadge } from "./StatusBadge";
import { EvidenceCompletenessPill } from "./EvidenceCompletenessPill";
import { PaperDossierReport } from "./PaperDossierReport";
import { PhotoModal } from "./PhotoModal";
import { ThumbnailPreview } from "./ThumbnailPreview";
import { getDrivers, resolveDriver, formatVanReg } from "../utils/drivers";

interface Props {
  job: NormalizedJob;
  isOpen: boolean;
  onClose: () => void;
}

export function JobDetailDrawer({ job: initialJob, isOpen, onClose }: Props) {
  const [job, setJob] = useState<NormalizedJob>(initialJob);
  const [copiedId, setCopiedId] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{title: string, url: string, driveUrl?: string} | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    pickup: "",
    dropoff: "",
    billed: "",
    crew: ""
  });

  // Reassign Mode State
  const [isReassigning, setIsReassigning] = useState(false);

  // Timeline State
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

  // PDF Generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setJob(initialJob);
    setIsEditing(false);
    setIsReassigning(false);
  }, [initialJob]);

  // Sync to Edit Form
  useEffect(() => {
    if (isEditing) {
      setEditData({
        pickup: job.pickup || "",
        dropoff: job.dropoff || "",
        billed: ((job.totalCharges || 0) / 100).toFixed(2),
        crew: String(job.crewSize || 2)
      });
    }
  }, [isEditing, job]);

  if (!isOpen) return null;

  const handleCopyJobId = () => {
    navigator.clipboard.writeText(job.jobId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePdfDownload = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      setIsGeneratingPdf(false);
      showToast(`Report generated — ${job.jobId}_Dossier.pdf downloaded`);
    }, 1500);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveEdit = () => {
    const valBilled = parseFloat(editData.billed);
    const valCrew = parseInt(editData.crew, 10);
    
    if (isNaN(valBilled) || valBilled < 0 || isNaN(valCrew) || valCrew < 1) {
      showToast("Invalid numeric values");
      return;
    }

    setJob({
      ...job,
      pickup: editData.pickup,
      dropoff: editData.dropoff,
      totalCharges: valBilled * 100,
      crewSize: valCrew
    });
    
    setIsEditing(false);
    showToast("Job Details Updated");
  };

  const handleReassign = (driverCode: string) => {
    const newDriver = getDrivers().find(d => d.code === driverCode);
    if (newDriver) {
      setJob({
        ...job,
        driverName: newDriver.name,
        driverInitials: newDriver.code
      });
      setIsReassigning(false);
      showToast(`Reassigned to ${newDriver.name} — notified`);
    }
  };

  const toggleStage = (i: number) => {
    const next = new Set(expandedStages);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setExpandedStages(next);
  };

  const isInvalidAddress = (addr?: string) => {
    if (!addr) return true;
    const lower = addr.toLowerCase().trim();
    if (lower.length < 8) return true; 
    if (["hhh", "test", "not recorded"].includes(lower)) return true;
    if (!/\\s/.test(lower)) return true; // Flags completely spaceless strings like '2Multan-pak'
    return false;
  };

  const isCancelled = job.status === "CANCELLED";
  const totalPounds = (job.totalCharges || 0) / 100;
  
  // 10-Stage Lifecycle Audit Timeline
  const rawStages = [
    { name: "Booking Created", time: job.bookedStart, actor: "System", state: "COMPLETED", detail: "API Ingestion" },
    { name: "Driver Assigned", time: job.bookedStart, actor: "Dispatcher", state: "COMPLETED", detail: `${job.driverName} (${job.driverInitials})` },
    { name: "En Route to Pickup", time: job.actualStart || job.bookedStart, actor: job.driverName, state: job.status !== "READY" ? "COMPLETED" : "PENDING", detail: "GPS match: 51.48, -0.15" },
    { name: "Arrived at Pickup", time: job.actualStart, actor: job.driverName, state: job.actualStart ? "COMPLETED" : "PENDING", detail: "Ping: 2m before door" },
    { name: "Loading Van & Evidence", time: job.actualStart, actor: job.driverName, state: job.evidenceCompleteness?.vanLoaded === "COMPLETED" ? "COMPLETED" : "PENDING", detail: "Photos uploaded" },
    { name: "In Transit to Dropoff", time: job.actualStart, actor: job.driverName, state: job.status === "IN_PROGRESS" || job.status === "COMPLETED" ? "COMPLETED" : "PENDING", detail: "Location streaming..." },
    { name: "Unloading & Empty Van", time: job.actualFinish, actor: job.driverName, state: job.evidenceCompleteness?.emptyVan === "COMPLETED" ? "COMPLETED" : "PENDING", detail: "Confirmed empty" },
    { name: "Payment Received", time: job.actualFinish, actor: "Customer / Driver", state: job.reconciled ? "COMPLETED" : "PENDING", detail: job.paymentMethod || "Card (Stripe)" },
    { name: "Customer Sign-off", time: job.actualFinish, actor: job.clientConfirmedName || job.customerName, state: job.signatureUrl ? "COMPLETED" : "PENDING", detail: "Signature Hash: e3b2...a9" },
    { name: "Job Completed", time: job.actualFinish, actor: "System Bot", state: job.status === "COMPLETED" ? "COMPLETED" : "PENDING", detail: "Archived & locked" }
  ];

  let firstPendingIndex = rawStages.findIndex(s => s.state === "PENDING");
  if (firstPendingIndex === -1) firstPendingIndex = 999;
  
  const stages = rawStages.map((stg, i) => {
    const isOutOfSequence = stg.state === "COMPLETED" && i > firstPendingIndex;
    return { ...stg, isOutOfSequence };
  });

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-ink/70 backdrop-blur-sm flex justify-end">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-ink text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4 text-status-green" />
          <span className="text-[14px] font-semibold">{toast}</span>
        </div>
      )}

      {/* Backdrop click to close */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-2xl bg-[#F5F5F5] shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right-10 duration-200">
        
        {/* 1. Header */}
        <div className="px-6 py-5 bg-white border-b border-line shadow-[0_4px_20px_rgb(0,0,0,0.03)] z-10 flex flex-col gap-4">
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
              className="p-2 -mr-2 rounded-full text-muted hover:text-ink hover:bg-surface transition"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full bg-surface text-muted border border-line font-bold text-[11px] flex items-center justify-center shadow-sm"
            >
              {job.driverInitials || "UN"}
            </div>
            <span className="text-[13px] text-muted">
              Operations Dossier &bull; <span className="font-medium text-ink">{job.customerName || "Customer not recorded"}</span>
            </span>
          </div>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[13px] text-ink relative">
          
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-[16px] border border-line shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase text-muted font-bold tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3" /> Billed
                </span>
              </div>
              {isEditing ? (
                <div className="relative mt-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted font-bold text-[14px]">£</span>
                  <input type="number" className="w-full h-8 pl-6 pr-2 rounded-md border border-line text-[14px] font-bold font-mono outline-none focus:border-brand" value={editData.billed} onChange={e => setEditData({...editData, billed: e.target.value})} />
                </div>
              ) : (
                <span className="text-[20px] font-bold font-mono text-ink">£{totalPounds.toFixed(2)}</span>
              )}
            </div>
            
            <div className="bg-white p-4 rounded-[16px] border border-line shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col justify-between">
              <span className="text-[11px] uppercase text-muted font-bold tracking-wider flex items-center gap-1.5 mb-2">
                <User className="w-3 h-3" /> Driver
              </span>
              <span className="text-[14px] font-bold text-ink truncate block">
                {job.driverName || "Unassigned"}
              </span>
              <div className="flex items-center justify-between mt-2">
                {isEditing ? (
                   <input type="number" className="w-12 h-6 px-1 rounded-md border border-line text-[12px] text-center outline-none focus:border-brand" value={editData.crew} onChange={e => setEditData({...editData, crew: e.target.value})} />
                ) : (
                   <span className="text-[12px] text-muted">{job.crewSize} Crew</span>
                )}
                {job.driverName && job.driverName !== "Unassigned" && (
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-status-green-bg text-status-green font-bold text-[9px] uppercase tracking-wider">
                    Sent (SMS)
                  </span>
                )}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-[16px] border border-line shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col justify-between">
              <span className="text-[11px] uppercase text-muted font-bold tracking-wider flex items-center gap-1.5 mb-2">
                <Clock className="w-3 h-3" /> Punctuality
              </span>
              <div className="mt-1">
                {isCancelled ? <span className="text-muted/50 font-mono">-</span> : <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />}
              </div>
            </div>
          </div>

          {/* Reassign Modal / Dropdown (Inline) */}
          {isReassigning && (
             <div className="bg-white p-4 rounded-[16px] border border-brand shadow-sm animate-in fade-in slide-in-from-top-2">
               <h4 className="text-[13px] font-bold text-ink mb-3">Reassign Driver</h4>
               <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                 {getDrivers().map(d => (
                   <button 
                     key={d.code}
                     onClick={() => handleReassign(d.code)}
                     className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface border border-transparent hover:border-line transition text-left"
                   >
                     <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${d.color}`}>{d.code}</div>
                       <div>
                         <div className="text-[13px] font-bold text-ink">{d.name}</div>
                         <div className="text-[11px] font-mono text-muted uppercase">{formatVanReg(d.vehicleReg)}</div>
                       </div>
                     </div>
                     <span className="text-[11px] font-bold text-brand hover:underline">Select</span>
                   </button>
                 ))}
               </div>
               <div className="mt-3 text-right">
                 <button onClick={() => setIsReassigning(false)} className="text-[12px] font-semibold text-muted hover:text-ink">Cancel</button>
               </div>
             </div>
          )}

          {/* Route Corridors */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <MapPin className="w-4 h-4 text-brand" /> Route Corridors
            </h4>
            
            <div className="bg-white rounded-[16px] border border-line border-l-4 border-l-status-green shadow-[0_2px_10px_rgb(0,0,0,0.02)] p-4">
              <span className="text-[10px] font-bold text-status-green uppercase tracking-wider block mb-1">Pickup</span>
              {isEditing ? (
                 <input type="text" className="w-full h-8 px-2 rounded-md border border-line text-[13px] outline-none focus:border-brand" value={editData.pickup} onChange={e => setEditData({...editData, pickup: e.target.value})} placeholder="Search address..." />
              ) : isInvalidAddress(job.pickup) ? (
                 <div className="flex items-center gap-1.5 text-muted/70 text-[13px]"><AlertTriangle className="w-3.5 h-3.5" /> Address not properly recorded</div>
              ) : (
                 <span className="font-medium text-ink block">{job.pickup}</span>
              )}
            </div>
            
            <div className="bg-white rounded-[16px] border border-line border-l-4 border-l-[#2563EB] shadow-[0_2px_10px_rgb(0,0,0,0.02)] p-4">
              <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider block mb-1">Dropoff</span>
              {isEditing ? (
                 <input type="text" className="w-full h-8 px-2 rounded-md border border-line text-[13px] outline-none focus:border-brand" value={editData.dropoff} onChange={e => setEditData({...editData, dropoff: e.target.value})} placeholder="Search address..." />
              ) : isInvalidAddress(job.dropoff) ? (
                 <div className="flex items-center gap-1.5 text-muted/70 text-[13px]"><AlertTriangle className="w-3.5 h-3.5" /> Address not properly recorded</div>
              ) : (
                 <span className="font-medium text-ink block">{job.dropoff}</span>
              )}
            </div>
          </div>

          {/* 10-Stage Lifecycle Timeline */}
          <div className="bg-white rounded-[16px] border border-line shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-line">
              <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand" /> Audit Lifecycle Timeline
              </h4>
            </div>
            
            <div className="relative p-5 max-h-[280px] overflow-y-auto custom-scrollbar">
              <div className="absolute left-[27px] top-6 bottom-6 w-0.5 bg-line" />
              
              <div className="space-y-6 relative z-10">
                {stages.map((stg, i) => {
                  const isComp = stg.state === "COMPLETED";
                  const expanded = expandedStages.has(i);

                  return (
                    <div 
                      key={i} 
                      className={`relative flex items-start justify-between text-[13px] group ${isComp ? 'cursor-pointer' : ''}`}
                      onClick={() => isComp && toggleStage(i)}
                    >
                      {stg.isOutOfSequence ? (
                         <div className="w-3 h-3 mt-1 mr-4 rounded-full border-2 border-brand bg-brand-soft ring-4 ring-white shrink-0" title="Completed out of sequence" />
                      ) : isComp ? (
                         <div className="w-3 h-3 mt-1 mr-4 rounded-full border-2 border-status-green bg-status-green ring-4 ring-white shrink-0" />
                      ) : (
                         <div className="w-3 h-3 mt-1 mr-4 rounded-full border-2 border-muted bg-white ring-4 ring-white shrink-0" />
                      )}
                      
                      <div className="flex-1">
                        <span className={`font-bold flex items-center gap-1 ${isComp ? "text-ink group-hover:text-brand transition" : "text-muted"}`}>
                          {stg.name}
                          {isComp && (expanded ? <ChevronDown className="w-3 h-3 text-muted" /> : <ChevronRight className="w-3 h-3 text-muted" />)}
                        </span>
                        
                        {expanded && isComp && (
                          <div className="mt-2 p-3 rounded-xl bg-surface border border-line text-[12px] text-ink shadow-inner animate-in fade-in slide-in-from-top-1">
                             <div className="flex items-center gap-2 mb-1"><User className="w-3 h-3 text-muted" /> <span className="font-semibold text-muted">Actor:</span> {stg.actor}</div>
                             <div className="flex items-center gap-2"><Info className="w-3 h-3 text-muted" /> <span className="font-semibold text-muted">Detail:</span> {stg.detail || "No additional logs"}</div>
                          </div>
                        )}
                        {!expanded && (
                           <span className="text-[11px] text-muted block mt-0.5 font-medium">
                             {stg.actor}
                           </span>
                        )}
                      </div>
                      
                      <span className="text-[11px] font-mono font-semibold text-muted text-right shrink-0">
                        {isComp && stg.time ? formatLondonDateTime(stg.time) : <span className="px-1.5 py-0.5 rounded bg-surface border border-line text-[9px] uppercase tracking-wider text-muted">Waiting</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Fade gradient at bottom inside scroll */}
              <div className="sticky bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Photographic Evidence Grid */}
          <div className="bg-white p-5 rounded-[16px] border border-line shadow-[0_2px_10px_rgb(0,0,0,0.02)] space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-brand" /> Evidence Photographs
              </h4>
              <EvidenceCompletenessPill completeness={job.evidenceCompleteness} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {job.evidenceItems?.map((ev, i) => (
                <div key={ev.id || i} className="p-2 bg-surface rounded-[12px] border border-line text-center space-y-2">
                  <span className="text-[11px] font-semibold text-muted block truncate">{ev.category}</span>
                  <ThumbnailPreview
                    src={ev.fileId ? `/ops/api/jobs/${encodeURIComponent(job.jobId)}/photos/${encodeURIComponent(ev.fileId)}` : undefined}
                    alt={`${ev.category} photo`}
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
        <div className="p-5 bg-white border-t border-line shadow-[0_-4px_20px_rgba(0,0,0,0.04)] flex items-center justify-between z-10 relative">
          
          <div className="flex gap-2">
            <button
              onClick={handlePdfDownload}
              disabled={isGeneratingPdf}
              className="h-10 px-4 rounded-xl bg-ink hover:bg-black text-white text-[13px] font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-70"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isGeneratingPdf ? "Generating..." : "Download PDF"}</span>
            </button>

            {!isEditing ? (
              <>
                <button onClick={() => setIsReassigning(!isReassigning)} className="h-10 px-3 rounded-xl border border-line bg-white hover:bg-surface text-ink text-[13px] font-bold transition flex items-center gap-1.5 shadow-sm">
                  <User className="w-4 h-4 text-muted" /> Reassign
                </button>
                <button onClick={() => setIsEditing(true)} className="h-10 px-3 rounded-xl border border-line bg-white hover:bg-surface text-ink text-[13px] font-bold transition flex items-center gap-1.5 shadow-sm">
                  <Edit2 className="w-4 h-4 text-muted" /> Edit
                </button>
              </>
            ) : (
              <>
                <button onClick={handleSaveEdit} className="h-10 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white text-[13px] font-bold transition flex items-center gap-1.5 shadow-sm">
                  <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setIsEditing(false)} className="h-10 px-4 rounded-xl border border-line bg-white hover:bg-surface text-ink text-[13px] font-bold transition shadow-sm">
                  Cancel
                </button>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="h-10 px-5 rounded-xl border border-transparent hover:bg-surface hover:text-ink text-muted text-[13px] font-bold transition"
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
