import React from "react";
import { formatLondonDateTime } from "../utils/date";

interface Props {
  item: any;
  kind: string;
}

export function PaperScenarioReport({ item, kind }: Props) {
  const raw = item.rawRecord || item;
  
  // Extract common fields
  const clientName = item.clientName || raw["Client Name"] || raw["Client Full Name"] || "N/A";
  const driverInitials = item.driver || raw["Driver"] || "N/A";
  const timestampStr = item.timestamp || raw["Timestamp"] || raw["Date"] || "";
  const formattedTime = formatLondonDateTime(timestampStr);
  const containerNum = item.containerNumber || raw["Container Number"] || "N/A";
  const clientPhone = raw["Client Phone"] || "N/A";
  const clientEmail = raw["Client Email"] || "N/A";
  const clientPresent = raw["Client Present"] || "N/A";
  const address = raw["Address"] || raw["Address as show on the booking ?"] || "N/A";
  const signature = raw["Signature"] || raw["Parking - Liability - Signature:"];
  const photoUrl = item.photoUrl || raw["Photo"] || raw["Evidence that the items have been loaded."] || raw["Parking restrictions photos"];
  
  // Title mapping
  const titleMap: Record<string, string> = {
    checkin: "Storage - Check -in",
    checkout: "Storage - Check -out",
    parking: "Parking Liability - Notice",
    liability: "Liability Report"
  };

  const title = titleMap[kind] || "Report";

  return (
    <div className="paper-sheet p-8 my-2 text-ink max-w-4xl mx-auto border border-line bg-paper shadow-primary rounded-xl">
      {/* Top Header: Title and Logo */}
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <img src="/tmv-new-logo.png" alt="The Man Van" className="w-16 object-contain" />
      </div>

      {/* Driver / Meta Info Block */}
      <div className="bg-surface border border-line rounded-lg p-4 flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
            {driverInitials}
          </div>
          <div>
            <div className="font-medium text-ink">{driverInitials}</div>
            <div className="text-sm text-muted">{formattedTime} | Europe/London</div>
          </div>
        </div>
        <div className="bg-surface-hover px-2.5 py-1 text-sm font-medium text-ink rounded">
          #{item.id || item.jobId?.split("-")[1] || "0"}
        </div>
      </div>

      {/* Main Content Box */}
      <div className="border border-line rounded-lg overflow-hidden bg-paper">
        
        {/* Specific Header Info for Parking */}
        {kind === "parking" && (
          <div className="p-6 text-center border-b border-line">
            <h2 className="text-status-red font-bold underline mb-4 text-lg">Penalty Charge Liability Notice</h2>
            <p className="text-muted text-sm text-left">
              (PCN) In the event a fine is received, You will cover the cost directly, ensuring the company and drivers are not held liable. (Penalty Charge Notice) fines typically start at £60 and can go up to £180, depending on the severity of the offence. If paid within 14 days, most fines are reduced by 50%, making the lowest payable amount £45 and the highest £90.
            </p>
          </div>
        )}

        {/* Photo Section */}
        {photoUrl && (
          <div className="p-6 bg-surface-hover flex justify-center border-b border-line">
            <img 
              src={photoUrl.startsWith('http') ? photoUrl : '/placeholder.png'} 
              alt="Evidence" 
              className="max-h-[400px] object-contain rounded border border-line bg-paper"
            />
          </div>
        )}

        {/* Key-Value Details */}
        <div className="divide-y divide-line text-sm">
          {kind === "checkin" && (
            <div className="p-3 flex items-center gap-2">
              <span className="text-muted">Container Number: :</span>
              <span className="font-medium text-ink">{containerNum}</span>
            </div>
          )}

          {kind === "parking" && (
            <>
              <div className="p-3 flex items-center gap-2">
                <span className="text-muted">Address as show on the booking ?:</span>
                <span className="font-medium text-ink">{address}</span>
              </div>
              <div className="p-3 flex items-center gap-2">
                <span className="text-muted">Full client name as on the booking ?:</span>
                <span className="font-medium text-ink">{clientName}</span>
              </div>
            </>
          )}

          {(kind === "liability" || kind === "checkout") && (
            <>
              <div className="p-3 flex items-center gap-2">
                <span className="text-muted">Cliente Name::</span>
                <span className="font-medium text-ink">{clientName}</span>
              </div>
              <div className="p-3 flex items-center gap-2">
                <span className="text-muted">Client phone: :</span>
                <span className="font-medium text-ink">{clientPhone}</span>
              </div>
              <div className="p-3 flex items-center gap-2">
                <span className="text-muted">Client Email: :</span>
                <span className="font-medium text-ink">{clientEmail}</span>
              </div>
              <div className="p-3 flex items-center gap-2">
                <span className="text-muted">Is the client present ?:</span>
                <span className="font-medium text-ink">{clientPresent}</span>
              </div>
              <div className="p-3">
                <span className="text-muted">DD/MM/YY:</span> <span className="font-medium text-ink">{formattedTime} | Europe/London ( +01:00 )</span>
              </div>
              <div className="p-3">
                <span className="text-muted block mb-2">By signing this document, you confirm that, All items listed have been checked in and stored.:</span>
                {signature ? (
                  <img src={signature} alt="Signature" className="h-20 object-contain mix-blend-multiply" />
                ) : (
                  <div className="h-20 w-48 border border-dashed border-line bg-surface rounded flex items-center justify-center text-muted">No Signature</div>
                )}
              </div>
            </>
          )}

          {kind === "parking" && signature && (
            <div className="p-3 border-t border-line">
              <span className="text-muted block mb-2">Parking - Liability - Signature:</span>
              <img src={signature} alt="Signature" className="h-24 object-contain mix-blend-multiply" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
