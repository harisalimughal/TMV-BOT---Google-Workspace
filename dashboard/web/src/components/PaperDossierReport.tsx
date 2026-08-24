import React from "react";
import { NormalizedJob } from "../types";
import { formatLondonDateTime } from "../utils/date";

interface Props {
  job: NormalizedJob;
  isPreview?: boolean;
}

export function PaperDossierReport({ job, isPreview = false }: Props) {
  const now = new Date().toISOString();
  
  // Helpers
  const formatPounds = (cents: number | undefined) => `£${((cents || 0) / 100).toFixed(2)}`;

  // Get Photos by Category
  const getPhoto = (category: string) => {
    const item = job.evidenceItems?.find(e => e.category === category);
    if (!item?.fileId) return null;
    return `/ops/api/jobs/${encodeURIComponent(job.jobId)}/photos/${encodeURIComponent(item.fileId)}`;
  };

  const arrivalPhoto = getPhoto("Arrival") || "/mock-arrival.jpg"; 
  const loadedPhoto = getPhoto("VanLoaded") || "/mock-loaded.jpg";
  const unloadedPhoto = getPhoto("EmptyVan") || "/mock-unloaded.jpg";
  const organizedPhoto = getPhoto("Organized") || "/mock-organized.jpg";

  // Data blocks
  const submitterName = job.driverName || "Unknown Driver";
  const submitterInitials = job.driverInitials || "UN";
  const formattedTime = formatLondonDateTime(job.actualFinish || job.bookedStart || now);

  const Header = () => (
    <div className="flex items-start justify-between mb-8 shrink-0">
      <h1 className="text-[24px] font-bold text-ink">Job Completed</h1>
      <div className="flex flex-col items-end">
        <div className="text-[20px] font-black text-brand tracking-tighter mb-1">THE MAN VAN</div>
        <span className="text-[12px] font-bold text-ink tracking-wider">020 3773 9113</span>
      </div>
    </div>
  );

  const SubmitterCard = () => (
    <div className="flex items-center justify-between p-4 mb-8 bg-[#F8F9FA] rounded-[12px] border border-[#E5E7EB] shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-soft text-brand font-bold text-[14px] flex items-center justify-center border border-brand/20">
          {submitterInitials}
        </div>
        <div>
          <div className="text-[14px] font-bold text-ink leading-tight">{submitterName}</div>
          <div className="text-[12px] font-medium text-muted mt-0.5">{formattedTime}</div>
        </div>
      </div>
      <div className="px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-full text-[12px] font-bold text-muted uppercase tracking-widest shadow-sm">
        #{job.jobId.slice(0, 8)}
      </div>
    </div>
  );

  const PhotoSection = ({ title, src }: { title: string, src: string }) => (
    <div className="flex-1 flex flex-col mb-8 min-h-0">
      <h2 className="text-[14px] font-semibold text-[#1F2937] mb-3">{title}</h2>
      <div className="flex-1 w-full bg-[#F3F4F6] rounded-[12px] border border-[#E5E7EB] shadow-sm overflow-hidden flex items-center justify-center p-2">
         {/* Using object-contain so we don't letterbox improperly, but it fills the area */}
         <img 
           src={src} 
           alt={title}
           className="max-w-full max-h-[100%] rounded-[8px] object-contain shadow-[0_2px_8px_rgba(0,0,0,0.08)] bg-white"
           onError={(e) => { e.currentTarget.style.display = 'none'; }}
         />
      </div>
    </div>
  );

  const Footer = ({ page }: { page: number }) => (
    <div className="pt-4 mt-auto border-t border-[#E5E7EB] flex justify-end shrink-0">
      <span className="text-[12px] font-semibold text-muted">{page}/4</span>
    </div>
  );

  // Common wrapper for each page
  const Page = ({ page, children }: { page: number, children: React.ReactNode }) => (
    <div 
      className={`bg-white text-ink flex flex-col mx-auto ${isPreview ? 'w-full shadow-lg border border-line mb-8 overflow-hidden rounded-md' : 'print-page'}`}
      style={{
        width: isPreview ? '100%' : '210mm',
        height: isPreview ? 'auto' : '297mm',
        minHeight: isPreview ? '297mm' : 'auto',
        padding: '20mm',
        pageBreakAfter: 'always',
        boxSizing: 'border-box'
      }}
    >
      <Header />
      {page === 1 && <SubmitterCard />}
      {children}
      <Footer page={page} />
    </div>
  );

  return (
    <div className={`font-sans ${isPreview ? 'w-full' : 'hidden print:block absolute inset-0 z-[9999] bg-white'}`}>
      <style>{!isPreview ? `
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .print-page { 
            width: 210mm !important; 
            height: 297mm !important; 
            padding: 20mm !important; 
            margin: 0 !important; 
            page-break-after: always;
            page-break-inside: avoid;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background-color: white;
          }
        }
      ` : ''}</style>

      {/* PAGE 1 */}
      <Page page={1}>
        <PhotoSection title="Arrival and Start the Job!" src={arrivalPhoto} />
      </Page>

      {/* PAGE 2 */}
      <Page page={2}>
        <PhotoSection title="Proof Of Van Loaded" src={loadedPhoto} />
        <div className="mb-4 border border-[#E5E7EB] rounded-[12px] overflow-hidden shrink-0">
          <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] bg-white">
            <span className="text-[13px] font-medium text-muted">Any Extra Charges</span>
            <span className="text-[13px] font-bold text-ink">{formatPounds(job.totalCharges ? job.totalCharges - (job.totalCharges * 0.8) : 0)}</span>
          </div>
          <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] bg-white">
            <span className="text-[13px] font-medium text-muted">Total Charges</span>
            <span className="text-[13px] font-bold text-ink">{formatPounds(job.totalCharges)}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-white">
            <span className="text-[13px] font-medium text-muted">Type of Payment</span>
            <span className="text-[13px] font-bold text-ink">{job.paymentMethod || "Card"}</span>
          </div>
        </div>
      </Page>

      {/* PAGE 3 */}
      <Page page={3}>
        <PhotoSection title="Empty Van / Unloaded?" src={unloadedPhoto} />
        
        <div className="mb-6 border border-[#E5E7EB] rounded-[12px] overflow-hidden shrink-0">
          <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] bg-white">
            <span className="text-[13px] font-medium text-muted">Client Name</span>
            <span className="text-[13px] font-bold text-ink">{job.clientConfirmedName || job.customerName || "N/A"}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-white">
            <span className="text-[13px] font-medium text-muted">Postcode</span>
            <span className="text-[13px] font-bold text-ink uppercase">{(job.dropoff || "").split(",").pop()?.trim() || "N/A"}</span>
          </div>
        </div>

        <div className="mb-4 shrink-0">
          <h2 className="text-[13px] font-medium text-muted mb-2">Client Signature:</h2>
          <div className="border border-[#E5E7EB] rounded-[12px] p-6 bg-[#F8F9FA] flex flex-col items-center justify-center min-h-[120px]">
            {job.signatureUrl ? (
              <img src={job.signatureUrl} alt="Client Signature" className="max-h-[80px] object-contain mix-blend-multiply" />
            ) : (
              <span className="text-[14px] font-semibold text-muted italic">Signed physically</span>
            )}
            <span className="text-[11px] font-medium text-muted mt-4">Signed: {formattedTime}</span>
          </div>
        </div>
      </Page>

      {/* PAGE 4 */}
      <Page page={4}>
        <PhotoSection title="Is the van organized?" src={organizedPhoto} />
      </Page>

    </div>
  );
}
