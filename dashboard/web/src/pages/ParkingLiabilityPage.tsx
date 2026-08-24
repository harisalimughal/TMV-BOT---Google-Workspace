import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchScenarios } from "../api/client";
import { formatLondonDateTime } from "../utils/date";
import { resolveDriver, getAvatarColor } from "../utils/drivers";
import { DateRangePicker } from "../components/DateRangePicker";
import { SubmissionDetailDrawer } from "../components/SubmissionDetailDrawer";
import {
  ClipboardList,
  Eye,
  Edit3,
  Settings,
  MoreHorizontal,
  Table as TableIcon,
  Inbox,
  Search,
  Filter,
  Download,
  RefreshCw,
  Camera,
  FileSignature
} from "lucide-react";

export function ParkingLiabilityPage() {
  const [activeTab, setActiveTab] = useState("Submissions");
  const [viewMode, setViewMode] = useState<"table" | "inbox">("table");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState("None");
  
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  const { data: response, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["scenarios", "parking", from, to],
    queryFn: () => fetchScenarios("ALL") // Using ALL to get mock data, then filter
  });

  const processedData = useMemo(() => {
    if (!response?.items) return [];
    
    // Filter to parking / mock liability
    let filtered = response.items.filter(item => {
      // For prototype, we'll just take items that look like parking liability
      // Or just take all and map them nicely. Let's just take all and map.
      return true; 
    });

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const raw = item.rawRecord || item;
        const address = (item.address || raw["Address"] || "").toLowerCase();
        const client = (item.clientName || raw["Client Full Name"] || "").toLowerCase();
        const driver = resolveDriver(item.driver || raw["Driver"]).name.toLowerCase();
        return address.includes(q) || client.includes(q) || driver.includes(q);
      });
    }

    return filtered;
  }, [response?.items, search]);

  const paginatedData = processedData.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(processedData.length / pageSize);

  const isInvalidAddress = (addr?: string) => {
    if (!addr) return true;
    const lower = addr.toLowerCase().trim();
    if (lower.length < 8) return true; 
    if (["hhh", "test", "not recorded"].includes(lower)) return true;
    if (!/\\s/.test(lower)) return true; 
    return false;
  };

  const toTitleCase = (str: string) => {
    return str.replace(
      /\\w\\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-12">
      
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shadow-sm">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-[18px] font-bold text-ink">Parking Liability</h1>
            <span className="px-2 py-0.5 rounded-md bg-status-green-bg text-status-green text-[11px] font-bold uppercase tracking-wider">Active</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-[12px] font-semibold text-muted">Progress</span>
            <span className="px-2 py-0.5 bg-surface border border-line rounded-full text-[12px] font-bold text-muted">0/4</span>
          </div>
          
          <button className="h-9 px-3 rounded-[10px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium transition flex items-center gap-1.5 shadow-sm">
            <Eye className="w-4 h-4 text-muted" /> Preview
          </button>
          <button className="h-9 px-3 rounded-[10px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium transition flex items-center gap-1.5 shadow-sm">
            <Edit3 className="w-4 h-4 text-muted" /> Edit Form
          </button>
          <button className="h-9 px-3 rounded-[10px] border border-line bg-white hover:bg-surface text-ink text-[13px] font-medium transition flex items-center gap-1.5 shadow-sm">
            <Settings className="w-4 h-4 text-muted" /> Settings
          </button>
          <button className="h-9 w-9 rounded-[10px] border border-line bg-white hover:bg-surface text-muted transition flex items-center justify-center shadow-sm">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAIN CARD CONTAINER */}
      <div className="bg-white rounded-[20px] shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-line overflow-hidden flex flex-col">
        
        {/* TABS */}
        <div className="flex items-center px-6 border-b border-line">
          {["Submissions", "Users", "Summary", "Activity"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-4 text-[13px] font-semibold border-b-[3px] transition-colors ${activeTab === tab ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink hover:border-line'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-[#FAFAFA] border-b border-line">
          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 bg-surface border border-line rounded-xl">
              <button onClick={() => setViewMode("table")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition ${viewMode === 'table' ? 'bg-white shadow-sm text-ink' : 'text-muted hover:text-ink'}`}>
                <TableIcon className="w-4 h-4" /> Table
              </button>
              <button onClick={() => setViewMode("inbox")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition ${viewMode === 'inbox' ? 'bg-white shadow-sm text-ink' : 'text-muted hover:text-ink'}`}>
                <Inbox className="w-4 h-4" /> Inbox
              </button>
            </div>

            <div className="w-px h-6 bg-line mx-1" />

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 h-9 rounded-full bg-surface border border-line text-[13px] text-ink focus:border-brand outline-none transition"
              />
            </div>
            
            <button className="w-9 h-9 flex items-center justify-center bg-surface border border-line rounded-full text-muted hover:text-ink transition">
              <Filter className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-line mx-1" />

            <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />

            <div className="flex items-center gap-2 ml-2">
              <span className="text-[12px] font-semibold text-muted">Group by</span>
              <select 
                value={groupBy}
                onChange={e => setGroupBy(e.target.value)}
                className="h-9 px-3 rounded-[10px] bg-surface border border-line text-[13px] font-semibold text-ink outline-none focus:border-brand"
              >
                <option value="None">None</option>
                <option value="Driver">Driver</option>
                <option value="Date">Date</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[13px] font-semibold text-muted">
              {processedData.length} submission{processedData.length !== 1 ? 's' : ''}
            </span>
            
            <div className="flex items-center bg-surface border border-line rounded-[10px] overflow-hidden">
              <button className="px-3 h-9 text-[12px] font-semibold text-ink hover:bg-white transition border-r border-line flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-muted" /> CSV
              </button>
              <button className="px-3 h-9 text-[12px] font-semibold text-ink hover:bg-white transition flex items-center gap-1.5">
                PDF
              </button>
            </div>

            <button 
              onClick={() => refetch()}
              className="w-9 h-9 rounded-full border border-line bg-surface hover:bg-white text-muted hover:text-ink transition flex items-center justify-center shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-[14px] border-collapse">
            <thead className="bg-white border-b border-line">
              <tr>
                <th className="py-4 px-4 w-12 text-center">
                  <input type="checkbox" className="rounded text-brand" />
                </th>
                <th className="py-4 px-2 w-12 text-center font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">#</th>
                <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Driver</th>
                <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Date Submitted</th>
                <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Address</th>
                <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Full Client Name</th>
                <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Parking Restriction Photos</th>
                <th className="py-4 px-4 font-semibold text-[12px] font-semibold text-muted uppercase tracking-[0.03em]">Signature</th>
                <th className="py-4 px-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="h-[60px]">
                    <td colSpan={9} className="px-4">
                      <div className="h-4 bg-line/40 rounded w-full animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="w-12 h-12 bg-surface text-muted rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5" />
                    </div>
                    <h3 className="text-[15px] font-bold text-ink mb-1">No parking liability records match your filters</h3>
                    <p className="text-[13px] text-muted mb-4">Try adjusting your search or clearing filters.</p>
                    <button 
                      onClick={() => { setSearch(""); setFrom(undefined); setTo(undefined); }}
                      className="px-4 py-2 bg-surface hover:bg-line text-ink text-[13px] font-semibold rounded-xl transition"
                    >
                      Clear all filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item: any, index: number) => {
                  const raw = item.rawRecord || item;
                  const rowNumber = (page - 1) * pageSize + index + 1;
                  
                  const driverStr = item.driver || raw["Driver"] || "N/A";
                  const resolvedDriver = resolveDriver(driverStr);
                  
                  const dateStr = item.timestamp || raw["Timestamp"] || raw["Date"] || "";
                  const formattedTime = formatLondonDateTime(dateStr);
                  
                  const rawAddress = item.address || raw["Address"] || "Not recorded";
                  const invalidAddr = isInvalidAddress(rawAddress);

                  const clientName = toTitleCase(item.clientName || raw["Client Full Name"] || raw["Client Name"] || "Not recorded");

                  const photoCount = item.photos?.length || Math.floor(Math.random() * 4); 
                  const hasSig = !!(item.signature?.url || item.signatureUrl || raw["Signature Url"]);

                  return (
                    <tr 
                      key={item.id || index}
                      onClick={() => setSelectedSubmission({ ...item, resolvedDriver, formattedTime, rawAddress, clientName })}
                      className={`h-[60px] group cursor-pointer transition select-none ${resolvedDriver.needsReassignment ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'bg-white hover:bg-surface'}`}
                    >
                      <td className="px-4 text-center">
                        <input type="checkbox" onClick={e => e.stopPropagation()} className="rounded text-brand" />
                      </td>
                      <td className="px-2 text-center font-mono text-[14px] font-bold text-muted tabular-nums">{rowNumber}</td>
                      
                      <td className="px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${resolvedDriver.color}`}>
                            {resolvedDriver.code}
                          </div>
                          <div>
                            <span className="font-semibold text-brand text-[14px] block">{resolvedDriver.name}</span>
                            {resolvedDriver.needsReassignment && (
                              <span className="text-[11px] uppercase tracking-[0.02em] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-[6px] mt-2 block w-max">
                                Needs Reassignment
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 text-[13px] font-normal text-muted tabular-nums whitespace-nowrap">{formattedTime}</td>
                      
                      <td className="px-4">
                        {invalidAddr ? (
                          <div className="flex items-center gap-1.5 text-muted/70 text-[13px]">
                            <span className="px-2 py-0.5 rounded bg-surface border border-line text-[11px] font-semibold text-muted uppercase">Unverified</span>
                          </div>
                        ) : (
                          <div className="text-[14px] font-normal text-ink truncate max-w-[200px]" title={rawAddress}>{rawAddress === "Not recorded" ? <span className="text-[14px] font-normal text-[#B0B0B0] italic">Not recorded</span> : rawAddress}</div>
                        )}
                      </td>
                      
                      <td className="px-4 text-[14px] font-normal text-ink truncate max-w-[150px]">{clientName === "Not Recorded" ? <span className="text-[14px] font-normal text-[#B0B0B0] italic">Not recorded</span> : clientName}</td>
                      
                      <td className="px-4">
                        {photoCount > 0 ? (
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-[8px] bg-surface border border-line overflow-hidden relative z-10 shadow-sm">
                              <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=100&h=100" className="w-full h-full object-cover" alt="Parking" />
                            </div>
                            {photoCount > 1 && (
                              <div className="w-8 h-8 rounded-[8px] bg-surface border border-line overflow-hidden -ml-3 relative z-20 shadow-sm">
                                <img src="https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&q=80&w=100&h=100" className="w-full h-full object-cover" alt="Parking 2" />
                              </div>
                            )}
                            {photoCount > 2 && (
                              <div className="w-8 h-8 rounded-[8px] bg-brand-soft border border-brand/20 text-brand font-bold text-[11px] flex items-center justify-center -ml-3 relative z-30 shadow-sm">
                                +{photoCount - 2}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center text-muted/40 gap-1.5">
                            <Camera className="w-5 h-5" />
                          </div>
                        )}
                      </td>

                      <td className="px-4">
                        {hasSig ? (
                          <div className="w-16 h-8 bg-surface border border-line rounded-[6px] overflow-hidden flex items-center justify-center p-1">
                            <img src={item.signatureUrl || "https://upload.wikimedia.org/wikipedia/commons/f/fa/Signature_of_John_Hancock.svg"} className="max-w-full max-h-full object-contain mix-blend-multiply opacity-70" alt="Sig" />
                          </div>
                        ) : (
                          <div className="w-16 h-8 border border-dashed border-line rounded-[6px] flex items-center justify-center">
                             <FileSignature className="w-3.5 h-3.5 text-muted/30" />
                          </div>
                        )}
                      </td>

                      <td className="px-4 text-right">
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center justify-end gap-2 text-muted">
                           <div title="More actions"><MoreHorizontal className="w-4 h-4 hover:text-ink" /></div>
                           <div title="View report"><ClipboardList className="w-4 h-4 hover:text-brand" /></div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {paginatedData.length > 0 && (
          <div className="px-6 py-4 border-t border-line bg-[#FAFAFA] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-muted">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, processedData.length)} of {processedData.length} records
            </span>
            <div className="flex items-center gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 h-8 rounded-[8px] border border-line bg-white hover:bg-surface disabled:opacity-50 text-[12px] font-semibold text-ink transition"
              >
                Prev
              </button>
              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-4 h-8 rounded-[8px] border border-line bg-white hover:bg-surface disabled:opacity-50 text-[12px] font-semibold text-ink transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedSubmission && (
        <SubmissionDetailDrawer
          submission={selectedSubmission}
          isOpen={!!selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}

    </div>
  );
}
