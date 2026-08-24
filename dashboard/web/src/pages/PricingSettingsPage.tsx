import React, { useState, useEffect } from "react";
import { Save, AlertTriangle, RotateCcw, Box, Users, Calculator, ArrowRight, ExternalLink, ShieldCheck, Clock } from "lucide-react";

export function PricingSettingsPage() {
  const [crewRates, setCrewRates] = useState([
    { id: "man_van", name: "Man + Van", crewLabel: "1 driver", rate: 45, unit: "Per 30 minutes", active: true },
    { id: "two_man", name: "Two Man + Van", crewLabel: "2 people", rate: 55, unit: "Per 30 minutes", active: true },
    { id: "three_man", name: "Three Man + Van", crewLabel: "3 people", rate: 65, unit: "Per 30 minutes", active: true }
  ]);
  
  const [packing, setPacking] = useState({
    rate: 95,
    unit: "Per hour",
    additive: true
  });
  
  const [overtime, setOvertime] = useState({
    source: "crew",
    customRate: 0,
    gracePeriod: 0
  });

  const [savedState, setSavedState] = useState({
    crewRates,
    packing,
    overtime
  });

  const isCrewUnsaved = JSON.stringify(crewRates) !== JSON.stringify(savedState.crewRates);
  const isPackingUnsaved = JSON.stringify(packing) !== JSON.stringify(savedState.packing);
  const isOvertimeUnsaved = JSON.stringify(overtime) !== JSON.stringify(savedState.overtime);
  
  const anyUnsaved = isCrewUnsaved || isPackingUnsaved || isOvertimeUnsaved;

  // Impact Preview Calculator State
  const [calcCrew, setCalcCrew] = useState("two_man");
  const [calcDurationMins, setCalcDurationMins] = useState(120);
  const [calcOvertimeMins, setCalcOvertimeMins] = useState(30);
  const [calcPacking, setCalcPacking] = useState(false);

  const calculatePreview = () => {
    let total = 0;
    const selectedCrew = crewRates.find(c => c.id === calcCrew) || crewRates[0];
    
    // Base Crew Cost
    const getUnitMins = (u: string) => u === "Per hour" ? 60 : 30;
    const baseUnitMins = getUnitMins(selectedCrew.unit);
    const basePeriods = Math.ceil(calcDurationMins / baseUnitMins);
    total += basePeriods * selectedCrew.rate;

    // Overtime
    let overtimeTotal = 0;
    if (calcOvertimeMins > overtime.gracePeriod) {
       const billableOvertime = calcOvertimeMins; // Could deduct grace, but usually grace just delays the trigger
       if (overtime.source === "crew") {
         const otPeriods = Math.ceil(billableOvertime / baseUnitMins);
         overtimeTotal += otPeriods * selectedCrew.rate;
       } else {
         // Custom Rate (Assuming per 30 mins for simplicity, or per hour based on a missing config. Let's assume Per 30 mins)
         const otPeriods = Math.ceil(billableOvertime / 30);
         overtimeTotal += otPeriods * overtime.customRate;
       }
       total += overtimeTotal;
    }

    // Packing
    let packingTotal = 0;
    if (calcPacking) {
       const packUnitMins = getUnitMins(packing.unit);
       // Typically packing is billed for the whole duration or a separate duration? Assuming same base duration for this preview.
       const packPeriods = Math.ceil((calcDurationMins + calcOvertimeMins) / packUnitMins);
       packingTotal = packPeriods * packing.rate;
       if (packing.additive) {
         total += packingTotal;
       } else {
         total = packingTotal; // Replaces base rate
       }
    }

    return { total, baseCost: total - overtimeTotal - packingTotal, overtimeTotal, packingTotal };
  };

  const preview = calculatePreview();

  const handleSaveAll = () => {
    setSavedState({
      crewRates: [...crewRates.map(c => ({...c}))],
      packing: {...packing},
      overtime: {...overtime}
    });
    // In a real app, API call goes here
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-white p-6 rounded-[20px] border border-line shadow-sm flex items-start justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-ink mb-1">Pricing Settings</h2>
          <p className="text-[14px] text-muted max-w-3xl">
            Configure crew rates, packing service pricing, and overtime rules. Changes apply to all new jobs immediately — no developer or redeployment required.
          </p>
        </div>
        {anyUnsaved && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 text-[13px] font-semibold">
            <AlertTriangle className="w-4 h-4" /> Unsaved changes
          </div>
        )}
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* LEFT COLUMN (Settings) */}
        <div className="flex-1 space-y-6">
          
          {/* SECTION 1: CREW RATES */}
          <div className="bg-white rounded-[20px] border border-line shadow-sm overflow-hidden flex flex-col relative">
             <div className="p-5 border-b border-line flex items-center justify-between bg-[#FAFAFA]">
               <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                 <Users className="w-4 h-4 text-brand" />
                 Base Crew Rates
                 {isCrewUnsaved && <span className="w-2 h-2 rounded-full bg-status-red" title="Unsaved changes"></span>}
               </h3>
               <div className="text-[11px] text-muted font-medium uppercase tracking-wider">
                 Last updated: Today by Admin
               </div>
             </div>

             <div className="p-6 space-y-5">
               {crewRates.map((crew, idx) => (
                 <div key={crew.id} className="flex flex-wrap md:flex-nowrap items-end gap-4 p-4 rounded-xl border border-line bg-surface/50">
                    <div className="w-full md:w-1/3">
                      <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">{crew.name}</label>
                      <div className="h-10 px-3 rounded-lg border border-line bg-white flex items-center text-[13px] text-ink font-medium">
                        {crew.crewLabel}
                      </div>
                    </div>
                    
                    <div className="w-full md:w-1/4">
                      <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Rate (£)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-semibold">£</span>
                        <input 
                          type="number" 
                          min="0"
                          value={crew.rate || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const next = [...crewRates];
                            next[idx].rate = isNaN(val) ? 0 : val;
                            setCrewRates(next);
                          }}
                          className="w-full h-10 pl-8 pr-3 rounded-lg border border-line bg-white text-[14px] font-mono text-ink outline-none focus:border-brand transition"
                        />
                      </div>
                    </div>

                    <div className="w-full md:w-1/4">
                      <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Billing Unit</label>
                      <select 
                        value={crew.unit}
                        onChange={(e) => {
                          const next = [...crewRates];
                          next[idx].unit = e.target.value;
                          setCrewRates(next);
                        }}
                        className="w-full h-10 px-3 rounded-lg border border-line bg-white text-[13px] text-ink outline-none focus:border-brand transition appearance-none"
                      >
                        <option>Per 30 minutes</option>
                        <option>Per hour</option>
                        <option>Per job (Fixed)</option>
                      </select>
                    </div>

                    <div className="w-full md:w-auto flex items-center h-10 gap-2 pl-2">
                       <label className="flex items-center gap-2 cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={crew.active}
                           onChange={(e) => {
                             const next = [...crewRates];
                             next[idx].active = e.target.checked;
                             setCrewRates(next);
                           }}
                           className="w-4 h-4 text-brand rounded focus:ring-brand"
                         />
                         <span className="text-[13px] font-semibold text-ink">Active</span>
                       </label>
                    </div>
                 </div>
               ))}
             </div>
          </div>

          {/* SECTION 2: PACKING SERVICE */}
          <div className="bg-white rounded-[20px] border border-line shadow-sm overflow-hidden flex flex-col relative">
             <div className="p-5 border-b border-line flex items-center justify-between bg-[#FAFAFA]">
               <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                 <Box className="w-4 h-4 text-brand" />
                 Full / Packing Service
                 {isPackingUnsaved && <span className="w-2 h-2 rounded-full bg-status-red" title="Unsaved changes"></span>}
               </h3>
             </div>

             <div className="p-6 space-y-5">
                <p className="text-[13px] text-muted">
                  This service can be applied automatically or requested by the customer. It typically operates independently from crew sizes.
                </p>
                <div className="flex flex-wrap md:flex-nowrap items-start gap-4 p-4 rounded-xl border border-brand/20 bg-brand-soft/20">
                    <div className="w-full md:w-1/3">
                      <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Service Rate (£)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-semibold">£</span>
                        <input 
                          type="number" 
                          min="0"
                          value={packing.rate || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPacking({...packing, rate: isNaN(val) ? 0 : val});
                          }}
                          className="w-full h-10 pl-8 pr-3 rounded-lg border border-line bg-white text-[14px] font-mono text-ink outline-none focus:border-brand transition"
                        />
                      </div>
                    </div>

                    <div className="w-full md:w-1/3">
                      <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Billing Unit</label>
                      <select 
                        value={packing.unit}
                        onChange={(e) => setPacking({...packing, unit: e.target.value})}
                        className="w-full h-10 px-3 rounded-lg border border-line bg-white text-[13px] text-ink outline-none focus:border-brand transition appearance-none"
                      >
                        <option>Per 30 minutes</option>
                        <option>Per hour</option>
                        <option>Per job (Fixed)</option>
                      </select>
                    </div>

                    <div className="w-full pt-6">
                       <label className="flex items-center gap-2 cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={packing.additive}
                           onChange={(e) => setPacking({...packing, additive: e.target.checked})}
                           className="w-4 h-4 text-brand rounded focus:ring-brand"
                         />
                         <span className="text-[13px] font-semibold text-ink">Apply as additional charge (stacks on top of base crew rate)</span>
                       </label>
                    </div>
                </div>
             </div>
          </div>

          {/* SECTION 3: OVERTIME RULES */}
          <div className="bg-white rounded-[20px] border border-line shadow-sm overflow-hidden flex flex-col relative">
             <div className="p-5 border-b border-line flex items-center justify-between bg-[#FAFAFA]">
               <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                 <Clock className="w-4 h-4 text-brand" />
                 Overtime Rules
                 {isOvertimeUnsaved && <span className="w-2 h-2 rounded-full bg-status-red" title="Unsaved changes"></span>}
               </h3>
             </div>

             <div className="p-6 space-y-6">
                <div className="p-3.5 bg-surface border border-line rounded-xl text-[13px] text-muted flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-ink shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink font-semibold">Automated Time Engine</strong>
                    <p className="mt-1">Drivers enter overtime as a duration (e.g., '30 minutes', '1 hour'). The system calculates the charge automatically using the job's booked time, actual start/finish timestamps, the driver's entered duration, and the rules below — drivers never calculate the price themselves.</p>
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-start gap-6">
                    <div className="w-full md:w-1/2 space-y-4">
                      <div>
                        <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Overtime Rate Source</label>
                        <select 
                          value={overtime.source}
                          onChange={(e) => setOvertime({...overtime, source: e.target.value})}
                          className="w-full h-10 px-3 rounded-lg border border-line bg-white text-[13px] text-ink outline-none focus:border-brand transition appearance-none"
                        >
                          <option value="crew">Use Job's Base Crew Rate</option>
                          <option value="custom">Flat Custom Rate</option>
                        </select>
                      </div>
                      
                      {overtime.source === "custom" && (
                        <div>
                          <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Custom Overtime Rate (£)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-semibold">£</span>
                            <input 
                              type="number" 
                              min="0"
                              value={overtime.customRate || ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setOvertime({...overtime, customRate: isNaN(val) ? 0 : val});
                              }}
                              className="w-full h-10 pl-8 pr-3 rounded-lg border border-line bg-white text-[14px] font-mono text-ink outline-none focus:border-brand transition"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-1/2 space-y-4">
                      <div>
                        <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Grace Period (Minutes)</label>
                        <input 
                          type="number" 
                          min="0"
                          value={overtime.gracePeriod || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setOvertime({...overtime, gracePeriod: isNaN(val) ? 0 : val});
                          }}
                          className="w-full h-10 px-3 rounded-lg border border-line bg-white text-[14px] font-mono text-ink outline-none focus:border-brand transition"
                        />
                        <p className="text-[11px] text-muted mt-1.5">Allow N minutes over booked time before charges apply.</p>
                      </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-line text-[12px] text-muted flex items-center justify-between">
                  <span>Driver-entered overtime is cross-checked against actual recorded start/finish timestamps. Large discrepancies are flagged.</span>
                  <a href="/?section=exceptions" className="text-[#2563EB] font-semibold hover:underline flex items-center gap-1">View Exceptions <ExternalLink className="w-3 h-3" /></a>
                </div>
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Preview) */}
        <div className="w-full xl:w-[380px] shrink-0">
          <div className="bg-white rounded-[20px] border border-line shadow-sm overflow-hidden sticky top-6">
             <div className="p-5 border-b border-line bg-[#FAFAFA]">
               <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                 <Calculator className="w-4 h-4 text-brand" />
                 Impact Preview
               </h3>
               <p className="text-[12px] text-muted mt-1">Test your configuration instantly</p>
             </div>

             <div className="p-5 space-y-4 border-b border-line">
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Simulated Job Setup</label>
                  <select 
                    value={calcCrew}
                    onChange={e => setCalcCrew(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-line bg-surface text-[13px] text-ink outline-none focus:border-brand mb-2"
                  >
                    {crewRates.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Booked Time</label>
                    <select 
                      value={calcDurationMins}
                      onChange={e => setCalcDurationMins(parseInt(e.target.value, 10))}
                      className="w-full h-9 px-2.5 rounded-lg border border-line bg-surface text-[13px] text-ink outline-none focus:border-brand"
                    >
                      <option value={30}>30 mins</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                      <option value={180}>3 hours</option>
                      <option value={240}>4 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Overtime</label>
                    <select 
                      value={calcOvertimeMins}
                      onChange={e => setCalcOvertimeMins(parseInt(e.target.value, 10))}
                      className="w-full h-9 px-2.5 rounded-lg border border-line bg-surface text-[13px] text-ink outline-none focus:border-brand"
                    >
                      <option value={0}>None</option>
                      <option value={15}>15 mins</option>
                      <option value={30}>30 mins</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                    </select>
                  </div>
                </div>

                <div>
                   <label className="flex items-center gap-2 cursor-pointer mt-1">
                     <input 
                       type="checkbox" 
                       checked={calcPacking}
                       onChange={e => setCalcPacking(e.target.checked)}
                       className="w-4 h-4 text-brand rounded focus:ring-brand"
                     />
                     <span className="text-[13px] font-semibold text-ink">Include Packing Service</span>
                   </label>
                </div>
             </div>

             <div className="p-5 bg-surface space-y-3">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted">Base Charge</span>
                  <span className="font-mono text-ink">£{preview.baseCost.toFixed(2)}</span>
                </div>
                {preview.overtimeTotal > 0 && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted">Overtime Charge</span>
                    <span className="font-mono text-ink">£{preview.overtimeTotal.toFixed(2)}</span>
                  </div>
                )}
                {preview.packingTotal > 0 && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted">Packing Charge</span>
                    <span className="font-mono text-ink">£{preview.packingTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="h-px w-full bg-line my-1" />
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[14px] font-bold text-ink">Total Estimate</span>
                  <span className="text-[18px] font-bold font-mono text-brand">£{preview.total.toFixed(2)}</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Sticky Save Bar */}
      {anyUnsaved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-white rounded-full shadow-2xl border border-line px-5 py-3 flex items-center gap-6">
            <span className="text-[13px] font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              You have unsaved pricing changes
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setCrewRates([...savedState.crewRates.map(c => ({...c}))]);
                  setPacking({...savedState.packing});
                  setOvertime({...savedState.overtime});
                }}
                className="px-4 py-2 rounded-full text-[13px] font-bold text-muted hover:bg-surface transition"
              >
                Discard
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-6 py-2 rounded-full text-[13px] font-bold bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
