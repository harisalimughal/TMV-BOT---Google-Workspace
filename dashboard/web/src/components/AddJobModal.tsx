import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  User, 
  MapPin, 
  Calendar, 
  Users, 
  PoundSterling,
  Check,
  Search,
  ChevronDown,
  Clock,
  AlertTriangle,
  ClipboardList
} from "lucide-react";
import { getDrivers } from "../utils/drivers";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddJobModal({ isOpen, onClose }: Props) {
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    pickup: "",
    dropoff: "",
    crewSize: 2,
    price: "",
    start: "",
    finish: "",
    driverId: "" // "" means unassigned
  });

  const [driverSearchOpen, setDriverSearchOpen] = useState(false);
  const [driverSearchQuery, setDriverSearchQuery] = useState("");
  const [roster, setRoster] = useState(getDrivers());

  useEffect(() => {
    const handler = () => setRoster(getDrivers());
    window.addEventListener('roster_updated', handler);
    return () => window.removeEventListener('roster_updated', handler);
  }, []);
  const driverDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (driverDropdownRef.current && !driverDropdownRef.current.contains(event.target as Node)) {
        setDriverSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Validation logic
  const isInvalid = (field: keyof typeof form, required = true) => {
    if (!attemptedSubmit || !required) return false;
    return String(form[field]).trim() === "";
  };

  const isFinishBeforeStart = () => {
    if (!form.start || !form.finish) return false;
    return new Date(form.finish) < new Date(form.start);
  };

  const isFormValid = () => {
    return form.customerName.trim() !== "" &&
           form.pickup.trim() !== "" &&
           form.dropoff.trim() !== "" &&
           form.crewSize > 0 &&
           form.price.trim() !== "" &&
           form.start.trim() !== "" &&
           form.finish.trim() !== "" &&
           !isFinishBeforeStart();
  };

  const handleSave = () => {
    setAttemptedSubmit(true);
    if (isFormValid()) {
      // API call would go here
      onClose();
    }
  };

  const calculateDuration = () => {
    if (!form.start || !form.finish || isFinishBeforeStart()) return null;
    const diffMs = new Date(form.finish).getTime() - new Date(form.start).getTime();
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hrs > 0 ? `${hrs}h ` : ""}${mins}m`;
  };

  const selectedDriver = roster.find(d => d.code === form.driverId);
  const filteredRoster = roster.filter(d => 
    d.name.toLowerCase().includes(driverSearchQuery.toLowerCase()) || 
    d.code.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
    d.vehicleReg.toLowerCase().includes(driverSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[520px] flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-line flex items-center justify-between bg-white rounded-t-[24px] z-10 sticky top-0">
          <h2 className="text-[18px] font-bold text-ink">Add Job</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted hover:text-ink hover:bg-surface rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* 1. CUSTOMER DETAILS */}
          <section className="bg-[#F7F7F7] p-5 rounded-[12px]">
            <h3 className="text-[12px] font-semibold uppercase text-muted tracking-wider flex items-center gap-1.5 mb-4">
              <User className="w-3.5 h-3.5" /> Customer Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">
                  Customer name <span className="text-status-red">*</span>
                </label>
                <input 
                  type="text" 
                  value={form.customerName}
                  onChange={e => setForm({...form, customerName: e.target.value})}
                  className={`w-full h-10 px-3 rounded-[8px] border bg-white text-[14px] outline-none transition placeholder:text-muted/50 ${
                    isInvalid("customerName") ? "border-status-red ring-1 ring-status-red" : "border-line focus:border-brand focus:ring-1 focus:ring-brand"
                  }`} 
                  placeholder="e.g. John Smith" 
                />
                {isInvalid("customerName") && <p className="text-[11px] text-status-red mt-1.5">Customer name is required</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5">Customer email</label>
                  <input 
                    type="email" 
                    value={form.customerEmail}
                    onChange={e => setForm({...form, customerEmail: e.target.value})}
                    className="w-full h-10 px-3 rounded-[8px] border border-line bg-white text-[14px] outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-muted/50" 
                    placeholder="john@example.com" 
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5">Customer phone</label>
                  <input 
                    type="tel" 
                    value={form.customerPhone}
                    onChange={e => setForm({...form, customerPhone: e.target.value})}
                    className="w-full h-10 px-3 rounded-[8px] border border-line bg-white text-[14px] outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-muted/50" 
                    placeholder="07123 456789" 
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 2. ROUTE */}
          <section className="bg-[#F7F7F7] p-5 rounded-[12px]">
            <h3 className="text-[12px] font-semibold uppercase text-muted tracking-wider flex items-center gap-1.5 mb-4">
              <MapPin className="w-3.5 h-3.5" /> Route
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">
                  Pickup address <span className="text-status-red">*</span>
                </label>
                <input 
                  type="text" 
                  value={form.pickup}
                  onChange={e => setForm({...form, pickup: e.target.value})}
                  className={`w-full h-10 px-3 rounded-[8px] border bg-white text-[14px] outline-none transition placeholder:text-muted/50 ${
                    isInvalid("pickup") ? "border-status-red ring-1 ring-status-red" : "border-line focus:border-brand focus:ring-1 focus:ring-brand"
                  }`} 
                  placeholder="e.g. 12 High Street, London, SW1A 1AA" 
                />
                {isInvalid("pickup") && <p className="text-[11px] text-status-red mt-1.5">Pickup address is required</p>}
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">
                  Drop-off address <span className="text-status-red">*</span>
                </label>
                <input 
                  type="text" 
                  value={form.dropoff}
                  onChange={e => setForm({...form, dropoff: e.target.value})}
                  className={`w-full h-10 px-3 rounded-[8px] border bg-white text-[14px] outline-none transition placeholder:text-muted/50 ${
                    isInvalid("dropoff") ? "border-status-red ring-1 ring-status-red" : "border-line focus:border-brand focus:ring-1 focus:ring-brand"
                  }`} 
                  placeholder="e.g. 45 Park Road, Manchester, M1 2AB" 
                />
                {isInvalid("dropoff") && <p className="text-[11px] text-status-red mt-1.5">Drop-off address is required</p>}
              </div>
            </div>
          </section>

          {/* 3. JOB DETAILS */}
          <section className="bg-[#F7F7F7] p-5 rounded-[12px]">
            <h3 className="text-[12px] font-semibold uppercase text-muted tracking-wider flex items-center gap-1.5 mb-4">
              <ClipboardList className="w-3.5 h-3.5" /> Job Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">
                  Crew size <span className="text-status-red">*</span>
                </label>
                <div className="flex items-center h-10 bg-white border border-line rounded-[8px] overflow-hidden">
                  <button 
                    onClick={() => setForm({...form, crewSize: Math.max(1, form.crewSize - 1)})}
                    className="w-10 h-full flex items-center justify-center text-muted hover:bg-surface hover:text-ink transition border-r border-line"
                  >
                    -
                  </button>
                  <div className="flex-1 text-center text-[14px] font-medium text-ink">
                    {form.crewSize}
                  </div>
                  <button 
                    onClick={() => setForm({...form, crewSize: form.crewSize + 1})}
                    className="w-10 h-full flex items-center justify-center text-muted hover:bg-surface hover:text-ink transition border-l border-line"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">
                  Price <span className="text-status-red">*</span>
                </label>
                <div className={`relative flex items-center h-10 bg-white border rounded-[8px] overflow-hidden transition focus-within:border-brand focus-within:ring-1 focus-within:ring-brand ${isInvalid("price") ? "border-status-red ring-1 ring-status-red" : "border-line"}`}>
                  <span className="absolute left-3 text-muted">£</span>
                  <input 
                    type="number" 
                    value={form.price}
                    onChange={e => setForm({...form, price: e.target.value})}
                    className="w-full h-full pl-8 pr-3 text-right bg-transparent text-[14px] font-medium text-ink outline-none placeholder:text-muted/50 tabular-nums" 
                    placeholder="0.00" 
                  />
                </div>
                {isInvalid("price") && <p className="text-[11px] text-status-red mt-1.5">Price is required</p>}
              </div>
            </div>
          </section>

          {/* 4. SCHEDULE */}
          <section className="bg-[#F7F7F7] p-5 rounded-[12px]">
            <h3 className="text-[12px] font-semibold uppercase text-muted tracking-wider flex items-center gap-1.5 mb-4">
              <Clock className="w-3.5 h-3.5" /> Schedule
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5">
                    Start <span className="text-status-red">*</span>
                  </label>
                  <input 
                    type="datetime-local" 
                    value={form.start}
                    onChange={e => setForm({...form, start: e.target.value})}
                    className={`w-full h-10 px-3 rounded-[8px] border bg-white text-[14px] outline-none transition ${
                      isInvalid("start") ? "border-status-red ring-1 ring-status-red" : "border-line focus:border-brand focus:ring-1 focus:ring-brand"
                    }`} 
                  />
                  {isInvalid("start") && <p className="text-[11px] text-status-red mt-1.5">Required</p>}
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5">
                    Finish <span className="text-status-red">*</span>
                  </label>
                  <input 
                    type="datetime-local" 
                    value={form.finish}
                    onChange={e => setForm({...form, finish: e.target.value})}
                    className={`w-full h-10 px-3 rounded-[8px] border bg-white text-[14px] outline-none transition ${
                      isInvalid("finish") || isFinishBeforeStart() ? "border-status-red ring-1 ring-status-red" : "border-line focus:border-brand focus:ring-1 focus:ring-brand"
                    }`} 
                  />
                  {isInvalid("finish") && <p className="text-[11px] text-status-red mt-1.5">Required</p>}
                </div>
              </div>
              
              {isFinishBeforeStart() ? (
                <p className="text-[12px] text-status-red font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Finish time cannot be before start time
                </p>
              ) : calculateDuration() ? (
                <p className="text-[12px] text-muted font-medium">
                  Duration: {calculateDuration()}
                </p>
              ) : null}
            </div>
          </section>

          {/* 5. ASSIGNMENT */}
          <section className="bg-[#F7F7F7] p-5 rounded-[12px]">
            <h3 className="text-[12px] font-semibold uppercase text-muted tracking-wider flex items-center gap-1.5 mb-4">
              <User className="w-3.5 h-3.5" /> Assignment
            </h3>
            
            <div className="relative" ref={driverDropdownRef}>
              <label className="block text-[13px] font-medium text-ink mb-1.5">
                Driver assignment
              </label>
              
              {/* Select Trigger */}
              <button 
                onClick={() => setDriverSearchOpen(!driverSearchOpen)}
                className="w-full min-h-[40px] p-1 pr-3 bg-white border border-line rounded-[8px] flex items-center justify-between outline-none focus:border-brand focus:ring-1 focus:ring-brand transition hover:bg-surface/50"
              >
                {selectedDriver ? (
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center text-[11px] font-bold ${selectedDriver.color}`}>
                      {selectedDriver.code}
                    </div>
                    <div className="text-left">
                      <div className="text-[13px] font-medium text-ink leading-tight">{selectedDriver.name}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-2">
                    <div className="w-6 h-6 rounded-full border border-dashed border-muted/50 flex items-center justify-center text-muted">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[14px] text-ink font-medium">Unassigned — open to any driver</span>
                  </div>
                )}
                <ChevronDown className="w-4 h-4 text-muted" />
              </button>

              {/* Dropdown Menu */}
              {driverSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[12px] border border-line shadow-xl z-20 overflow-hidden flex flex-col max-h-[260px]">
                  <div className="p-2 border-b border-line sticky top-0 bg-white">
                    <div className="relative">
                      <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        autoFocus
                        value={driverSearchQuery}
                        onChange={e => setDriverSearchQuery(e.target.value)}
                        placeholder="Search roster..."
                        className="w-full h-9 pl-9 pr-3 bg-surface border-transparent rounded-[8px] text-[13px] outline-none focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand transition"
                      />
                    </div>
                  </div>
                  
                  <div className="overflow-y-auto custom-scrollbar p-1">
                    <button 
                      onClick={() => { setForm({...form, driverId: ""}); setDriverSearchOpen(false); }}
                      className={`w-full flex items-center gap-3 p-2 rounded-[8px] hover:bg-surface transition ${!form.driverId ? "bg-surface" : ""}`}
                    >
                      <div className="w-8 h-8 rounded-full border border-dashed border-muted/50 flex items-center justify-center text-muted shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-[13px] font-medium text-ink">Unassigned</div>
                        <div className="text-[11px] text-muted">Open to any driver</div>
                      </div>
                      {!form.driverId && <Check className="w-4 h-4 text-ink shrink-0" />}
                    </button>

                    {filteredRoster.map(driver => (
                      <button 
                        key={driver.code}
                        onClick={() => { setForm({...form, driverId: driver.code}); setDriverSearchOpen(false); }}
                        className={`w-full flex items-center gap-3 p-2 rounded-[8px] hover:bg-surface transition ${form.driverId === driver.code ? "bg-surface" : ""}`}
                      >
                        <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center text-[12px] font-bold shrink-0 ${driver.color}`}>
                          {driver.code}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-[13px] font-medium text-ink">{driver.name}</div>
                          <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                            <span className="bg-line/50 px-1.5 py-[1px] rounded-[4px] font-mono font-bold uppercase text-[10px] text-ink">{driver.vehicleReg}</span>
                            <span>•</span>
                            <span>{driver.email}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-3">
                          {form.driverId === driver.code && <Check className="w-4 h-4 text-ink" />}
                        </div>
                      </button>
                    ))}
                    
                    {filteredRoster.length === 0 && (
                      <div className="p-4 text-center text-[13px] text-muted">
                        No drivers found matching "{driverSearchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </section>

        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-line bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)] flex items-center justify-between rounded-b-[24px] z-10 sticky bottom-0">
          <span className="text-[12px] text-muted">* Required fields</span>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="px-5 py-2.5 rounded-[8px] border border-line bg-white font-medium text-ink hover:bg-surface transition text-[13px]"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={attemptedSubmit && !isFormValid()}
              className="px-5 py-2.5 rounded-[8px] font-medium bg-brand text-white hover:bg-brand-dark shadow-sm transition text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Job
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}

// Dummy AlertTriangle polyfill since it wasn't imported from lucide-react initially, although we added it to imports.
