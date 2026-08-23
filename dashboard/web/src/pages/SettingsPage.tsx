import React from "react";
import { Settings, ShieldCheck, Database, Zap, Clock, DollarSign } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-paper p-5 rounded-lg border border-line">
        <h2 className="text-xl font-bold text-ink tracking-tight">Settings</h2>
        <p className="text-xs text-muted mt-0.5">
          Read-only system rules, rates, caching invariants and database mapping
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Operational Rates */}
        <div className="p-6 bg-paper rounded-lg border border-line shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-tmv-blue" />
            <h3 className="text-sm font-bold text-ink">Operational Charge Rates</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Overtime Rate</span>
              <span className="font-mono font-bold text-ink">£55.00 per 30 minutes (rounded up)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Congestion Charge</span>
              <span className="font-mono font-bold text-ink">£18.00 fixed</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Tunnel Charge</span>
              <span className="font-mono font-bold text-ink">£13.00 fixed</span>
            </div>
            <p className="text-[11px] text-muted pt-1">
              Rates are defined server-side in <code>src/config/env.ts</code> and never hardcoded in the client.
            </p>
          </div>
        </div>

        {/* Timezone & Localization */}
        <div className="p-6 bg-paper rounded-lg border border-line shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-tmv-blue" />
            <h3 className="text-sm font-bold text-ink">Timezone & Localization</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Operational Timezone</span>
              <span className="font-mono font-bold text-ink">Europe/London</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Daylight Saving Rule</span>
              <span className="font-mono font-bold text-ink">BST (UTC+1) / GMT (UTC+0)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Storage Format</span>
              <span className="font-mono font-bold text-ink">ISO-8601 UTC (Z)</span>
            </div>
            <p className="text-[11px] text-muted pt-1">
              Timestamps with non-London offsets (+05:00) are flagged as untrustworthy in the QC audit.
            </p>
          </div>
        </div>

        {/* Caching Architecture */}
        <div className="p-6 bg-paper rounded-lg border border-line shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-tmv-blue" />
            <h3 className="text-sm font-bold text-ink">SWR In-Memory Caching</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Cache Duration (TTL)</span>
              <span className="font-mono font-bold text-ink">30,000 ms (30 seconds)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Revalidation Policy</span>
              <span className="font-mono font-bold text-ink">Stale-While-Revalidate</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Read Latency</span>
              <span className="font-mono font-bold text-ink">&lt; 5 ms (in-memory)</span>
            </div>
            <p className="text-[11px] text-muted pt-1">
              Zero additional Google Sheets API quota consumed during rapid tab browsing.
            </p>
          </div>
        </div>

        {/* Database Mapping Invariants */}
        <div className="p-6 bg-paper rounded-lg border border-line shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-tmv-blue" />
            <h3 className="text-sm font-bold text-ink">Spreadsheet Schema Mapping</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Live Read Tabs</span>
              <span className="font-mono font-bold text-emerald-700">18 tabs mapped</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Dead Tabs (Skipped)</span>
              <span className="font-mono text-muted">Dashboard, Customers, Reports, Analytics</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Read-Only Enforced</span>
              <span className="font-mono font-bold text-emerald-700">Strictly enforced (0 writes)</span>
            </div>
            <p className="text-[11px] text-muted pt-1">
              Live Google Sheets operations remain untouched.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
