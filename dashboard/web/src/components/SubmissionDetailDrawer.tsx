import React, { useState } from "react";
import { X, Download, Eye, Maximize2, ZoomIn, ZoomOut, Check, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PaperDossierReport } from "./PaperDossierReport";
import { NormalizedJob } from "../types";
import { formatLondonDateTime } from "../utils/date";

interface Props {
  job: NormalizedJob;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (dir: 'next' | 'prev') => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export function SubmissionDetailDrawer({ job, isOpen, onClose, onNavigate, hasNext, hasPrev }: Props) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Activity" | "Comments">("Activity");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!isOpen || !job) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDownload = () => {
    setIsGeneratingPdf(true);
    // Render the report and trigger print
    setTimeout(() => {
      // Temporarily set document title for nice PDF filename
      const originalTitle = document.title;
      const dateStr = new Date().toISOString().slice(0, 10);
      document.title = `Job_Completed_${job.jobId}_${job.driverName?.replace(/\\s+/g, '')}_${dateStr}`;
      
      window.print();
      
      document.title = originalTitle;
      setIsGeneratingPdf(false);
      showToast("PDF Downloaded");
    }, 800);
  };

  const formattedTime = job.actualFinish ? formatLondonDateTime(job.actualFinish) : (job.bookedStart ? formatLondonDateTime(job.bookedStart) : 'Unknown Time');

  const SidebarLeft = () => (
    <div className="w-[300px] flex-shrink-0 border-r border-line bg-white flex flex-col p-6 overflow-y-auto custom-scrollbar relative z-10">
      <h3 className="text-[14px] font-bold text-ink mb-6">Manager fields</h3>
      <div className="space-y-6">
        <div className="bg-[#F8F9FA] border border-line rounded-[16px] p-4 relative shadow-sm">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink mb-3">Note <Eye className="w-4 h-4 text-muted" /></label>
          <textarea className="w-full bg-white border border-line rounded-xl p-3 text-[13px] text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/20 min-h-[100px] resize-none" placeholder="Type here..." />
          <button className="absolute bottom-4 right-4 bg-brand hover:bg-brand-dark text-white text-[12px] font-bold px-4 py-1.5 rounded-full transition shadow-sm">Save</button>
        </div>
        <div className="bg-[#F8F9FA] border border-line rounded-[16px] p-4 flex items-center justify-between shadow-sm">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink">Status <Eye className="w-4 h-4 text-muted" /></label>
          <select className="bg-white border border-line rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 outline-none">
            <option>Select</option>
            <option>Approved</option>
            <option>Flagged</option>
          </select>
        </div>
      </div>
    </div>
  );

  const SidebarRight = () => (
    <div className="w-[300px] flex-shrink-0 border-l border-line bg-white flex flex-col p-6 overflow-y-auto custom-scrollbar relative z-10">
      <div className="flex items-center gap-6 border-b border-line pb-3 mb-6">
        <button onClick={() => setActiveTab("Activity")} className={`text-[13px] font-bold pb-3 -mb-3 transition ${activeTab === 'Activity' ? 'text-brand border-b-2 border-brand' : 'text-muted hover:text-ink'}`}>Activity</button>
        <button onClick={() => setActiveTab("Comments")} className={`text-[13px] font-bold pb-3 -mb-3 transition ${activeTab === 'Comments' ? 'text-brand border-b-2 border-brand' : 'text-muted hover:text-ink'}`}>Comments</button>
      </div>

      <div className="flex-1">
        {activeTab === "Activity" && (
          <div className="relative pl-4 space-y-6 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-line">
            <div className="relative flex flex-col">
               <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand ring-4 ring-white" />
               <div className="flex items-center gap-2 mb-1">
                 <div className="w-6 h-6 rounded-full bg-brand-soft text-brand font-bold text-[9px] flex items-center justify-center">
                    {job.driverInitials || 'UN'}
                 </div>
                 <span className="text-[13px] font-bold text-ink">{job.driverName || 'Unknown Driver'}</span>
               </div>
               <span className="text-[13px] text-muted mb-1">submitted the form</span>
               <span className="text-[11px] font-medium text-muted/60">{formattedTime}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const photos = job.evidenceItems?.filter(e => true && e.fileId) || [];

  const FormAnswersView = () => (
    <div className="max-w-2xl mx-auto space-y-6 w-full py-8 px-6">
      <div className="bg-white rounded-[20px] p-6 shadow-sm border border-line">
         <label className="text-[13px] font-semibold text-muted block mb-2">Customer & Details</label>
         <div className="grid grid-cols-2 gap-4">
           <div>
             <span className="text-[11px] uppercase text-muted font-semibold tracking-wider">Customer Name</span>
             <div className="text-[14px] font-medium text-ink mt-1">{job.customerName || "N/A"}</div>
           </div>
           <div>
             <span className="text-[11px] uppercase text-muted font-semibold tracking-wider">Confirmed By</span>
             <div className="text-[14px] font-medium text-ink mt-1">{job.clientConfirmedName || "N/A"}</div>
           </div>
           <div className="col-span-2">
             <span className="text-[11px] uppercase text-muted font-semibold tracking-wider">Pickup</span>
             <div className="text-[14px] font-medium text-ink mt-1">{job.pickup || "N/A"}</div>
           </div>
           <div className="col-span-2">
             <span className="text-[11px] uppercase text-muted font-semibold tracking-wider">Dropoff</span>
             <div className="text-[14px] font-medium text-ink mt-1">{job.dropoff || "N/A"}</div>
           </div>
         </div>
      </div>
      
      <div className="bg-white rounded-[20px] p-6 shadow-sm border border-line">
         <label className="text-[13px] font-semibold text-muted block mb-4">Evidence that the items have been loaded.</label>
         {photos.length > 0 ? (
           <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
             {photos.map((p, i) => (
               <a 
                 key={i} 
                 href={p.driveUrl || p.thumbProxyUrl || `/ops/api/jobs/${job.jobId}/photos/${p.fileId}`}
                 target="_blank" rel="noreferrer"
                 className="aspect-square rounded-[12px] bg-surface overflow-hidden border border-line shadow-sm hover:ring-2 hover:ring-brand/50 transition cursor-pointer block relative group"
               >
                 <img src={p.thumbProxyUrl || `/ops/api/jobs/${job.jobId}/photos/${p.fileId}`} className="w-full h-full object-cover" alt={p.category} />
                 <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <Maximize2 className="w-5 h-5 text-white" />
                 </div>
                 <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-ink/80 to-transparent p-2 text-[9px] text-white font-bold truncate">
                    {p.category}
                 </div>
               </a>
             ))}
           </div>
         ) : (
           <div className="p-8 text-center bg-surface border border-dashed border-line rounded-xl">
              <span className="text-muted text-[13px]">No photos captured.</span>
           </div>
         )}
      </div>

      <div className="bg-white rounded-[20px] p-6 shadow-sm border border-line">
         <label className="text-[13px] font-semibold text-muted block mb-4">Client Signature</label>
         {job.signatureUrl ? (
            <div className="border border-line rounded-xl p-4 bg-surface max-w-sm flex justify-center">
              <img src={job.signatureUrl} alt="Signature" className="max-h-24 mix-blend-multiply" />
            </div>
         ) : (
            <div className="p-8 text-center bg-surface border border-dashed border-line rounded-xl max-w-sm">
              <span className="text-muted text-[13px]">No physical signature captured.</span>
            </div>
         )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex bg-ink/30 backdrop-blur-[2px] animate-in fade-in duration-200">
      
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-ink text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4 text-status-green" />
          <span className="text-[14px] font-semibold">{toast}</span>
        </div>
      )}

      {/* Main Drawer Container */}
      <div className={`bg-[#F5F5F5] shadow-2xl flex flex-col h-full overflow-hidden transition-all duration-300 ml-auto ${isFullscreen ? 'w-full' : 'w-full max-w-[1200px]'}`}>
        
        {/* TOP HEADER */}
        <div className="h-[72px] bg-white border-b border-line shadow-sm px-6 flex items-center justify-between shrink-0 relative z-20">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-full bg-brand-soft text-brand border border-brand/20 flex items-center justify-center font-bold text-[14px]">
               {job.driverInitials || "UN"}
             </div>
             <div>
               <h2 className="text-[15px] font-bold text-ink leading-tight">{job.driverName || "Unknown"}</h2>
               <div className="text-[12px] text-muted mt-0.5">{formattedTime}, Job ID: {job.jobId}</div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             {onNavigate && (
               <div className="flex items-center gap-1 mr-4 bg-surface rounded-xl border border-line p-1">
                 <button onClick={() => onNavigate('prev')} disabled={!hasPrev} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-white disabled:opacity-30 transition"><ChevronLeft className="w-4 h-4" /></button>
                 <button onClick={() => onNavigate('next')} disabled={!hasNext} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-white disabled:opacity-30 transition"><ChevronRight className="w-4 h-4" /></button>
               </div>
             )}
             <button 
               onClick={() => setIsPreviewing(!isPreviewing)}
               className={`h-10 px-4 rounded-xl border font-bold text-[13px] transition flex items-center gap-2 shadow-sm ${isPreviewing ? 'bg-surface border-line text-ink' : 'border-line bg-white hover:bg-surface text-ink'}`}
             >
               <Eye className="w-4 h-4 text-muted" /> {isPreviewing ? "Back to Form" : "Preview PDF"}
             </button>
             <button 
               onClick={handleDownload}
               disabled={isGeneratingPdf}
               className="h-10 px-4 rounded-xl border border-transparent bg-brand hover:bg-brand-dark text-white font-bold text-[13px] transition flex items-center gap-2 shadow-sm disabled:opacity-70"
             >
               {isGeneratingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
               <span>Download PDF</span>
             </button>
             <div className="w-px h-6 bg-line mx-2" />
             <button onClick={onClose} className="p-2 -mr-2 rounded-full text-muted hover:text-ink hover:bg-surface transition">
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Manager Sidebar */}
          {(!isPreviewing || !isFullscreen) && <SidebarLeft />}

          {/* Center Content */}
          <div className="flex-1 overflow-y-auto relative bg-[#F5F5F5] custom-scrollbar">
             {isPreviewing ? (
               <div className="min-h-full py-8 flex flex-col items-center">
                  <div className="w-full max-w-[210mm] relative">
                     <PaperDossierReport job={job} isPreview={true} />
                  </div>
                  
                  {/* Floating Toolbar */}
                  <div className="fixed bottom-8 right-1/2 translate-x-1/2 flex items-center gap-2 p-2 bg-ink/90 rounded-2xl shadow-xl backdrop-blur-md">
                     <button className="w-10 h-10 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition flex items-center justify-center"><ZoomOut className="w-4 h-4" /></button>
                     <span className="text-[12px] font-bold text-white/90 px-2 font-mono">100%</span>
                     <button className="w-10 h-10 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition flex items-center justify-center"><ZoomIn className="w-4 h-4" /></button>
                     <div className="w-px h-6 bg-white/20 mx-1" />
                     <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-10 h-10 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition flex items-center justify-center" title="Toggle Fullscreen">
                       <Maximize2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>
             ) : (
               <FormAnswersView />
             )}
          </div>

          {/* Activity Sidebar */}
          {(!isPreviewing || !isFullscreen) && <SidebarRight />}
        </div>
      </div>
      
      {/* Hidden PDF renderer just for printing */}
      {!isPreviewing && (
        <div className="hidden">
           <PaperDossierReport job={job} isPreview={false} />
        </div>
      )}
    </div>
  );
}
