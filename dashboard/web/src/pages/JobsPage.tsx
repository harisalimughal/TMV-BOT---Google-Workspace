import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Phone,
  MapPin,
  FileText,
  AlertTriangle
} from "lucide-react";
import { fetchJobs } from "../api/client";
import { NormalizedJob } from "../types";
import { DelayBandBadge, JobStatusBadge } from "../components/StatusBadge";
import { EvidenceCompletenessPill } from "../components/EvidenceCompletenessPill";
import { PaperJobReport } from "../components/PaperJobReport";
import { SearchFilterBar } from "../components/SearchFilterBar";
import { DateRangePicker } from "../components/DateRangePicker";

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

  const hasActiveFilters = Boolean(search || status !== "ALL" || driver !== "ALL" || payMethod !== "ALL" || evidence !== "ALL" || from || to);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Job Operations & Records</h2>
          <p className="text-xs text-muted">Real-time table joined across Bookings, Drivers, Workflow and Evidence</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
      </div>

      {/* Filter and Search Bar */}
      <SearchFilterBar
        search={search}
        onSearchChange={val => { setSearch(val); setPage(1); }}
        status={status}
        onStatusChange={val => { setStatus(val); setPage(1); }}
        driver={driver}
        onDriverChange={val => { setDriver(val); setPage(1); }}
        payMethod={payMethod}
        onPayMethodChange={val => { setPayMethod(val); setPage(1); }}
        evidence={evidence}
        onEvidenceChange={val => { setEvidence(val); setPage(1); }}
        onExportCsv={handleExportCsv}
        onResetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Main Jobs Table */}
      <div className="bg-paper rounded-xl border border-line shadow-paper overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface border-b border-line text-muted uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-8"></th>
                <th
                  onClick={() => handleSort("jobId")}
                  className="py-3 px-4 cursor-pointer hover:text-ink select-none font-mono"
                >
                  <div className="flex items-center gap-1">
                    Job ID <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("bookedStart")}
                  className="py-3 px-4 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1">
                    Timing (London) <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("customerName")}
                  className="py-3 px-4 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1">
                    Customer <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Route</th>
                <th
                  onClick={() => handleSort("driverInitials")}
                  className="py-3 px-4 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1">
                    Driver <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="py-3 px-4 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1">
                    Status <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("delayMinutes")}
                  className="py-3 px-4 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1">
                    Delay <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("totalCharges")}
                  className="py-3 px-4 cursor-pointer hover:text-ink select-none text-right font-mono"
                >
                  <div className="flex items-center justify-end gap-1">
                    Total (£) <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Evidence</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {isLoading && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted">
                    Loading live jobs data...
                  </td>
                </tr>
              )}

              {error && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-status-red">
                    Failed to fetch jobs. Please click retry.
                  </td>
                </tr>
              )}

              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted">
                    No jobs match the current filters.
                  </td>
                </tr>
              )}

              {!isLoading &&
                data?.items.map((job: NormalizedJob) => {
                  const isExpanded = expandedJobId === job.jobId;

                  return (
                    <React.Fragment key={job.jobId}>
                      <tr
                        onClick={() => setExpandedJobId(isExpanded ? null : job.jobId)}
                        className={`hover:bg-surface/70 cursor-pointer transition ${
                          isExpanded ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-muted">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-tmv-blue" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-ink whitespace-nowrap">
                          {job.jobId}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                          <span className="text-ink font-semibold block">{job.bookedStart || "—"}</span>
                          <span className="text-muted">{job.bookedMinutes}m scheduled</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-ink block">{job.customerName}</span>
                          {job.customerPhone && (
                            <span className="text-muted flex items-center gap-1 text-[11px] font-mono">
                              <Phone className="w-3 h-3" /> {job.customerPhone}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate text-[11px]">
                          <div className="flex items-center gap-1 truncate text-ink">
                            <MapPin className="w-3 h-3 text-tmv-blue flex-shrink-0" />
                            <span className="truncate">{job.pickup}</span>
                          </div>
                          <div className="flex items-center gap-1 truncate text-muted mt-0.5">
                            <MapPin className="w-3 h-3 text-status-green flex-shrink-0" />
                            <span className="truncate">{job.dropoff}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-navy-800 text-white flex items-center justify-center text-[10px] font-bold font-mono">
                              {job.driverInitials || "UN"}
                            </span>
                            <span className="font-medium text-ink">{job.driverName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <DelayBandBadge band={job.delayBand} minutes={job.delayMinutes} />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold text-ink">
                          £{(job.totalCharges / 100).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <EvidenceCompletenessPill completeness={job.evidenceCompleteness} />
                        </td>
                      </tr>

                      {/* Expandable Paper Report Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0 bg-surface/30">
                            <div className="p-4">
                              <PaperJobReport job={job} onClose={() => setExpandedJobId(null)} />
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

        {/* Pagination Bar */}
        {data?.pagination && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-surface text-xs text-muted">
            <div>
              Showing <span className="font-bold text-ink">{data.items.length}</span> of{" "}
              <span className="font-bold text-ink">{data.pagination.total}</span> jobs
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-line bg-paper text-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-2 transition"
              >
                Previous
              </button>
              <span className="px-2 font-mono font-bold text-ink">
                Page {page} of {data.pagination.totalPages || 1}
              </span>
              <button
                disabled={!data.pagination.hasMore}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-line bg-paper text-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-2 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
