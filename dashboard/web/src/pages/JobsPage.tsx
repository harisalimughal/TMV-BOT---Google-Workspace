import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Phone,
  MapPin,
  FileText,
  AlertTriangle,
  Download,
  Filter,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  MoreHorizontal,
  X,
  ExternalLink,
  Eye,
  Camera,
  Layers,
  Sparkles
} from "lucide-react";
import { fetchJobs } from "../api/client";
import { NormalizedJob, toPounds } from "../types";
import { DelayBandBadge, JobStatusBadge } from "../components/StatusBadge";
import { EvidenceCompletenessPill } from "../components/EvidenceCompletenessPill";
import { PaperJobReport } from "../components/PaperJobReport";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { ThumbnailPreview } from "../components/ThumbnailPreview";
import { DateRangePicker } from "../components/DateRangePicker";
import { PhotoModal } from "../components/PhotoModal";
import { formatLondonDateTime } from "../utils/date";

export function JobsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState("bookedStart");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [driver, setDriver] = useState("ALL");
  const [payMethod, setPayMethod] = useState("ALL");
  const [evidence, setEvidence] = useState("ALL");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [drawerJob, setDrawerJob] = useState<NormalizedJob | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{ title: string; url: string; driveUrl?: string } | null>(null);

  const queryParams = {
    page,
    pageSize,
    sort,
    dir,
    q: search,
    status,
    driver,
    payMethod,
    evidence,
    from,
    to
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["jobs", queryParams],
    queryFn: () => fetchJobs(queryParams)
  });

  const handleSort = (field: string) => {
    if (sort === field) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir("desc");
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status !== "ALL") params.set("status", status);
    if (driver !== "ALL") params.set("driver", driver);
    if (payMethod !== "ALL") params.set("payMethod", payMethod);
    if (evidence !== "ALL") params.set("evidence", evidence);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    window.location.href = `/ops/api/jobs/export.csv?${params.toString()}`;
  };

  const activeFilterCount = [
    status !== "ALL",
    driver !== "ALL",
    payMethod !== "ALL",
    evidence !== "ALL",
    Boolean(from || to)
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setStatus("ALL");
    setDriver("ALL");
    setPayMethod("ALL");
    setEvidence("ALL");
    setFrom(undefined);
    setTo(undefined);
    setPage(1);
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* 1. ENTERPRISE TOOLBAR ROW */}
      <div className="bg-paper p-3.5 rounded-lg border border-line flex flex-wrap items-center justify-between gap-3 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle Segmented Control */}
          <div className="flex items-center p-0.5 bg-surface rounded-lg border border-line text-xs">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                viewMode === "table" ? "bg-paper text-ink shadow-card font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                viewMode === "cards" ? "bg-paper text-ink shadow-card font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>

          {/* Inline Search */}
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search moves, postcodes, clients..."
              className="w-full h-8 pl-3 pr-7 bg-surface border border-line rounded-lg text-xs text-ink placeholder:text-muted focus:bg-paper focus:border-brand transition"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                className="absolute right-2 top-2 text-muted hover:text-ink"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Presets */}
          <div className="hidden xl:flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-line text-[11px] font-medium">
            <button
              onClick={() => { setStatus("ALL"); setPage(1); }}
              className={`px-2.5 py-1 rounded-md transition ${status === "ALL" ? "bg-paper text-ink font-semibold shadow-2xs" : "text-muted hover:text-ink"}`}
            >
              All
            </button>
            <button
              onClick={() => { setStatus("IN_PROGRESS"); setPage(1); }}
              className={`px-2.5 py-1 rounded-md transition ${status === "IN_PROGRESS" ? "bg-paper text-brand font-semibold shadow-2xs" : "text-muted hover:text-ink"}`}
            >
              In Progress
            </button>
            <button
              onClick={() => { setStatus("COMPLETED"); setPage(1); }}
              className={`px-2.5 py-1 rounded-md transition ${status === "COMPLETED" ? "bg-paper text-status-green font-semibold shadow-2xs" : "text-muted hover:text-ink"}`}
            >
              Delivered
            </button>
          </div>

          {/* Filter Trigger Button with Count Badge */}
          <button
            onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              activeFilterCount > 0
                ? "bg-brand-soft border-brand/30 text-brand"
                : "bg-surface border-line text-ink-2 hover:bg-surface-2"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Date Range Picker */}
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
        </div>

        <div className="flex items-center gap-3">
          {/* Record Count */}
          <span className="text-xs text-muted font-mono">
            {isLoading ? "Loading..." : `${data?.pagination?.total || 0} moves recorded`}
          </span>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="p-1.5 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink-2 transition"
            title="Export CSV Dataset"
          >
            <Download className="w-4 h-4 text-muted" />
          </button>
        </div>
      </div>

      {/* Expanded Filter Panel */}
      {filterDrawerOpen && (
        <div className="p-4 bg-paper rounded-lg border border-line flex flex-wrap items-center gap-4 text-xs shadow-card">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Status Filter</span>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="h-8 px-2.5 bg-surface border border-line rounded-lg text-xs text-ink"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="READY">Scheduled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Driver</span>
            <select
              value={driver}
              onChange={e => { setDriver(e.target.value); setPage(1); }}
              className="h-8 px-2.5 bg-surface border border-line rounded-lg text-xs text-ink font-mono"
            >
              <option value="ALL">All Drivers</option>
              <option value="WD">WD &bull; Warren Davis</option>
              <option value="MD">MD &bull; Mark Davis</option>
              <option value="JS">JS &bull; John Smith</option>
              <option value="RS">RS &bull; Robert Scott</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Payment Type</span>
            <select
              value={payMethod}
              onChange={e => { setPayMethod(e.target.value); setPage(1); }}
              className="h-8 px-2.5 bg-surface border border-line rounded-lg text-xs text-ink"
            >
              <option value="ALL">All Payment Types</option>
              <option value="CARD">Card</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="mt-4 text-xs text-muted hover:text-status-red underline font-medium"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}

      {/* 2. MASTER HIGH-TICKET DATA TABLE */}
      {viewMode === "table" && (
        <div className="bg-paper rounded-lg border border-line shadow-card overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-230px)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface border-b border-line text-meta text-muted uppercase sticky top-0 z-20">
                <tr className="h-10">
                  <th className="py-2 px-3 w-8 text-center border-r border-line">
                    <input type="checkbox" className="rounded text-brand" />
                  </th>
                  <th className="py-2 px-2 w-8 text-center font-mono text-[11px] text-muted border-r border-line">
                    #
                  </th>

                  {/* Frozen Identity Column */}
                  <th
                    onClick={() => handleSort("jobId")}
                    className="py-2 px-3 w-56 cursor-pointer hover:text-ink font-semibold sticky left-0 bg-surface z-30 border-r border-line-strong shadow-xs select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span>Job ID &amp; Driver</span>
                      <ArrowUpDown className="w-3 h-3 text-muted" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort("bookedStart")}
                    className="py-2 px-3 w-40 cursor-pointer hover:text-ink font-semibold border-r border-line select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span>Timing (London)</span>
                      <ArrowUpDown className="w-3 h-3 text-muted" />
                    </div>
                  </th>

                  <th className="py-2 px-3 w-48 font-semibold border-r border-line">
                    Customer
                  </th>

                  <th className="py-2 px-3 min-w-[200px] font-semibold border-r border-line">
                    Pickup Address
                  </th>

                  <th className="py-2 px-3 min-w-[200px] font-semibold border-r border-line">
                    Dropoff Destination
                  </th>

                  <th
                    onClick={() => handleSort("status")}
                    className="py-2 px-3 w-32 cursor-pointer hover:text-ink font-semibold border-r border-line select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-muted" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort("delayMinutes")}
                    className="py-2 px-3 w-28 cursor-pointer hover:text-ink font-semibold border-r border-line select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span>Punctuality</span>
                      <ArrowUpDown className="w-3 h-3 text-muted" />
                    </div>
                  </th>

                  <th className="py-2 px-3 w-36 font-semibold border-r border-line text-center">
                    Photographs
                  </th>

                  <th className="py-2 px-3 w-28 font-semibold border-r border-line text-center">
                    Signature
                  </th>

                  <th
                    onClick={() => handleSort("totalCharges")}
                    className="py-2 px-3 w-28 cursor-pointer hover:text-ink font-semibold border-r border-line text-right font-mono select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total (£)</span>
                      <ArrowUpDown className="w-3 h-3 text-muted" />
                    </div>
                  </th>

                  <th className="py-2 px-3 w-16 text-center font-semibold">Inspect</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line bg-paper">
                {isLoading && (
                  <>
                    {[...Array(8)].map((_, i) => (
                      <tr key={i} className="h-[52px] animate-pulse">
                        <td className="py-3 px-3 text-center border-r border-line"><div className="w-3.5 h-3.5 bg-surface rounded mx-auto" /></td>
                        <td className="py-3 px-2 text-center border-r border-line"><div className="w-3 h-3 bg-surface rounded mx-auto" /></td>
                        <td className="py-3 px-3 border-r border-line-strong sticky left-0 bg-paper"><div className="w-24 h-4 bg-surface rounded" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-24 h-4 bg-surface rounded" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-28 h-6 bg-surface rounded" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-36 h-6 bg-surface rounded" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-36 h-6 bg-surface rounded" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-20 h-5 bg-surface rounded-full" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-16 h-5 bg-surface rounded-full" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-20 h-7 bg-surface rounded" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-16 h-4 bg-surface rounded" /></td>
                        <td className="py-3 px-3 border-r border-line"><div className="w-14 h-4 bg-surface rounded ml-auto" /></td>
                        <td className="py-3 px-3"><div className="w-12 h-6 bg-surface rounded mx-auto" /></td>
                      </tr>
                    ))}
                  </>
                )}

                {error && (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-status-red font-medium">
                      Failed to fetch jobs data. Click Refresh in header to retry.
                    </td>
                  </tr>
                )}

                {!isLoading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-16 text-center text-muted">
                      <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center mx-auto mb-2 text-muted">
                        <FileText className="w-5 h-5 opacity-60" />
                      </div>
                      <p className="text-btn text-ink">No moves found</p>
                      <p className="text-xs text-muted">No moves match your filter criteria or search query.</p>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  data?.items.map((job: NormalizedJob, index: number) => {
                    const isExpanded = expandedJobId === job.jobId;
                    const totalPounds = toPounds(job.totalCharges);
                    const rowNumber = (page - 1) * pageSize + index + 1;
                    const formattedTime = formatLondonDateTime(job.bookedStart);

                    return (
                      <React.Fragment key={job.jobId}>
                        <tr
                          onClick={() => setDrawerJob(job)}
                          className={`h-[52px] cursor-pointer transition select-none group ${
                            isExpanded ? "bg-brand-soft" : "hover:bg-surface/80"
                          }`}
                        >
                          {/* Checkbox */}
                          <td
                            className="py-2.5 px-3 text-center border-r border-line"
                            onClick={e => e.stopPropagation()}
                          >
                            <input type="checkbox" className="rounded text-brand" />
                          </td>

                          {/* Row Number */}
                          <td className="py-2.5 px-2 text-center font-mono text-[11px] text-muted border-r border-line">
                            {rowNumber}
                          </td>

                          {/* FROZEN IDENTITY COLUMN */}
                          <td
                            className={`py-2.5 px-3 border-r border-line-strong sticky left-0 z-10 transition ${
                              isExpanded ? "bg-brand-soft" : "bg-paper group-hover:bg-surface/80"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-6 h-6 rounded-full bg-brand-soft text-brand font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0 border border-brand/20 shadow-2xs"
                                title={`Driver: ${job.driverName}`}
                              >
                                {job.driverInitials || "UN"}
                              </div>
                              <div className="overflow-hidden">
                                <span className="font-mono font-bold text-brand text-xs block truncate group-hover:underline">
                                  {job.jobId}
                                </span>
                                <span className="text-[11px] text-ink-2 truncate block">
                                  {job.driverName}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Timing */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-ink-2 border-r border-line" title={job.bookedStart || ""}>
                            <span>{formattedTime}</span>
                          </td>

                          {/* Customer */}
                          <td className="py-2.5 px-3 border-r border-line">
                            <div
                              className="h-7 px-2.5 py-1 bg-surface border border-line rounded-md flex items-center text-xs font-medium text-ink truncate"
                              title={`${job.customerName} ${job.customerPhone ? `(${job.customerPhone})` : ""}`}
                            >
                              <span className="truncate">{job.customerName}</span>
                            </div>
                          </td>

                          {/* Pickup Address */}
                          <td className="py-2.5 px-3 border-r border-line">
                            <div
                              className="h-7 px-2.5 py-1 bg-surface border border-line rounded-md flex items-center text-xs text-ink truncate max-w-xs"
                              title={job.pickup}
                            >
                              <span className="truncate">{job.pickup}</span>
                            </div>
                          </td>

                          {/* Dropoff Address */}
                          <td className="py-2.5 px-3 border-r border-line">
                            <div
                              className="h-7 px-2.5 py-1 bg-surface border border-line rounded-md flex items-center text-xs text-ink truncate max-w-xs"
                              title={job.dropoff}
                            >
                              <span className="truncate">{job.dropoff}</span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap border-r border-line">
                            <JobStatusBadge status={job.status} />
                          </td>

                          {/* Punctuality Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap border-r border-line">
                            <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
                          </td>

                          {/* Photographs Strip */}
                          <td
                            className="py-2.5 px-3 border-r border-line"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {job.evidenceItems.slice(0, 3).map((ev, i) => (
                                <ThumbnailPreview
                                  key={ev.id || i}
                                  src={ev.fileId ? `/ops/api/jobs/${encodeURIComponent(job.jobId)}/photos/${encodeURIComponent(ev.fileId)}` : undefined}
                                  alt={`${ev.category} photo, job ${job.jobId}`}
                                  state={ev.state}
                                  size="sm"
                                  onClick={() => {
                                    if (ev.fileId) {
                                      setActivePhoto({
                                        title: `${job.jobId} - ${ev.category}`,
                                        url: `/ops/api/jobs/${encodeURIComponent(job.jobId)}/photos/${encodeURIComponent(ev.fileId)}`,
                                        driveUrl: ev.driveUrl
                                      });
                                    }
                                  }}
                                />
                              ))}
                              {job.evidenceItems.length > 3 && (
                                <span className="w-7 h-7 rounded bg-surface border border-line flex items-center justify-center font-mono text-[10px] text-muted font-bold">
                                  +{job.evidenceItems.length - 3}
                                </span>
                              )}
                              {job.evidenceItems.length === 0 && (
                                <span className="text-[11px] text-muted italic">None</span>
                              )}
                            </div>
                          </td>

                          {/* Signature */}
                          <td
                            className="py-2.5 px-3 border-r border-line text-center"
                            onClick={e => e.stopPropagation()}
                          >
                            {job.signatureUrl ? (
                              <button
                                onClick={() => setActivePhoto({ title: `${job.jobId} - Signature`, url: job.signatureUrl! })}
                                className="h-7 px-2 bg-paper border border-line rounded flex items-center justify-center mx-auto hover:border-brand transition"
                                title="View Customer Signature"
                              >
                                <img
                                  src={job.signatureUrl}
                                  alt="Signature"
                                  className="h-5 max-w-[60px] object-contain"
                                  onError={e => { (e.target as HTMLElement).style.display = "none"; }}
                                />
                              </button>
                            ) : (
                              <span className="text-xs text-muted">Not captured</span>
                            )}
                          </td>

                          {/* Total Amount */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-bold text-ink border-r border-line">
                            £{totalPounds.toFixed(2)}
                          </td>

                          {/* Action Button: Drawer View */}
                          <td
                            className="py-2.5 px-3 text-center"
                            onClick={e => { e.stopPropagation(); setDrawerJob(job); }}
                          >
                            <button
                              className="px-2 py-1 rounded bg-surface hover:bg-brand hover:text-white text-brand text-btn transition flex items-center gap-1 mx-auto"
                              title="Open Detailed Move Drawer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Sticky Pagination Bar */}
          {data?.pagination && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-line bg-paper text-xs text-muted sticky bottom-0">
              <div>
                Showing <span className="font-mono text-ink font-bold">1–{data.items.length}</span> of{" "}
                <span className="font-mono text-ink font-bold">{data.pagination.total}</span> moves
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="h-7 px-2 bg-surface border border-line rounded text-xs text-ink font-mono font-medium"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1 rounded-lg border border-line bg-paper text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition"
                  >
                    Prev
                  </button>
                  <span className="px-2 font-mono text-ink font-medium">
                    {page} / {data.pagination.totalPages || 1}
                  </span>
                  <button
                    disabled={!data.pagination.hasMore}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1 rounded-lg border border-line bg-paper text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards View Fallback */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!isLoading &&
            data?.items.map((job: NormalizedJob) => {
              const totalPounds = toPounds(job.totalCharges);
              return (
                <div
                  key={job.jobId}
                  onClick={() => setDrawerJob(job)}
                  className="p-4 bg-paper rounded-lg border border-line shadow-card hover:border-line-strong cursor-pointer transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-soft text-brand font-mono font-bold text-[10px] flex items-center justify-center">
                        {job.driverInitials || "UN"}
                      </div>
                      <span className="font-mono font-bold text-brand text-xs">{job.jobId}</span>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-ink">{job.customerName}</div>
                    <div className="text-muted text-[11px] truncate">{job.pickup} &rarr; {job.dropoff}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line text-xs font-mono">
                    <span className="text-muted">{formatLondonDateTime(job.bookedStart)}</span>
                    <span className="font-bold text-ink">£{totalPounds.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Slide-out Job Detail Drawer */}
      <JobDetailDrawer
        job={drawerJob}
        isOpen={Boolean(drawerJob)}
        onClose={() => setDrawerJob(null)}
      />

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
