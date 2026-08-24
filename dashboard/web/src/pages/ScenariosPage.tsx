import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  FileText,
  AlertCircle,
  Search,
  MoreHorizontal,
  ChevronDown,
  Camera,
  ChevronRight,
  ChevronLeft,
  ArrowRight
} from "lucide-react";
import { fetchScenarios } from "../api/client";
import { ScenarioItem } from "../types";
import { PaperScenarioReport } from "../components/PaperScenarioReport";
import { ThumbnailPreview } from "../components/ThumbnailPreview";
import { PhotoModal } from "../components/PhotoModal";
import { formatLondonDateTime } from "../utils/date";
import { DateRangePicker } from "../components/DateRangePicker";

interface Props {
  kind: "checkin" | "checkout" | "parking" | "liability";
}

const mapDriver = (raw: string) => {
  if (!raw || raw === "N/A" || raw === "undefined") return { name: "Unassigned", initials: "UN" };
  const d = raw.toLowerCase();
  if (d.includes("roman")) return { name: "Muhammad Roman", initials: "MR" };
  if (d.includes("caio")) return { name: "Caio Gabriel", initials: "KA" };
  if (d.includes("henrique")) return { name: "Henrique Driver", initials: "HE" };
  if (d.includes("maico")) return { name: "Maico Lima", initials: "MK" };
  if (d.includes("rafael") || d.includes("cruz")) return { name: "Rafael Cruz", initials: "RF" };
  if (d.includes("tiago")) return { name: "Tiago Menagassi", initials: "TI" };
  if (d.includes("wander") || d.includes("mendes")) return { name: "Wander Mendes", initials: "WD" };
  if (d.includes("harris") || d.includes("ha")) return { name: "Harris", initials: "HA" };
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

export function ScenariosPage({ kind }: Props) {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scenarios", kind, page, from, to],
    queryFn: () => fetchScenarios(kind, page),
    retry: 1
  });

  // Reset page when kind changes
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
    const ref = (item.containerNumber || raw["Container Number"] || item.damageCategories || item.address || raw["Address"] || "").toLowerCase();
    return clientName.includes(q) || driver.includes(q) || ref.includes(q);
  });

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between px-2">
        <h1 className="text-[20px] font-bold text-ink">{config.title}</h1>
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
            placeholder="Search user or reference..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-[8px] border border-line bg-white text-[13px] outline-none focus:border-brand focus:ring-1 focus:ring-brand transition"
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
          {isLoading ? "..." : `${filteredItems.length} submissions`}
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
                  <th className="py-5 px-4 w-12 text-center font-normal">
                    <input type="checkbox" className="rounded text-brand border-line-strong" />
                  </th>
                  <th className="py-5 px-4 w-12 text-left font-semibold text-[12px] text-muted uppercase tracking-wider">#</th>
                  <th className="py-5 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">User</th>
                  <th className="py-5 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Date Submitted</th>
                  <th className="py-5 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider" title={config.refLabel}>{config.refLabel}</th>
                  <th className="py-5 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Pictures</th>
                  <th className="py-5 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Sign here.</th>
                  <th className="py-5 px-4 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredItems.map((item: any, index: number) => {
                  const isExpanded = expandedId === item.id;
                  const raw = item.rawRecord || item;
                  const rawDriverStr = item.driver || raw["Driver"] || "N/A";
                  const { name: driverName, initials: driverInitials } = mapDriver(rawDriverStr);
                  
                  const timestampStr = item.timestamp || raw["Timestamp"] || raw["Date"] || "";
                  const formattedTime = formatLondonDateTime(timestampStr);
                  const rowNumber = (page - 1) * 25 + index + 1;
                  
                  // Ref logic
                  let refText = "—";
                  if (kind === "checkin" || kind === "checkout") refText = item.containerNumber || raw["Container Number"] || "—";
                  if (kind === "parking") refText = item.address || raw["Address"] || "—";
                  if (kind === "liability") refText = item.damageCategories || "—";

                  // Extract Photos reliably (avoid broken image states)
                  const photos = item.photos?.filter((p: any) => p.thumbUrl || p.fileUrl || p.driveUrl) || [];
                  const sigUrl = item.signature?.url || item.signatureUrl || raw["Signature Url"];

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className={`h-[60px] group cursor-pointer transition select-none ${isExpanded ? "bg-surface/50" : "hover:bg-[#F9FAFB]"}`}
                      >
                        <td className="px-4 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded text-brand border-line-strong" />
                        </td>
                        <td className="px-4 text-[13px] text-muted font-mono">{rowNumber}</td>
                        
                        <td className="px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center font-bold text-[11px] ${getAvatarColor(driverInitials)}`}>
                              {driverInitials}
                            </div>
                            <span className="font-medium text-ink text-[14px]">{driverName}</span>
                          </div>
                        </td>

                        <td className="px-4 text-[13px] text-muted tabular-nums">
                          {formattedTime}
                        </td>

                        <td className="px-4 text-[14px] text-ink">
                          <div className="inline-flex items-center gap-2 h-8 px-3 bg-surface border border-transparent rounded-[8px] font-mono tabular-nums">
                            <span className="truncate max-w-[150px]">{refText}</span>
                          </div>
                        </td>

                        <td className="px-4">
                          <div className="flex items-center">
                            {photos.length > 0 ? (
                              <div className="flex items-center">
                                {photos.slice(0, 3).map((p: any, i: number) => (
                                  <div key={i} className={`w-8 h-8 rounded-[8px] overflow-hidden border-2 border-white bg-surface ${i > 0 ? "-ml-3" : ""}`}>
                                    <img src={p.thumbUrl || p.fileUrl || p.driveUrl} alt="Evidence" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                                {photos.length > 3 && (
                                  <div className="w-8 h-8 rounded-[8px] border-2 border-white bg-surface flex items-center justify-center text-[11px] font-medium text-muted -ml-3 z-10">
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
                              className="w-14 h-7 object-contain mx-4 border border-line bg-white rounded-[4px] p-0.5"
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
                Showing {(page - 1) * 25 + 1}-{Math.min(page * 25, data.pagination.total)} of {data.pagination.total} records
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

    </div>
  );
}
