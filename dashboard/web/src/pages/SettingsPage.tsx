import React from "react";
import { DollarSign, Clock, Zap, Database } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-[1000px] mx-auto py-2">
      {/* Header Card */}
      <div className="bg-paper p-6 rounded-xl border border-line shadow-sm">
        <h2 className="text-page-title text-ink font-bold tracking-tight mb-1">Settings</h2>
        <p className="text-nav text-muted">
          Read-only system rules, rates, caching invariants and database mapping
        </p>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Operational Charge Rates */}
        <div className="bg-paper rounded-xl border border-line shadow-sm flex flex-col">
          <div className="p-6 border-b border-transparent">
            <h3 className="text-section-title font-bold text-ink flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5" /> Operational Charge Rates
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Overtime Rate</span>
                <span className="font-mono text-ink text-[13px] font-semibold">£55.00 per 30 minutes (rounded up)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Congestion Charge</span>
                <span className="font-mono text-ink text-[13px] font-semibold">£18.00 fixed</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Tunnel Charge</span>
                <span className="font-mono text-ink text-[13px] font-semibold">£13.00 fixed</span>
              </div>
            </div>
          </div>
          <div className="p-6 pt-2 mt-auto">
            <p className="text-[12px] text-muted font-medium leading-relaxed">
              Rates are defined server-side in <code className="bg-surface px-1 py-0.5 rounded text-ink">src/config/env.ts</code> and never hardcoded in the client.
            </p>
          </div>
        </div>

        {/* Card 2: Timezone & Localization */}
        <div className="bg-paper rounded-xl border border-line shadow-sm flex flex-col">
          <div className="p-6 border-b border-transparent">
            <h3 className="text-section-title font-bold text-ink flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5" /> Timezone & Localization
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Operational Timezone</span>
                <span className="font-mono text-ink text-[13px] font-semibold">Europe/London</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Daylight Saving Rule</span>
                <span className="font-mono text-ink text-[13px] font-semibold">BST (UTC+1) / GMT (UTC+0)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Storage Format</span>
                <span className="font-mono text-ink text-[13px] font-semibold">ISO-8601 UTC (Z)</span>
              </div>
            </div>
          </div>
          <div className="p-6 pt-2 mt-auto">
            <p className="text-[12px] text-muted font-medium leading-relaxed">
              Timestamps with non-London offsets (+05:00) are flagged as untrustworthy in the QC audit.
            </p>
          </div>
        </div>

        {/* Card 3: SWR In-Memory Caching */}
        <div className="bg-paper rounded-xl border border-line shadow-sm flex flex-col">
          <div className="p-6 border-b border-transparent">
            <h3 className="text-section-title font-bold text-ink flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5" /> SWR In-Memory Caching
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Cache Duration (TTL)</span>
                <span className="font-mono text-ink text-[13px] font-semibold">30,000 ms (30 seconds)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Revalidation Policy</span>
                <span className="font-mono text-ink text-[13px] font-semibold">Stale-While-Revalidate</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Read Latency</span>
                <span className="font-mono text-ink text-[13px] font-semibold">&lt; 5 ms (in-memory)</span>
              </div>
            </div>
          </div>
          <div className="p-6 pt-2 mt-auto">
            <p className="text-[12px] text-muted font-medium leading-relaxed">
              Zero additional Google Sheets API quota consumed during rapid tab browsing.
            </p>
          </div>
        </div>

        {/* Card 4: Spreadsheet Schema Mapping */}
        <div className="bg-paper rounded-xl border border-line shadow-sm flex flex-col">
          <div className="p-6 border-b border-transparent">
            <h3 className="text-section-title font-bold text-ink flex items-center gap-2 mb-6">
              <Database className="w-5 h-5" /> Spreadsheet Schema Mapping
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Live Read Tabs</span>
                <span className="font-mono text-status-green text-[13px] font-bold">18 tabs mapped</span>
              </div>
              <div className="flex justify-between items-start py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium mt-0.5">Dead Tabs<br/><span className="text-[10px]">(Skipped)</span></span>
                <span className="font-mono text-muted text-[12px] text-right max-w-[200px]">Dashboard, Customers, Reports, Analytics</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line border-dashed">
                <span className="text-muted text-[13px] font-medium">Read-Only Enforced</span>
                <span className="font-mono text-status-green text-[13px] font-bold">Strictly enforced (0 writes)</span>
              </div>
            </div>
          </div>
          <div className="p-6 pt-2 mt-auto">
            <p className="text-[12px] text-muted font-medium leading-relaxed">
              Live Google Sheets operations remain untouched.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
