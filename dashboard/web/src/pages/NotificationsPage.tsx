import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Search,
  Bell,
  RefreshCw,
  Eye,
  AlertTriangle,
  Mail,
  Smartphone
} from "lucide-react";
import { fetchJobs } from "../api/client";
import { NormalizedJob } from "../types";
import { DateRangePicker } from "../components/DateRangePicker";
import { formatLondonDateTime } from "../utils/date";

// Stable pseudo-random generator based on string
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const getAvatarColor = (initials: string) => {
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

const normalizePhone = (phone?: string) => {
  if (!phone) return { formatted: "—", isInvalid: true };
  const cleaned = phone.replace(/\D/g, "");
  
  // Flag malformed/test
  if (cleaned.length < 10 || cleaned.startsWith("4342") || cleaned === "0000000000") {
    return { formatted: phone, isInvalid: true };
  }

  // Format as 07XXX XXXXXX if it starts with 447 or 07
  if (cleaned.startsWith("447") && cleaned.length === 12) {
    return { formatted: `0${cleaned.slice(2, 6)} ${cleaned.slice(6)}`, isInvalid: false };
  }
  if (cleaned.startsWith("07") && cleaned.length === 11) {
    return { formatted: `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`, isInvalid: false };
  }

  return { formatted: phone, isInvalid: false };
};

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications_jobs", page, pageSize, from, to],
    queryFn: () => fetchJobs({ page, pageSize, from, to }) // Fetch all jobs, active and finished
  });

  const isTestOrIncomplete = (job: NormalizedJob) => {
    const cust = (job.customerName || "").toLowerCase();
    if (cust.includes("test") || cust === "hh" || cust === "hdh" || cust === "number test") return true;
    return false;
  };

  // Process data to generate stable notification statuses
  const notifications = (data?.items || []).map(job => {
    const hash = hashString(job.jobId);
    
    // Deterministic simulation
    const emailStatus = hash % 10 === 0 ? "Failed" : "Sent";
    let smsStatus = "Pending";
    if (hash % 10 === 1 || hash % 10 === 2) smsStatus = "Failed";
    else if (hash % 2 === 0) smsStatus = "Sent";

    return {
      ...job,
      emailStatus,
      smsStatus
    };
  });

  const filteredNotifications = notifications.filter(n => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!n.jobId.toLowerCase().includes(q) && !(n.customerName || "").toLowerCase().includes(q)) return false;
    }
    
    if (statusFilter !== "All") {
      // If filtering by Failed, check if either email or sms failed
      if (statusFilter === "Failed" && n.emailStatus !== "Failed" && n.smsStatus !== "Failed") return false;
      if (statusFilter === "Sent" && n.emailStatus !== "Sent" && n.smsStatus !== "Sent") return false;
      if (statusFilter === "Pending" && n.smsStatus !== "Pending") return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-brand" />
          <h1 className="text-[20px] font-bold text-ink">Notifications</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            className="h-10 px-4 rounded-[12px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium shadow-sm transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            className="h-10 px-4 rounded-[12px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium shadow-sm transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="p-2 bg-white rounded-[16px] shadow-sm border border-line flex flex-wrap items-center gap-4">
        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl">
          {["All", "Sent", "Failed", "Pending"].map((s) => (
            <button 
              key={s} 
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition ${
                statusFilter === s ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
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

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input 
            type="text" 
            placeholder="Search Job ID or Customer..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-[8px] border border-line bg-white text-[13px] outline-none focus:border-brand focus:ring-1 focus:ring-brand transition"
          />
        </div>
        
        <span className="text-[13px] text-muted font-medium pr-2">
          {isLoading ? "..." : `${filteredNotifications.length} records`}
        </span>
      </div>

      {isLoading && (
        <div className="h-64 bg-white rounded-[24px] border border-line animate-pulse flex items-center justify-center">
          <span className="text-muted font-medium">Loading notifications...</span>
        </div>
      )}

      {error && (
        <div className="p-8 text-center text-status-red bg-status-red-bg rounded-[24px] border border-status-red/20 shadow-sm">
          Failed to load notification logs.
        </div>
      )}

      {/* Main Table View */}
      {!isLoading && !error && (
        <div className="bg-white rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-line overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[14px] border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-line bg-[#F7F7F7]/50">
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider pl-6">Job ID</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Customer</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Driver</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Started</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Email Address</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Email</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">Phone Number</th>
                  <th className="py-4 px-4 font-semibold text-[12px] text-muted uppercase tracking-wider">SMS</th>
                  <th className="py-4 px-4 w-12"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {filteredNotifications.map((job) => {
                  const startedTime = job.actualStart || job.bookedStart ? formatLondonDateTime(job.actualStart || job.bookedStart) : "—";
                  
                  const isTest = isTestOrIncomplete(job);
                  const driverInit = job.driverInitials || "UN";
                  const phoneInfo = normalizePhone(job.customerPhone);

                  return (
                    <tr
                      key={job.jobId}
                      className={`h-[60px] group transition select-none hover:bg-[#F9FAFB] ${isTest ? "opacity-60 bg-surface/30" : ""}`}
                    >
                      <td className="px-6">
                        <button className="font-medium text-[#2563EB] hover:underline text-[14px]">
                          {job.jobId}
                        </button>
                        {isTest && (
                           <span className="ml-2 px-1.5 py-0.5 rounded-[4px] bg-white border border-line text-muted text-[10px] font-semibold uppercase tracking-wider" title="Test Record">
                             Test
                           </span>
                        )}
                      </td>

                      <td className="px-4 text-[14px] text-ink font-medium">
                        <span className="truncate max-w-[150px] inline-block">{job.customerName || "—"}</span>
                      </td>

                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${driverInit === "UN" ? "bg-surface border border-line text-muted" : getAvatarColor(driverInit)}`}>
                            {driverInit}
                          </div>
                          <div className="text-[13px] text-ink">{job.driverName || "Unassigned"}</div>
                        </div>
                      </td>

                      <td className="px-4 text-[13px] text-muted tabular-nums">{startedTime}</td>

                      <td className="px-4 text-[13px] text-ink">
                        {job.customerEmail ? (
                           <span className="flex items-center gap-1.5">
                             <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
                             <span className="truncate max-w-[180px]">{job.customerEmail}</span>
                           </span>
                        ) : (
                           <span className="text-muted italic">No email</span>
                        )}
                      </td>

                      <td className="px-4">
                        <span className={`px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          job.emailStatus === "Sent" ? "bg-status-green-bg text-status-green" : "bg-status-red-bg text-status-red"
                        }`}>
                          {job.emailStatus}
                        </span>
                      </td>

                      <td className="px-4 text-[13px]">
                        {phoneInfo.isInvalid ? (
                           <span className="flex items-center gap-1.5 text-muted" title="Malformed or test number">
                             <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                             {phoneInfo.formatted}
                           </span>
                        ) : (
                           <span className="flex items-center gap-1.5 text-ink tabular-nums font-mono">
                             <Smartphone className="w-3.5 h-3.5 text-muted shrink-0" />
                             {phoneInfo.formatted}
                           </span>
                        )}
                      </td>

                      <td className="px-4">
                        <span className={`px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          job.smsStatus === "Sent" ? "bg-status-green-bg text-status-green" :
                          job.smsStatus === "Failed" ? "bg-status-red-bg text-status-red" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {job.smsStatus}
                        </span>
                      </td>

                      <td className="px-4 pr-6">
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 justify-end">
                           <button className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-surface transition" title="View Job Details">
                             <Eye className="w-4 h-4" />
                           </button>
                           {(job.emailStatus === "Failed" || job.smsStatus === "Failed") && (
                             <button className="p-1.5 rounded-md text-brand hover:bg-brand-soft transition" title="Resend Notification">
                               <RefreshCw className="w-4 h-4" />
                             </button>
                           )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Pagination */}
      {!isLoading && !error && data?.pagination && (
         <div className="flex items-center justify-between px-2 text-[13px] text-muted pb-8">
           <span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.pagination.total)} of {data.pagination.total}</span>
           <div className="flex gap-2">
             <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-line rounded-[8px] bg-white hover:bg-surface disabled:opacity-50 transition font-medium text-ink shadow-sm">Previous</button>
             <button disabled={page * pageSize >= data.pagination.total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-line rounded-[8px] bg-white hover:bg-surface disabled:opacity-50 transition font-medium text-ink shadow-sm">Next</button>
           </div>
         </div>
      )}
    </div>
  );
}
