import React from "react";
import { formatLondonDateTime } from "../utils/date";
import { AlertTriangle, User, MapPin, FileText, CheckCircle2, Camera } from "lucide-react";

interface Props {
  item: any;
  kind: string;
}

export function PaperScenarioReport({ item, kind }: Props) {
  const raw = item.rawRecord || item;
  
  // Extract common fields
  const clientName = item.clientName || raw["Client Name"] || raw["Client Full Name"] || raw["Full client name as on the booking ?"] || "Not recorded";
  const driverInitials = item.driver || raw["Driver"] || "UN";
  const driverName = raw["Driver Name"] || `${driverInitials} Driver`; // fallback
  const timestampStr = item.timestamp || raw["Timestamp"] || raw["Date"] || "";
  const formattedTime = formatLondonDateTime(timestampStr);
  const containerNum = item.containerNumber || raw["Container Number"] || "—";
  const clientPhone = raw["Client Phone"] || "—";
  const clientEmail = raw["Client Email"] || "—";
  const clientPresent = raw["Client Present"] || "—";
  const address = raw["Address"] || raw["Address as show on the booking ?"] || "Not recorded";
  const signature = raw["Signature"] || raw["Parking - Liability - Signature:"];
  const photoUrl = item.photoUrl || raw["Photo"] || raw["Evidence that the items have been loaded."] || raw["Parking restrictions photos"];
  
  // Title mapping
  const titleMap: Record<string, string> = {
    checkin: "Storage Check-in",
    checkout: "Storage Check-out",
    parking: "Parking Liability Notice",
    liability: "Liability Report"
  };

  const title = titleMap[kind] || "Report";
  const refId = item.id || item.jobId?.split("-")[1] || Math.floor(Math.random()*10000);

  return (
    <div className="paper-sheet p-8 font-sans" style={{ backgroundColor: "#FFFFFF" }}>
      
      {/* NO-PRINT CONTROLS */}
      <div className="no-print flex items-center justify-between mb-6 pb-6 border-b border-line">
        <div className="text-[14px] font-semibold text-ink">Preview Document</div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:bg-surface text-[13px] font-medium text-ink transition">
            Print / Save PDF
          </button>
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
            <h1 className="text-[18px] font-bold text-ink">{title}</h1>
            <span className="px-2.5 py-1 rounded-full bg-surface text-ink-2 text-[12px] font-mono font-semibold border border-line">
              #{refId}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 text-[13px] text-muted">
            <div className="w-5 h-5 rounded-full bg-brand-soft text-brand flex items-center justify-center text-[10px] font-bold font-mono">
              {driverInitials}
            </div>
            <span>{driverName}</span>
            <span>&bull;</span>
            <span>{formattedTime} (London)</span>
          </div>
        </div>
      </div>

      {/* LIABILITY BLOCK (Parking only) */}
      {kind === "parking" && (
        <div className="p-4 rounded-[16px] bg-[#FFFBEB] border border-[#FDE68A] mb-8" style={{ pageBreakInside: 'avoid' }}>
          <h2 className="text-[14px] font-bold text-status-amber flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> Penalty Charge Liability Notice
          </h2>
          <p className="text-[12px] text-amber-900 leading-relaxed">
            In the event a fine is received, You will cover the cost directly, ensuring the company and drivers are not held liable. (Penalty Charge Notice) fines typically start at £60 and can go up to £180, depending on the severity of the offence. If paid within 14 days, most fines are reduced by 50%, making the lowest payable amount £45 and the highest £90.
          </p>
        </div>
      )}

      {/* DETAILS CARD */}
      <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line mb-8" style={{ pageBreakInside: 'avoid' }}>
        <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
          <User className="w-4 h-4" /> Client & Request Details
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-[11px] text-muted mb-0.5">Client Name</div>
              <div className="text-[14px] font-bold text-ink">{clientName}</div>
            </div>
            {kind !== "parking" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] text-muted mb-0.5">Phone</div>
                    <div className="text-[12px] font-mono text-ink-2">{clientPhone}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted mb-0.5">Client Present?</div>
                    <div className="text-[12px] text-ink-2">{clientPresent}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted mb-0.5">Email</div>
                  <div className="text-[12px] text-ink-2">{clientEmail}</div>
                </div>
              </>
            )}
          </div>
          
          <div className="space-y-4">
            {kind === "checkin" && (
              <div>
                <div className="text-[11px] text-muted mb-0.5">Container Number</div>
                <div className="text-[14px] font-bold text-brand font-mono">{containerNum}</div>
              </div>
            )}
            {kind === "parking" && (
              <div>
                <div className="text-[11px] text-muted mb-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address on Booking
                </div>
                <div className="text-[13px] font-medium text-ink leading-snug">{address}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EVIDENCE PHOTOS */}
      {photoUrl && (
        <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line mb-8" style={{ pageBreakInside: 'avoid' }}>
          <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Evidence Photograph
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col border border-line bg-white p-3 rounded-[12px]">
              <div className="text-[12px] font-medium text-ink mb-2 text-center">Submitted Image</div>
              <div className="w-full bg-surface rounded-lg overflow-hidden flex items-center justify-center flex-1 min-h-[140px]">
                {photoUrl ? (
                  <img src={photoUrl.startsWith('http') ? photoUrl : '/placeholder.png'} alt="Evidence" className="max-w-full max-h-[220px] object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted opacity-50">
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">No Image</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIGNATURE */}
      <div className="p-4 rounded-[16px] bg-[#F7F7F7] border border-line mb-8" style={{ pageBreakInside: 'avoid' }}>
        <h3 className="text-[13px] font-semibold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Client Sign-Off
        </h3>
        
        {kind !== "parking" && (
          <p className="text-[12px] text-muted mb-3 italic">
            By signing this document, you confirm that all items listed have been checked in and stored.
          </p>
        )}

        <div className="text-[12px] text-muted mb-3">
          Confirmed by <span className="font-bold text-ink">{clientName}</span>
        </div>
        
        <div className="w-full sm:w-1/2 h-[120px] bg-white border border-line rounded-lg flex items-center justify-center p-2 mb-2">
          {signature ? (
            <img src={signature} alt="Signature" className="max-w-full max-h-full object-contain mix-blend-multiply" />
          ) : (
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider opacity-50">No Signature Recorded</div>
          )}
        </div>
        
        <div className="text-[11px] text-muted">
          Signed: {formattedTime}
        </div>
      </div>

    </div>
  );
}
