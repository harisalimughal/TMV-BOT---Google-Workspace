import React from "react";
import { Download, X } from "lucide-react";
import { formatLondonDateTime } from "../utils/date";
import { ThumbnailPreview } from "./ThumbnailPreview";

interface Props {
  item: any;
  kind: string;
  onClose: () => void;
  onDownload: () => void;
}

export function FormPreviewModal({ item, kind, onClose, onDownload }: Props) {
  const raw = item.rawRecord || item;

  // Driver Mapping exactly as requested
  const mapDriver = (nameStr: string) => {
    if (!nameStr) return { name: "Unknown", initials: "UN" };
    const n = nameStr.toLowerCase();
    if (n.includes("caio")) return { name: "Caio Gabriel", initials: "KA" };
    if (n.includes("henrique")) return { name: "Henrique Driver", initials: "HE" };
    if (n.includes("maico") || n.includes("lima")) return { name: "Maico Lima", initials: "MK" };
    if (n.includes("rafael") || n.includes("cruz")) return { name: "Rafael Cruz", initials: "RF" };
    if (n.includes("tiago")) return { name: "Tiago Menagassi", initials: "TI" };
    if (n.includes("wander") || n.includes("mendes")) return { name: "Wander Mendes", initials: "WD" };
    return { name: nameStr, initials: nameStr.substring(0, 2).toUpperCase() };
  };

  const rawDriverStr = item.driver || raw["Driver"] || "N/A";
  const driverInfo = mapDriver(rawDriverStr);
  const formattedTime = formatLondonDateTime(item.timestamp || raw["Timestamp"] || raw["Date"] || "");
  const submissionId = item.id || item.jobId?.split("-")[1] || "0";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface overflow-hidden print:hidden">
      {/* Top Bar with absolute Close button like the screenshot */}
      <div className="relative h-16 bg-surface border-b border-line flex items-center justify-between px-6 shrink-0 shadow-sm">
        
        {/* Absolute Centered Close Button */}
        <div className="absolute inset-x-0 top-0 flex justify-center">
          <button 
            onClick={onClose}
            className="bg-muted text-white px-6 py-1 rounded-b-xl text-[11px] font-semibold hover:bg-ink-2 transition shadow-md"
          >
            Close
          </button>
        </div>

        {/* User Info (Left) */}
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-full bg-brand-dark text-white flex items-center justify-center font-mono font-bold text-sm shadow-sm">
            {driverInfo.initials}
          </div>
          <div>
            <div className="font-bold text-ink text-[14px]">{driverInfo.name}</div>
            <div className="text-[12px] text-muted">{formattedTime}, Submission ID: {submissionId}</div>
          </div>
        </div>

        {/* Action (Right) */}
        <div className="mt-2">
          <button 
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 bg-paper border border-line rounded-lg text-[13px] font-semibold text-brand hover:bg-brand-soft transition shadow-sm"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex bg-surface">
        
        {/* LEFT SIDEBAR: Manager Fields */}
        <div className="w-80 border-r border-line bg-surface p-6 overflow-y-auto shrink-0 hidden md:block">
          <h3 className="text-[14px] font-bold text-ink mb-6">Manager fields</h3>
          
          <div className="bg-paper p-4 rounded-xl border border-line shadow-sm mb-6">
            <h4 className="text-[12px] font-semibold text-ink flex items-center gap-2 mb-3">
              Comments <span className="w-4 h-4 rounded bg-surface flex items-center justify-center text-[10px] text-muted">👁</span>
            </h4>
            <textarea 
              className="w-full h-24 bg-surface border border-line rounded-lg p-3 text-[13px] text-ink placeholder:text-muted resize-none focus:border-brand outline-none transition"
              placeholder="Type here..."
            />
            <div className="flex justify-end mt-3">
              <button className="bg-brand hover:bg-brand-dark text-white px-4 py-1.5 rounded-full text-[13px] font-semibold transition shadow-sm">
                Save
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-paper p-4 rounded-xl border border-line shadow-sm">
            <h4 className="text-[12px] font-semibold text-ink flex items-center gap-2">
              Loading note ! <span className="w-4 h-4 rounded bg-surface flex items-center justify-center text-[10px] text-muted">👁</span>
            </h4>
            <select className="bg-surface border border-line rounded-md px-2 py-1 text-[12px] text-ink outline-none">
              <option>Select</option>
            </select>
          </div>
        </div>

        {/* CENTER: Form Answers */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 flex justify-center">
          <div className="w-full max-w-2xl space-y-4">
            
            {/* Arrival and Start */}
            <div className="bg-paper p-6 rounded-xl border border-line shadow-sm">
              <h4 className="text-[13px] font-semibold text-brand-dark mb-1">Arrival and Start the Job ! <span className="text-status-red">*</span></h4>
              <p className="text-[12px] text-muted mb-4">Pictures taken as proof.</p>
              {item.photos && item.photos.length > 0 ? (
                <div className="flex gap-2">
                  <img src={item.photos[0]?.thumbUrl} className="h-24 rounded border border-line object-cover" alt="Proof" />
                </div>
              ) : (
                <div className="text-[12px] text-muted italic">No pictures provided</div>
              )}
            </div>

            {/* Any Extra charges */}
            <div className="bg-paper p-6 rounded-xl border border-line shadow-sm">
              <h4 className="text-[13px] font-semibold text-brand-dark mb-1">Any Extra charges <span className="text-status-red">*</span></h4>
              <p className="text-[12px] text-muted mb-4">What extra charges if any ?</p>
              
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-[13px] text-muted">
                  <input type="radio" name="charges" className="w-4 h-4 text-brand bg-surface border-line" disabled />
                  London Congestion charge £18
                </label>
                <label className="flex items-center gap-3 text-[13px] text-muted">
                  <input type="radio" name="charges" className="w-4 h-4 text-brand bg-surface border-line" disabled />
                  Tunnel Charges £13
                </label>
                <label className="flex items-center gap-3 text-[13px] text-ink font-medium">
                  <input type="radio" name="charges" defaultChecked className="w-4 h-4 text-brand bg-surface border-line" />
                  Extra time / Charges
                </label>
                <label className="flex items-center gap-3 text-[13px] text-ink font-medium">
                  <input type="radio" name="charges" defaultChecked className="w-4 h-4 text-brand bg-surface border-line" />
                  No Extras Time
                </label>
              </div>
            </div>

            {/* Over Time Charges */}
            <div className="bg-paper p-6 rounded-xl border border-line shadow-sm">
              <h4 className="text-[13px] font-semibold text-brand-dark mb-1">Over Time Charges ? <span className="text-status-red">*</span></h4>
              <p className="text-[12px] text-muted mb-4">Extra time charges ?</p>
              <div className="text-[13px] text-ink font-medium">30min</div>
            </div>

            {/* Total Charges */}
            <div className="bg-paper p-6 rounded-xl border border-line shadow-sm">
              <h4 className="text-[13px] font-semibold text-brand-dark mb-1">Total Charges ? <span className="text-status-red">*</span></h4>
              <p className="text-[12px] text-muted mb-4">Total / Tunnel / CCL / Over time ?</p>
              <div className="text-[13px] text-ink font-medium">45</div>
            </div>

          </div>
        </div>

        {/* RIGHT SIDEBAR: Activity */}
        <div className="w-80 border-l border-line bg-paper p-0 overflow-y-auto shrink-0 hidden lg:block shadow-sm z-10">
          <div className="flex border-b border-line">
            <button className="flex-1 py-3 text-[13px] font-bold text-brand border-b-2 border-brand">Activity</button>
            <button className="flex-1 py-3 text-[13px] font-semibold text-muted hover:text-ink transition">Comments</button>
          </div>
          
          <div className="p-6">
            <div className="bg-surface inline-block px-2 py-1 rounded text-[11px] font-semibold text-muted mb-6">
              Mon 27/7
            </div>
            
            <div className="flex gap-3 relative">
              <div className="absolute top-8 left-3.5 bottom-0 w-[2px] bg-line"></div>
              <div className="w-7 h-7 rounded-full bg-brand-dark text-white flex items-center justify-center font-mono font-bold text-[10px] z-10 shadow-sm shrink-0">
                {driverInfo.initials}
              </div>
              <div className="text-[12px] text-ink leading-relaxed">
                <span className="font-bold">{driverInfo.name}</span> submitted the form
                <div className="text-muted mt-1">on 27/7 at 15:34</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
