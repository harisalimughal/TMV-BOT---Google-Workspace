import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  FileText,
  Search,
  MoreHorizontal,
  Camera,
  ChevronRight,
  Download
} from "lucide-react";
import { FolderActionDropdown } from "../components/FolderActionDropdown";
import { PdfPreviewModal } from "../components/PdfPreviewModal";
import { PaperDossierReport } from "../components/PaperDossierReport";
import { NormalizedJob } from "../types";
import { fetchScenarios } from "../api/client";
import { PaperScenarioReport } from "../components/PaperScenarioReport";
import { formatLondonDateTime } from "../utils/date";
import { DateRangePicker } from "../components/DateRangePicker";
import { LiabilityConfigModal } from "../components/LiabilityConfigModal";
import { LiabilityMobileForm } from "../components/LiabilityMobileForm";
import { Settings2, Smartphone } from "lucide-react";

interface Props {
  kind: "checkin" | "checkout" | "parking" | "liability";
}

const mapDriver = (raw: string) => {
  if (!raw || raw === "N/A" || raw === "undefined") return { name: "Unassigned", initials: "UN" };
  const d = raw.toLowerCase();
  if (d.includes("roman") || d === "mr") return { name: "Muhammad Roman", initials: "MR" };
  if (d.includes("caio") || d === "ka") return { name: "Caio Gabriel", initials: "KA" };
  if (d.includes("henrique") || d === "he") return { name: "Henrique Driver", initials: "HE" };
  if (d.includes("maico") || d === "mk") return { name: "Maico Lima", initials: "MK" };
  if (d.includes("rafael") || d.includes("cruz") || d === "rf") return { name: "Rafael Cruz", initials: "RF" };
  if (d.includes("tiago") || d === "ti") return { name: "Tiago Menagassi", initials: "TI" };
  if (d.includes("wander") || d.includes("mendes") || d === "wd") return { name: "Wander Mendes", initials: "WD" };
  if (d.includes("harris") || d === "ha") return { name: "Harris", initials: "HA" };
  return { name: raw, initials: raw.substring(0, 2).toUpperCase() };
};

const getAvatarColor = (initials: string) => {
  if (initials === "UN") return "bg-surface border border-line text-muted";
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-purple-100 text-purple-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
    "bg-indigo-100 text-indigo-700",
    "bg-cyan-100 text-cyan-700",
    "bg-teal-100 text-teal-700",
  ];
  const charCode = initials.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
};

const titleCase = (str: string) => {
  if (!str) return "—";
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const isTestGibberish = (text: string) => {
  if (!text || text === "—") return false;
  const lower = text.toLowerCase();
  if (lower.length < 5) return true;
  if (/^[a-z,.]+$/.test(lower) && !lower.includes(" ")) return true;
  if (lower.includes("test")) return true;
  return false;
};

export function ScenariosPage({ kind }: Props) {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<NormalizedJob | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scenarios", kind, page, from, to],
    queryFn: () => fetchScenarios(kind, page),
    retry: 1
  });

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [kind]);

  const config = {
    checkin: { title: "Check In", refLabel: "Container No." },
    checkout: { title: "Check Out", refLabel: "Container No." },
    parking: { title: "Parking Liability", refLabel: "Address" },
    liability: { title: "Liability Report", refLabel: "Damage Report #" }
  }[kind];

  const filteredItems = (data?.items || []).filter((item: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const raw = item.rawRecord || item;
    const clientName = (item.clientName || raw["Client Name"] || raw["Client Full Name"] || "").toLowerCase();
    const driver = (item.driver || raw["Driver"] || "").toLowerCase();
    const jobId = (item.jobId || raw["Job ID"] || "").toLowerCase();
    const ref = (item.containerNumber || raw["Container Number"] || item.damageCategories || item.address || raw["Address"] || "").toLowerCase();
    return clientName.includes(q) || driver.includes(q) || ref.includes(q) || jobId.includes(q);
  });

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between px-2">
        <h1 className="text-[20px] font-bold text-ink">{config.title}</h1>
        <div className="flex items-center gap-3">
          {kind === "liability" && (
            <>
              <button onClick={() => setIsConfigOpen(true)} className="h-10 px-4 rounded-[12px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium shadow-sm transition flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-brand" /> Manage Categories
              </button>
              <button onClick={() => setIsMobileOpen(true)} className="h-10 px-4 rounded-[12px] bg-[#2563EB] hover:bg-blue-700 text-white text-[13px] font-medium shadow-sm transition flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Preview Mobile Form
              </button>
              <div className="w-[1px] h-6 bg-line mx-1" />
            </>
          )}
          <button className="h-10 px-4 rounded-[12px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium shadow-sm transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button className="h-10 px-4 rounded-[12px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium shadow-sm transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="p-2 bg-white rounded-[16px] shadow-sm border border-line flex flex-wrap items-center gap-4">
        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition ${
              viewMode === "table" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <TableIcon className="w-4 h-4" /> Table
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition ${
              viewMode === "cards" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Cards
          </button>
        </div>
        
        <div className="w-[1px] h-6 bg-line mx-2" />
        
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input 
            type="text" 
            placeholder="Search reference, job, or user..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-full border border-line bg-surface text-[13px] outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white transition"
          />
        </div>

        <div className="w-[1px] h-6 bg-line mx-2" />

        {/* Date Ranges */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl">
          {["All Time", "Today", "7 Days", "30 Days"].map((l) => (
            <button key={l} className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-muted hover:text-ink hover:bg-white/50 transition">
              {l}
            </button>
          ))}
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />

        <div className="w-[1px] h-6 bg-line mx-2" />
        
        <span className="text-[13px] text-muted font-medium pr-2">
          {isLoading ? "..." : `${filteredItems.length} submission${filteredItems.length === 1 ? "" : "s"}`}
        </span>

        <button 
          onClick={() => refetch()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface text-muted hover:text-ink transition"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading && (
        <div className="h-64 bg-white rounded-[24px] border border-line animate-pulse flex items-center justify-center">
          <span className="text-muted font-medium">Loading {config.title.toLowerCase()} records...</span>
        </div>
      )}

      {isError && (
        <div className="p-8 text-center text-status-red bg-status-red-bg rounded-[24px] border border-status-red/20 shadow-sm">
          Failed to load {config.title.toLowerCase()} records.
        </div>
      )}

      {/* TABLE VIEW */}
      {!isLoading && !isError && viewMode === "table" && (
        <div className="bg-white rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-line flex flex-col overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[14px] border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-line bg-white">
                  <th className="py-5 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em] pl-6">Timestamp</th>
                  <th className="py-5 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Job ID</th>
                  <th className="py-5 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Driver</th>
                  <th className="py-5 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]" title={config.refLabel}>{config.refLabel}</th>
                  <th className="py-5 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Client Name</th>
                  <th className="py-5 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Pictures</th>
                  <th className="py-5 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Sign here.</th>
                  <th className="py-5 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em] text-center">Docs</th>
                  <th className="py-5 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredItems.map((item: any) => {
                  const isExpanded = expandedId === item.id;
                  const raw = item.rawRecord || item;
                  
                  // Driver mapping
                  const rawDriverStr = item.driver || raw["Driver"] || "N/A";
                  const { name: driverName, initials: driverInitials } = mapDriver(rawDriverStr);
                  
                  // Job ID mapping
                  const jobId = item.jobId || raw["Job ID"] || "—";

                  // Timestamp formatting
                  const timestampStr = item.timestamp || raw["Timestamp"] || raw["Date"] || "";
                  const formattedTime = formatLondonDateTime(timestampStr);
                  
                  // Client Name capitalization
                  const rawClient = item.clientName || raw["Client Name"] || raw["Client Full Name"] || "—";
                  const formattedClientName = rawClient !== "—" ? titleCase(rawClient) : "—";
                  
                  // Reference (Address, Damage, Container)
                  let refText = "—";
                  if (kind === "checkin" || kind === "checkout") refText = item.containerNumber || raw["Container Number"] || "—";
                  if (kind === "parking") refText = item.address || raw["Address"] || "—";
                  if (kind === "liability") refText = item.damageCategories || "—";
                  
                  const isTestRef = isTestGibberish(refText);

                  // Extract Media
                  const photos = item.photos?.filter((p: any) => p.thumbUrl || p.fileUrl || p.driveUrl) || [];
                  const sigUrl = item.signature?.url || item.signatureUrl || raw["Signature Url"];

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className={`h-[60px] group cursor-pointer transition select-none ${isExpanded ? "bg-surface/50" : "hover:bg-[#F9FAFB]"}`}
                      >
                        <td className="px-6 text-[13px] text-muted tabular-nums">
                          {formattedTime}
                        </td>

                        <td className="px-4">
                          {jobId !== "—" ? (
                            <button className="font-medium text-[#2563EB] hover:underline text-[14px]" onClick={(e) => { e.stopPropagation(); }}>
                              {jobId}
                            </button>
                          ) : (
                            <span className="text-muted italic text-[13px]">Not recorded</span>
                          )}
                        </td>
                        
                        <td className="px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${getAvatarColor(driverInitials)}`}>
                              {driverInitials}
                            </div>
                            <span className="font-medium text-ink text-[13px]">{driverName}</span>
                          </div>
                        </td>

                        <td className="px-4 text-[14px]">
                          {refText === "—" ? (
                            <span className="text-muted italic text-[13px]">Not recorded</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              {kind === "liability" ? (
                                <div className="flex flex-wrap items-center gap-1.5 max-w-[280px]">
                                  {refText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3).map((cat, i) => (
                                    <span key={i} className="px-2 py-1 rounded-md bg-surface border border-line text-ink text-[11px] font-medium whitespace-nowrap truncate max-w-[120px]" title={cat}>
                                      {cat}
                                    </span>
                                  ))}
                                  {refText.split(",").filter(Boolean).length > 3 && (
                                    <span className="px-2 py-1 rounded-md bg-white border border-line text-muted text-[11px] font-medium whitespace-nowrap shadow-sm cursor-help" title={refText}>
                                      +{refText.split(",").filter(Boolean).length - 3} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <span className={`truncate max-w-[150px] ${isTestRef ? 'text-muted' : 'text-ink font-mono tabular-nums'}`} title={refText}>
                                    {refText}
                                  </span>
                                  {isTestRef && (
                                    <span className="px-1.5 py-0.5 rounded-[4px] bg-surface border border-line text-muted text-[10px] font-semibold uppercase tracking-wider" title="Test Record">
                                      Unverified / Test Data
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 text-[13px] text-ink font-medium">
                          {formattedClientName}
                        </td>

                        <td className="px-4">
                          <div className="flex items-center">
                            {photos.length > 0 ? (
                              <div className="flex items-center">
                                {photos.slice(0, 3).map((p: any, i: number) => (
                                  <div key={i} className={`w-8 h-8 rounded-[8px] overflow-hidden border border-line bg-surface ${i > 0 ? "-ml-3 shadow-sm" : ""}`}>
                                    <img src={p.thumbUrl || p.fileUrl || p.driveUrl} alt="Evidence" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                                {photos.length > 3 && (
                                  <div className="w-8 h-8 rounded-[8px] border border-line bg-white flex items-center justify-center text-[11px] font-medium text-muted -ml-3 z-10 shadow-sm">
                                    +{photos.length - 3}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Camera className="w-4 h-4 text-muted mx-4 opacity-40" />
                            )}
                          </div>
                        </td>

                        <td className="px-4">
                          {sigUrl ? (
                            <img
                              src={sigUrl}
                              alt="Signature"
                              className="w-14 h-7 object-contain mx-4 border border-line bg-white rounded-[4px] p-0.5 shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-7 rounded-[4px] border border-dashed border-line-strong mx-4 opacity-50" />
                          )}
                        </td>

                        <td className="px-4 pr-6 text-right relative">
                           {/* Hover Action Cluster */}
                           <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 justify-end">
                             <button className="p-1.5 rounded-[6px] text-muted hover:text-brand hover:bg-brand-soft transition" title="View Report" onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : item.id); }}>
                               <FileText className="w-4 h-4" />
                             </button>
                             <button className="p-1.5 rounded-[6px] text-muted hover:text-ink hover:bg-surface transition" title="More Actions">
                               <MoreHorizontal className="w-4 h-4" />
                             </button>
                           </div>
                           
                           {/* Static Arrow when not hovering */}
                           <div className="opacity-100 group-hover:opacity-0 absolute right-6 top-1/2 -translate-y-1/2">
                             <ChevronRight className="w-4 h-4 text-muted/50" />
                           </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0 border-b border-line bg-[#FAFAFA]">
                            <div className="p-6 overflow-hidden">
                              <PaperScenarioReport item={item} kind={kind} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer Row */}
          {data?.pagination && (
            <div className="px-6 py-4 border-t border-line bg-white flex items-center justify-between">
              <span className="text-[13px] text-muted">
                Showing {(page - 1) * 25 + 1}-{Math.min(page * 25, data.pagination.total)} of {data.pagination.total} {data.pagination.total === 1 ? "record" : "records"}
              </span>
              <div className="flex items-center gap-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)} 
                  className="px-3 py-1.5 rounded-[8px] border border-line bg-white text-[13px] font-medium text-ink hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Prev
                </button>
                <div className="text-[13px] font-medium text-muted mx-2">{page} / {data.pagination.totalPages || 1}</div>
                <button 
                  disabled={page >= (data.pagination.totalPages || 1)} 
                  onClick={() => setPage(p => p + 1)} 
                  className="px-3 py-1.5 rounded-[8px] border border-line bg-white text-[13px] font-medium text-ink hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !isError && viewMode === "cards" && (
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           <div className="bg-white p-6 rounded-[20px] shadow-sm border border-line">
             <p className="text-muted text-[13px]">Card view available on mobile devices.</p>
           </div>
         </div>
      )}

          {kind === "liability" && <LiabilityConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />}
      {kind === "liability" && <LiabilityMobileForm isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />}
    </div>
  );
}
