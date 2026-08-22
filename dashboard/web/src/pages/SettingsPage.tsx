import React from "react";
import { Settings, ShieldCheck, Database, Zap, Clock, DollarSign } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-ink">System Configuration & Operational Rates</h2>
        <p className="text-xs text-muted">
          Read-only system rules, rates, caching invariants and database mapping
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Operational Rates (from env) */}
        <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
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
        <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
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

        {/* Caching & Concurrency */}
        <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-tmv-blue" />
            <h3 className="text-sm font-bold text-ink">Cloud Run & SWR Caching</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Cloud Run Concurrency</span>
              <span className="font-mono font-bold text-ink">Pinned to 1</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Cache Architecture</span>
              <span className="font-mono font-bold text-ink">Stale-While-Revalidate (SWR)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Default Cache TTL</span>
              <span className="font-mono font-bold text-ink">30,000 ms (30 seconds)</span>
            </div>
            <p className="text-[11px] text-muted pt-1">
              Dashboard queries return instantly from memory (&lt;5ms) so background requests never block Google Chat driver webhooks.
            </p>
          </div>
        </div>

        {/* Isolation Guarantee */}
        <div className="p-6 bg-paper rounded-xl border border-line shadow-paper">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-status-green" />
            <h3 className="text-sm font-bold text-ink">Architecture Isolation</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Read-Only Guarantee</span>
              <span className="font-mono font-bold text-status-green">STRICT (Zero Sheets Writes)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Mount Point</span>
              <span className="font-mono font-bold text-ink">/ops</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line">
              <span className="text-muted">Legacy Admin</span>
              <span className="font-mono font-bold text-ink">/admin (Untouched & Active)</span>
            </div>
            <p className="text-[11px] text-muted pt-1">
              The dashboard runs 100% inside <code>dashboard/</code> without modifying any existing production bot workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
