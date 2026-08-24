import React, { useState } from "react";
import { DollarSign, Clock, Zap, Database, Plus } from "lucide-react";

export function SettingsPage() {
  // --- Editable State for Operational Charge Rates ---
  const [rates, setRates] = useState({
    manVan: 45.00,
    twoManVan: 55.00,
    threeManVan: 65.00,
    packing: 95.00,
    applyPackingAdditional: true,
    overtimeSource: "crew",
    overtimeCustomRate: 55.00,
    gracePeriod: 0,
    roundingRule: "round_up_30",
    congestion: 18.00,
    tunnel: 13.00,
  });

  const updateRate = (key: keyof typeof rates, value: any) => {
    setRates(prev => ({ ...prev, [key]: value }));
  };

  const InputNode = ({ value, onChange, type = "number", className = "" }: any) => (
    <div className="relative flex items-center">
      {type === "number" && <span className="absolute left-2 text-[#6B7280] text-[14px] font-semibold select-none">£</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value)}
        className={`${type === 'number' ? 'pl-5 w-20' : 'px-2'} py-1 text-[14px] font-semibold tabular-nums text-ink bg-transparent hover:bg-surface focus:bg-white border border-transparent hover:border-line focus:border-brand rounded-[6px] outline-none transition-colors text-right ${className}`}
      />
    </div>
  );

  const SelectNode = ({ value, onChange, options }: any) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="py-1 px-2 text-[14px] font-semibold tabular-nums text-ink bg-transparent hover:bg-surface focus:bg-white border border-transparent hover:border-line focus:border-brand rounded-[6px] outline-none transition-colors text-right appearance-none cursor-pointer"
      style={{ textAlignLast: "right" }}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto py-2 pb-12">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-[20px] border border-line shadow-sm">
        <h2 className="text-[20px] text-ink font-bold tracking-tight mb-1">Settings</h2>
        <p className="text-[13px] font-normal text-muted">
          Configure operational rates, timezone, and system behavior. Pricing changes apply to new jobs immediately.
        </p>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* Card 1: Operational Charge Rates */}
        <div className="bg-white rounded-[20px] border border-line shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex flex-col">
          <div className="p-6">
            <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-5">
              <DollarSign className="w-5 h-5 text-muted" /> Operational Charge Rates
            </h3>
            
            {/* Crew Rates */}
            <div className="mb-6">
              <h4 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Crew Rates</h4>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Man + Van (1 driver)</span>
                <div className="flex items-center gap-2">
                  <InputNode value={rates.manVan} onChange={(v: number) => updateRate("manVan", v)} />
                  <SelectNode value="per_30" onChange={() => {}} options={[{value:"per_30", label:"Per 30 minutes"}, {value:"per_hour", label:"Per hour"}]} />
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Two Man + Van (2 people)</span>
                <div className="flex items-center gap-2">
                  <InputNode value={rates.twoManVan} onChange={(v: number) => updateRate("twoManVan", v)} />
                  <SelectNode value="per_30" onChange={() => {}} options={[{value:"per_30", label:"Per 30 minutes"}, {value:"per_hour", label:"Per hour"}]} />
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Three Man + Van (3 people)</span>
                <div className="flex items-center gap-2">
                  <InputNode value={rates.threeManVan} onChange={(v: number) => updateRate("threeManVan", v)} />
                  <SelectNode value="per_30" onChange={() => {}} options={[{value:"per_30", label:"Per 30 minutes"}, {value:"per_hour", label:"Per hour"}]} />
                </div>
              </div>
            </div>

            {/* Packing / Full Service */}
            <div className="mb-6">
              <h4 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Packing / Full Service</h4>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Full/Packing Service</span>
                <div className="flex items-center gap-2">
                  <InputNode value={rates.packing} onChange={(v: number) => updateRate("packing", v)} />
                  <SelectNode value="per_hour" onChange={() => {}} options={[{value:"per_hour", label:"Per hour"}]} />
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Apply as additional charge when job exceeds booked time</span>
                <input 
                  type="checkbox" 
                  checked={rates.applyPackingAdditional} 
                  onChange={e => updateRate("applyPackingAdditional", e.target.checked)} 
                  className="w-4 h-4 text-brand rounded border-line focus:ring-brand"
                />
              </div>
            </div>

            {/* Overtime Rules */}
            <div className="mb-6">
              <h4 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Overtime Rules</h4>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Overtime Source</span>
                <div className="flex items-center gap-2">
                  {rates.overtimeSource === "custom" && <InputNode value={rates.overtimeCustomRate} onChange={(v: number) => updateRate("overtimeCustomRate", v)} />}
                  <SelectNode 
                    value={rates.overtimeSource} 
                    onChange={(v: string) => updateRate("overtimeSource", v)} 
                    options={[
                      {value:"crew", label:"Use job's own crew-tier rate"},
                      {value:"custom", label:"Custom overtime rate"}
                    ]} 
                  />
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Grace Period (minutes)</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={rates.gracePeriod} 
                    onChange={e => updateRate("gracePeriod", parseInt(e.target.value) || 0)} 
                    className="w-16 py-1 px-2 text-[14px] font-semibold tabular-nums text-ink bg-transparent hover:bg-surface focus:bg-white border border-transparent hover:border-line focus:border-brand rounded-[6px] outline-none transition-colors text-right"
                  />
                  <span className="text-[14px] font-semibold tabular-nums text-ink">mins</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Rounding Rule</span>
                <SelectNode 
                  value={rates.roundingRule} 
                  onChange={(v: string) => updateRate("roundingRule", v)} 
                  options={[
                    {value:"round_up_30", label:"Round up to nearest 30 min"},
                    {value:"round_up_60", label:"Round up to nearest hour"},
                    {value:"exact", label:"Exact time"}
                  ]} 
                />
              </div>
            </div>

            {/* Fixed Extra Charges */}
            <div className="mb-2">
              <h4 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Fixed Extra Charges</h4>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Congestion Charge</span>
                <div className="flex items-center gap-2">
                  <InputNode value={rates.congestion} onChange={(v: number) => updateRate("congestion", v)} />
                  <span className="text-[14px] font-semibold tabular-nums text-ink w-10 text-right">fixed</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Tunnel Charge</span>
                <div className="flex items-center gap-2">
                  <InputNode value={rates.tunnel} onChange={(v: number) => updateRate("tunnel", v)} />
                  <span className="text-[14px] font-semibold tabular-nums text-ink w-10 text-right">fixed</span>
                </div>
              </div>
              <div className="py-3">
                <button className="flex items-center gap-1.5 text-[13px] font-medium text-brand hover:text-blue-700 transition">
                  <Plus className="w-4 h-4" /> Add Charge Type
                </button>
              </div>
            </div>
            
          </div>
          <div className="p-6 pt-0 mt-auto">
            <p className="text-[12px] font-normal text-muted italic">
              Last updated by Washington Carrato on 24/08/2026, 09:12
            </p>
          </div>
        </div>

        {/* Read Only Cards Column */}
        <div className="space-y-6 flex flex-col">
          {/* Card 2: Timezone & Localization */}
          <div className="bg-white rounded-[20px] border border-line shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex flex-col">
            <div className="p-6">
              <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-5">
                <Clock className="w-5 h-5 text-muted" /> Timezone & Localization
              </h3>
              
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Operational Timezone</span>
                <span className="text-[14px] font-semibold tabular-nums text-ink">Europe/London</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Daylight Saving Rule</span>
                <span className="text-[14px] font-semibold tabular-nums text-ink">BST (UTC+1) / GMT (UTC+0)</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Storage Format</span>
                <span className="text-[14px] font-semibold tabular-nums text-ink">ISO-8601 UTC (Z)</span>
              </div>
            </div>
            <div className="p-6 pt-0 mt-auto">
              <p className="text-[12px] font-normal text-muted italic">
                Timestamps with non-London offsets (+05:00) are flagged as untrustworthy in the QC audit.
              </p>
            </div>
          </div>

          {/* Card 3: SWR In-Memory Caching */}
          <div className="bg-white rounded-[20px] border border-line shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex flex-col">
            <div className="p-6">
              <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-5">
                <Zap className="w-5 h-5 text-muted" /> SWR In-Memory Caching
              </h3>
              
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Cache Duration (TTL)</span>
                <span className="text-[14px] font-semibold tabular-nums text-ink">30,000 ms (30 seconds)</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Revalidation Policy</span>
                <span className="text-[14px] font-semibold tabular-nums text-ink">Stale-While-Revalidate</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Read Latency</span>
                <span className="text-[14px] font-semibold tabular-nums text-ink">&lt; 5 ms (in-memory)</span>
              </div>
            </div>
            <div className="p-6 pt-0 mt-auto">
              <p className="text-[12px] font-normal text-muted italic">
                Zero additional Google Sheets API quota consumed during rapid tab browsing.
              </p>
            </div>
          </div>

          {/* Card 4: Spreadsheet Schema Mapping */}
          <div className="bg-white rounded-[20px] border border-line shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex flex-col">
            <div className="p-6">
              <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-5">
                <Database className="w-5 h-5 text-muted" /> Spreadsheet Schema Mapping
              </h3>
              
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Live Read Tabs</span>
                <span className="text-[13px] font-semibold tabular-nums text-status-green">18 tabs mapped</span>
              </div>
              <div className="flex justify-between items-start py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280] mt-0.5">Dead Tabs<br/><span className="text-[11px] font-normal">(Skipped)</span></span>
                <span className="text-[14px] font-semibold tabular-nums text-ink text-right max-w-[200px]">Dashboard, Customers, Reports, Analytics</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-line last:border-b-0">
                <span className="text-[13px] font-medium text-[#6B7280]">Read-Only Enforced</span>
                <span className="text-[13px] font-semibold tabular-nums text-status-green">Strictly enforced (0 writes)</span>
              </div>
            </div>
            <div className="p-6 pt-0 mt-auto">
              <p className="text-[12px] font-normal text-muted italic">
                Live Google Sheets operations remain untouched.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
