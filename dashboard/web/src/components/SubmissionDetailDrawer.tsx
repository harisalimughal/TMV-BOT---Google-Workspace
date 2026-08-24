import React, { useState } from "react";
import { X, Download, Eye, Maximize2, ZoomIn, ZoomOut, Check, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PaperDossierReport } from "./PaperDossierReport";
import { NormalizedJob } from "../types"; // Using NormalizedJob as a mock for PDF report rendering

interface Props {
  submission: any;
  isOpen: boolean;
  onClose: () => void;
}

export function SubmissionDetailDrawer({ submission, isOpen, onClose }: Props) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Activity" | "Comments">("Activity");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDownload = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      window.print();
      setIsGeneratingPdf(false);
      showToast("PDF Downloaded");
    }, 800);
  };

  const mockJobForPdf: NormalizedJob = {
    jobId: submission.jobId || `SUB-${Math.floor(Math.random() * 1000)}`,
    status: "COMPLETED",
    driverName: submission.resolvedDriver?.name,
    driverInitials: submission.resolvedDriver?.code,
    actualFinish: submission.timestamp,
    bookedStart: submission.timestamp,
    pickup: submission.rawAddress,
    dropoff: submission.rawAddress,
    customerName: submission.clientName,
    clientConfirmedName: submission.clientName,
    signatureUrl: submission.signatureUrl,
    evidenceItems: [
      { id: "1", category: "Arrival", state: "COMPLETED", fileId: "123", provenance: "recorded" },
      { id: "2", category: "VanLoaded", state: "COMPLETED", fileId: "456", provenance: "recorded" },
    ]
  } as any;

  const SidebarLeft = () => (
    <div className="w-[300px] flex-shrink-0 border-r border-line bg-white flex flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar relative z-10">
      <h3 className="text-[14px] font-bold text-ink">Manager fields</h3>
      
      <div className="bg-[#F8F9FA] rounded-[16px] p-4 border border-[#E5E7EB] space-y-3">
        <label className="text-[13px] font-semibold text-muted flex items-center gap-1.5">Note <Eye className="w-3.5 h-3.5 text-muted/60" /></label>
        <textarea 
          placeholder="Type here..." 
          className="w-full h-24 rounded-xl border border-line bg-white p-3 text-[13px] text-ink outline-none focus:border-brand resize-none shadow-sm"
        />
        <div className="flex justify-end">
          <button className="px-4 h-8 rounded-full bg-brand text-white text-[12px] font-bold shadow-sm hover:bg-brand-dark transition">Save</button>
        </div>
      </div>

      <div className="bg-[#F8F9FA] rounded-[16px] p-4 border border-[#E5E7EB] flex items-center justify-between">
        <label className="text-[13px] font-semibold text-muted flex items-center gap-1.5">Status <Eye className="w-3.5 h-3.5 text-muted/60" /></label>
        <select className="h-8 px-3 rounded-[8px] bg-white border border-line text-[12px] font-semibold text-ink outline-none cursor-pointer shadow-sm">
          <option>Select</option>
          <option>Approved</option>
          <option>Flagged</option>
        </select>
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
                 <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${submission.resolvedDriver?.code || 'UN'}`} className="w-6 h-6 rounded-full" />
                 <span className="text-[13px] font-bold text-ink">{submission.resolvedDriver?.name}</span>
               </div>
               <span className="text-[13px] text-muted mb-1">submitted the form</span>
               <span className="text-[11px] font-medium text-muted/60">{submission.formattedTime}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const FormAnswersView = () => (
    <div className="max-w-2xl mx-auto space-y-6 w-full py-8 px-6">
      <div className="bg-white rounded-[20px] p-6 shadow-sm border border-line">
         <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=1200&h=400" className="w-full h-48 object-cover rounded-[12px] mb-6" alt="Header illustration" />
      </div>

      <div className="bg-white rounded-[20px] p-6 shadow-sm border border-line">
         <label className="text-[13px] font-semibold text-muted block mb-2">Address <span className="text-status-red">*</span></label>
         <div className="text-[14px] font-medium text-ink">{submission.rawAddress}</div>
      </div>
      
      <div className="bg-white rounded-[20px] p-6 shadow-sm border border-line">
         <label className="text-[13px] font-semibold text-muted block mb-4">Evidence that the items have been loaded. <span className="text-status-red">*</span></label>
         <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
           {Array.from({length: 8}).map((_, i) => (
             <div key={i} className="aspect-square rounded-[12px] bg-surface overflow-hidden border border-line shadow-sm hover:ring-2 hover:ring-brand/50 transition cursor-pointer">
               <img src={`https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&q=80&w=200&h=200`} className="w-full h-full object-cover" alt="Evidence" />
             </div>
           ))}
         </div>
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
             <div className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center font-bold text-[13px] text-muted">
               {submission.resolvedDriver?.code || "UN"}
             </div>
             <div>
               <h2 className="text-[15px] font-bold text-ink leading-tight">{submission.resolvedDriver?.name || "Unknown"}</h2>
               <div className="text-[12px] text-muted mt-0.5">{submission.formattedTime}, Submission ID: {submission.id || "32"}</div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsPreviewing(!isPreviewing)}
               className={`h-10 px-4 rounded-xl border font-bold text-[13px] transition flex items-center gap-2 shadow-sm ${isPreviewing ? 'bg-surface border-line text-ink' : 'border-line bg-white hover:bg-surface text-ink'}`}
             >
               <Eye className="w-4 h-4 text-muted" /> {isPreviewing ? "Back to Form" : "Preview"}
             </button>
             <button 
               onClick={handleDownload}
               disabled={isGeneratingPdf}
               className="h-10 px-4 rounded-xl border border-transparent bg-brand hover:bg-brand-dark text-white font-bold text-[13px] transition flex items-center gap-2 shadow-sm disabled:opacity-70"
             >
               {isGeneratingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
               <span>Download</span>
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
                     <PaperDossierReport job={mockJobForPdf} isPreview={true} />
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
    </div>
  );
}
