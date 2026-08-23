import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LogIn,
  LogOut,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Table as TableIcon,
  LayoutGrid,
  FileText,
  MoreHorizontal,
  RefreshCw
} from "lucide-react";
import { fetchScenarios } from "../api/client";
import { ScenarioItem } from "../types";
import { ThumbnailPreview } from "../components/ThumbnailPreview";
import { PhotoModal } from "../components/PhotoModal";
import { PaperScenarioReport } from "../components/PaperScenarioReport";
import { FormPreviewModal } from "../components/FormPreviewModal";
import { formatLondonDateTime } from "../utils/date";

interface Props {
  kind: "checkin" | "checkout" | "parking" | "liability";
}

const KIND_CONFIG: Record<string, { title: string; desc: string; icon: any; emptyHint: string }> = {
  checkin: {
    title: "Check In",
    desc: "Storage facility entry logs and client container check-ins",
    icon: LogIn,
    emptyHint: "No check-ins recorded. Records appear here when a driver completes the Check In flow."
  },
  checkout: {
    title: "Check Out",
    desc: "Storage retrieval and client drop-off confirmation records",
    icon: LogOut,
    emptyHint: "No check-outs recorded. Records appear here when a driver completes the Check Out flow."
  },
  parking: {
    title: "Parking Liability",
    desc: "Driver parking risk waivers and client location sign-offs",
    icon: AlertCircle,
    emptyHint: "No parking waivers recorded. Records appear here when a driver completes the Parking Liability flow."
  },
  liability: {
    title: "Liability Report",
    desc: "Vehicle or item damage categories with evidence photographs",
    icon: ShieldAlert,
    emptyHint: "No damage reports recorded. Records appear here when a driver submits a Liability Report."
  }
};

export function ScenariosPage({ kind }: Props) {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [activePhoto, setActivePhoto] = useState<{ title: string; url: string; driveUrl?: string } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scenario", kind, page],
    queryFn: () => fetchScenarios(kind, page),
    retry: 1
  });

  const config = KIND_CONFIG[kind] || KIND_CONFIG.checkin;
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

  return (
    <div className="space-y-4 max-w-full">
      {/* Toolbar Row */}
      <div className="bg-paper p-3 rounded border border-line flex flex-wrap items-center justify-between gap-3 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center p-0.5 bg-surface rounded border border-line text-xs">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                viewMode === "table" ? "bg-paper text-ink shadow-card font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                viewMode === "cards" ? "bg-paper text-ink shadow-card font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>

          <span className="text-xs text-muted font-mono">
            {isLoading ? "Loading..." : `${data?.pagination?.total || 0} submissions`}
          </span>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-line bg-surface hover:bg-surface-2 text-xs font-medium text-ink transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-brand ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* STATE MACHINE: Loading / Error / Empty / Table */}
      {isLoading && (
        <div className="bg-paper rounded border border-line-strong shadow-card overflow-hidden">
          <div className="p-4 bg-surface border-b border-line text-xs text-muted">
            Loading {config.title} records...
          </div>
          <div className="divide-y divide-line">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[52px] px-4 flex items-center gap-6 animate-pulse">
                <div className="w-4 h-4 bg-surface rounded" />
                <div className="w-24 h-4 bg-surface rounded" />
                <div className="w-36 h-6 bg-surface rounded" />
                <div className="w-24 h-4 bg-surface rounded" />
                <div className="w-20 h-7 bg-surface rounded" />
                <div className="w-16 h-4 bg-surface rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && isError && (
        <div className="p-8 bg-paper border border-line rounded text-center space-y-3 shadow-card">
          <AlertCircle className="w-6 h-6 text-status-red mx-auto" />
          <h3 className="text-btn text-ink">Failed to load {config.title} records</h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            {error instanceof Error ? error.message : "The operations server encountered an error retrieving this tab."}
          </p>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 rounded bg-brand text-white text-xs font-medium hover:bg-brand-dark transition"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="p-12 text-center bg-paper rounded border border-line space-y-2 shadow-card">
          <div className="w-10 h-10 rounded-pill bg-surface flex items-center justify-center mx-auto text-muted mb-2">
            <FileText className="w-5 h-5 opacity-60" />
          </div>
          <h3 className="text-btn text-ink">No {config.title} records</h3>
          <p className="text-xs text-muted max-w-md mx-auto">{config.emptyHint}</p>
        </div>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && viewMode === "table" && (
        <div className="bg-paper rounded border border-line-strong shadow-card overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-230px)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface border-b border-line text-[11px] font-semibold text-muted sticky top-0 z-20">
  <tr className="h-10">
    <th className="py-2 px-4 w-10 text-center font-normal"><input type="checkbox" className="rounded border-line-strong text-brand" /></th>
    <th className="py-2 px-2 w-12 text-left font-normal">#</th>
    <th className="py-2 px-4 w-64 text-left font-normal border-r border-transparent">User</th>
    <th className="py-2 px-3 w-10 text-center border-r border-line-strong">...</th>
    <th className="py-2 px-3 w-12 text-center border-r border-line-strong"><FileText className="w-4 h-4 text-muted mx-auto" /></th>
    <th className="py-2 px-4 text-left font-normal">Date submitted</th>
    <th className="py-2 px-4 text-left font-normal truncate">Damage Liability & Ass...</th>
    <th className="py-2 px-4 text-left font-normal">Pictures</th>
    <th className="py-2 px-4 text-left font-normal">Sign here.</th>
    <th className="py-2 px-3 w-10 text-center"></th>
  </tr>
</thead>

              <tbody className="divide-y divide-line bg-paper">
                {data.items.map((item: any, index: number) => {
                  const isExpanded = expandedId === item.id;
                  const raw = item.rawRecord || item;
                  const clientName = item.clientName || raw["Client Name"] || raw["Client Full Name"] || "—";
                  const containerNum = item.containerNumber || raw["Container Number"] || "—";
                  const rawDriverStr = item.driver || raw["Driver"] || "N/A";
                  const { name: driverName, initials: driverInitials } = mapDriver(rawDriverStr);
                  const timestampStr = item.timestamp || raw["Timestamp"] || raw["Date"] || "";
                  const formattedTime = formatLondonDateTime(timestampStr);
                  const rowNumber = (page - 1) * 25 + index + 1;

                  return (
                    <React.Fragment key={item.id}>
                      <tr
  onClick={() => setExpandedId(isExpanded ? null : item.id)}
  className={`h-14 cursor-pointer transition select-none ${isExpanded ? "bg-brand-soft" : "hover:bg-surface-hover border-b border-line"}`}
>
  <td className="py-2 px-4 text-center" onClick={e => e.stopPropagation()}>
    <input type="checkbox" className="rounded border-line-strong text-brand" />
  </td>
  
  <td className="py-2 px-2 text-left text-[13px] text-ink">{rowNumber}</td>

  {/* User Column */}
  <td className="py-2 px-4 text-left border-r border-transparent">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-brand-dark text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-sm">
        {driverInitials}
      </div>
      <span className="font-medium text-[13px] text-ink">{driverName}</span>
    </div>
  </td>

  <td className="py-2 px-3 text-center text-muted">
    <MoreHorizontal className="w-4 h-4 mx-auto" />
  </td>

  <td className="py-2 px-3 text-center border-r border-line-strong text-muted">
    <FileText className="w-4 h-4 mx-auto hover:text-ink transition" />
  </td>

  {/* Date submitted */}
  <td className="py-2 px-4 text-[13px] text-ink">
    {formattedTime}
  </td>

  {/* Damage Liability / Pill */}
  <td className="py-2 px-4">
    <div className="h-8 px-3 inline-flex items-center gap-2 bg-paper border border-line rounded-lg text-[13px] text-ink shadow-sm truncate max-w-[160px]">
      <span className="truncate">{item.damageCategories || item.address || containerNum || "No protection..."}</span>
      <ChevronDown className="w-3 h-3 text-muted flex-shrink-0" />
    </div>
  </td>

  {/* Pictures */}
  <td className="py-2 px-4" onClick={e => e.stopPropagation()}>
    {item.photos && item.photos.length > 0 ? (
      <div className="flex items-center gap-1.5">
        {item.photos.slice(0, 3).map((p: any, pIdx: number) => (
          <ThumbnailPreview
            key={p.fileId || pIdx}
            src={p.thumbUrl}
            alt={`Photograph #${pIdx + 1}`}
            size="sm"
            onClick={() => setActivePhoto({ title: `Photo #${pIdx + 1}`, url: p.thumbUrl })}
          />
        ))}
        {item.photos.length > 3 && (
          <span className="w-7 h-7 rounded-lg bg-surface border border-line flex items-center justify-center text-[10px] text-muted font-bold shadow-sm">
            +{item.photos.length - 3}
          </span>
        )}
      </div>
    ) : (
      <span className="text-[12px] text-muted">None</span>
    )}
  </td>

  {/* Signature */}
  <td className="py-2 px-4" onClick={e => e.stopPropagation()}>
    {item.signature ? (
      <button
        onClick={() => setActivePhoto({ title: `Customer Sign-Off`, url: item.signature.thumbUrl })}
        className="h-8 px-2 bg-paper border border-line rounded-lg flex items-center justify-center hover:border-brand transition shadow-sm"
      >
        <img src={item.signature.thumbUrl} alt="Signature" className="h-5 max-w-[60px] object-contain mix-blend-multiply" />
      </button>
    ) : (
      <span className="text-[12px] text-muted">None</span>
    )}
  </td>

  <td className="py-2 px-3 text-center"></td>
</tr>

                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sticky Pagination Bar */}
          {data.pagination && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-paper text-xs text-muted sticky bottom-0">
              <div>
                Showing <span className="font-mono text-ink font-semibold">1–{data.items.length}</span> of{" "}
                <span className="font-mono text-ink font-semibold">{data.pagination.total}</span> records
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-2.5 py-1 rounded border border-line bg-paper text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition"
                >
                  Prev
                </button>
                <span className="px-2 font-mono text-ink">
                  {page} / {data.pagination.totalPages || 1}
                </span>
                <button
                  disabled={!data.pagination.hasMore}
                  onClick={() => setPage(page + 1)}
                  className="px-2.5 py-1 rounded border border-line bg-paper text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
