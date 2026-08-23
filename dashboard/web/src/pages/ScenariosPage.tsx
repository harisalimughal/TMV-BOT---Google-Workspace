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
  RefreshCw
} from "lucide-react";
import { fetchScenarios } from "../api/client";
import { ScenarioItem } from "../types";
import { ThumbnailPreview } from "../components/ThumbnailPreview";
import { PhotoModal } from "../components/PhotoModal";
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
          <h3 className="text-sm font-semibold text-ink">Failed to load {config.title} records</h3>
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
          <h3 className="text-sm font-semibold text-ink">No {config.title} records</h3>
          <p className="text-xs text-muted max-w-md mx-auto">{config.emptyHint}</p>
        </div>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && viewMode === "table" && (
        <div className="bg-paper rounded border border-line-strong shadow-card overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-230px)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface border-b border-line-strong text-muted text-xs font-medium sticky top-0 z-20">
                <tr className="h-10">
                  <th className="py-2 px-3 w-8 text-center border-r border-line">
                    <input type="checkbox" className="rounded text-brand" />
                  </th>
                  <th className="py-2 px-2 w-8 text-center font-mono text-[11px] text-muted border-r border-line">
                    #
                  </th>

                  {/* Frozen Identity Column Header */}
                  <th className="py-2 px-3 w-56 font-medium sticky left-0 bg-surface z-30 border-r border-line-strong shadow-sm">
                    Job & Driver
                  </th>

                  <th className="py-2 px-3 w-40 font-medium border-r border-line">
                    Recorded (London)
                  </th>

                  <th className="py-2 px-3 w-48 font-medium border-r border-line">
                    Client Name
                  </th>

                  <th className="py-2 px-3 w-36 font-medium border-r border-line">
                    Container Number
                  </th>

                  <th className="py-2 px-3 min-w-[180px] font-medium border-r border-line">
                    {kind === "liability" ? "Damage Categories" : "Location / Note"}
                  </th>

                  <th className="py-2 px-3 w-36 font-medium border-r border-line text-center">
                    Photographs
                  </th>

                  <th className="py-2 px-3 w-28 font-medium border-r border-line text-center">
                    Signature
                  </th>

                  <th className="py-2 px-3 w-12 text-center"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line bg-paper">
                {data.items.map((item: any, index: number) => {
                  const isExpanded = expandedId === item.id;
                  const raw = item.rawRecord || item;
                  const clientName = item.clientName || raw["Client Name"] || raw["Client Full Name"] || "—";
                  const containerNum = item.containerNumber || raw["Container Number"] || "—";
                  const driverInitials = item.driver || raw["Driver"] || "—";
                  const timestampStr = item.timestamp || raw["Timestamp"] || raw["Date"] || "";
                  const formattedTime = formatLondonDateTime(timestampStr);
                  const rowNumber = (page - 1) * 25 + index + 1;

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className={`h-[52px] cursor-pointer transition select-none ${
                          isExpanded ? "bg-brand-soft" : "hover:bg-surface"
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center border-r border-line" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded text-brand" />
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono text-[11px] text-muted border-r border-line">
                          {rowNumber}
                        </td>

                        {/* Frozen Identity Column: Job ID + Driver Initials */}
                        <td
                          className={`py-2.5 px-3 border-r border-line-strong sticky left-0 z-10 transition ${
                            isExpanded ? "bg-brand-soft" : "bg-paper hover:bg-surface"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-pill bg-brand-soft text-brand font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                              {driverInitials}
                            </div>
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-semibold text-brand text-xs block truncate">
                                  {item.jobId}
                                </span>
                                {item.eventLabel && (
                                  <span className="px-1.5 py-0.2 rounded-pill bg-status-amber-bg text-status-amber text-[9px] font-mono font-medium">
                                    {item.eventLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-ink-2 border-r border-line" title={timestampStr}>
                          {formattedTime}
                        </td>

                        {/* Client Name Pill Input */}
                        <td className="py-2.5 px-3 border-r border-line">
                          <div className="h-7 px-2.5 py-1 bg-surface border border-line rounded flex items-center text-[13px] text-ink truncate" title={clientName}>
                            <span className="truncate">{clientName}</span>
                          </div>
                        </td>

                        {/* Container Pill Input */}
                        <td className="py-2.5 px-3 border-r border-line">
                          <div className="h-7 px-2.5 py-1 bg-surface border border-line rounded flex items-center text-[13px] font-mono text-ink truncate" title={containerNum}>
                            <span className="truncate">{containerNum}</span>
                          </div>
                        </td>

                        {/* Address or Damage Categories */}
                        <td className="py-2.5 px-3 border-r border-line">
                          <div className="h-7 px-2.5 py-1 bg-surface border border-line rounded flex items-center text-[13px] text-ink truncate" title={item.damageCategories || item.address || "—"}>
                            <span className="truncate">{item.damageCategories || item.address || "—"}</span>
                          </div>
                        </td>

                        {/* Photographs Strip */}
                        <td className="py-2.5 px-3 border-r border-line text-center" onClick={e => e.stopPropagation()}>
                          {item.photos && item.photos.length > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {item.photos.slice(0, 3).map((p: any, pIdx: number) => (
                                <ThumbnailPreview
                                  key={p.fileId || pIdx}
                                  src={p.thumbUrl}
                                  alt={`Photograph #${pIdx + 1}, job ${item.jobId}`}
                                  size="sm"
                                  onClick={() => setActivePhoto({ title: `${item.jobId} - Photo #${pIdx + 1}`, url: p.thumbUrl })}
                                />
                              ))}
                              {item.photos.length > 3 && (
                                <span className="w-7 h-7 rounded bg-surface border border-line flex items-center justify-center font-mono text-[10px] text-muted font-bold">
                                  +{item.photos.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted italic">None</span>
                          )}
                        </td>

                        {/* Signature */}
                        <td className="py-2.5 px-3 border-r border-line text-center" onClick={e => e.stopPropagation()}>
                          {item.signature ? (
                            <button
                              onClick={() => setActivePhoto({ title: `${item.jobId} - Customer Sign-Off`, url: item.signature.thumbUrl })}
                              className="h-7 px-2 bg-paper border border-line rounded flex items-center justify-center mx-auto hover:border-brand transition"
                              title="View Customer Sign-Off"
                            >
                              <img
                                src={item.signature.thumbUrl}
                                alt="Signature"
                                className="h-5 max-w-[60px] object-contain"
                                onError={e => { (e.target as HTMLElement).style.display = "none"; }}
                              />
                            </button>
                          ) : (
                            <span className="text-[12px] text-muted">Not captured</span>
                          )}
                        </td>

                        {/* Chevron */}
                        <td className="py-2.5 px-3 text-center text-muted hover:text-brand">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-brand" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Expanded Report Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-6 bg-bg border-b border-line">
                            <div className="p-6 bg-paper rounded shadow-card border border-transparent space-y-4 max-w-3xl">
                              <div className="flex items-center justify-between border-b border-line pb-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-ink font-mono">{item.jobId} Dossier</h4>
                                  <span className="text-xs text-muted font-mono">{formattedTime}</span>
                                </div>
                                {item.eventLabel && (
                                  <span className="px-2 py-0.5 rounded-pill bg-status-amber-bg text-status-amber text-xs font-medium font-mono">
                                    {item.eventLabel}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-[11px] font-medium text-muted block mb-1">Client Name</span>
                                  <span className="font-semibold text-ink">{clientName}</span>
                                </div>
                                <div>
                                  <span className="text-[11px] font-medium text-muted block mb-1">Container Number</span>
                                  <span className="font-mono text-ink">{containerNum}</span>
                                </div>
                                <div>
                                  <span className="text-[11px] font-medium text-muted block mb-1">Driver</span>
                                  <span className="font-mono text-ink">{driverInitials}</span>
                                </div>
                                <div>
                                  <span className="text-[11px] font-medium text-muted block mb-1">Client Present</span>
                                  <span className="text-ink">{item.clientPresent || "Not recorded"}</span>
                                </div>
                              </div>

                              {item.photos && item.photos.length > 0 && (
                                <div className="pt-3 border-t border-line">
                                  <span className="text-[11px] font-medium text-muted block mb-2">Photographs</span>
                                  <div className="flex flex-wrap gap-2">
                                    {item.photos.map((p: any, pIdx: number) => (
                                      <ThumbnailPreview
                                        key={p.fileId || pIdx}
                                        src={p.thumbUrl}
                                        alt={`Photograph #${pIdx + 1}, job ${item.jobId}`}
                                        size="lg"
                                        onClick={() => setActivePhoto({ title: `${item.jobId} - Photo #${pIdx + 1}`, url: p.thumbUrl })}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
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
