import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, AlertTriangle } from "lucide-react";
import { fetchDrivers, saveDriver } from "../api/client";
import { DriverSummaryItem } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  driverToEdit?: DriverSummaryItem | null;
}

export function AddDriverModal({ isOpen, onClose, driverToEdit }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Real roster (see dashboard/server/routes/drivers.route.ts) -- used to catch a
  // duplicate initials before the write, mirroring what driverWrite()'s Email-keyed
  // upsert would otherwise do silently.
  const { data: driversData } = useQuery({ queryKey: ["drivers_summary"], queryFn: () => fetchDrivers() });
  const roster = driversData?.drivers ?? [];

  // Sync state with driverToEdit when modal opens or driver changes
  useEffect(() => {
    if (driverToEdit) {
      setName(driverToEdit.fullName);
      setCode(driverToEdit.initials);
      setVehicleReg(driverToEdit.vanRegistration || "");
      setEmail(driverToEdit.email || "");
      setPhone(driverToEdit.phone || "");
      setActive(driverToEdit.active !== false);
    } else {
      setName("");
      setCode("");
      setVehicleReg("");
      setEmail("");
      setPhone("");
      setActive(true);
    }
    setSaveError("");
  }, [driverToEdit, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!driverToEdit && (!code || code.length < 2)) {
      setCode(val.substring(0, 2).toUpperCase());
    }
  };

  // Initials are taken if they exist AND we aren't editing the driver that already owns them
  const isCodeTaken = roster.some(d =>
    d.initials === code.toUpperCase() && (!driverToEdit || driverToEdit.initials !== code.toUpperCase())
  );

  const handleSubmit = async () => {
    setSaveError("");
    setIsSaving(true);
    try {
      await saveDriver({
        initials: code.toUpperCase(),
        fullName: name,
        email,
        active,
        phone,
        vanRegistration: vehicleReg
      });
      queryClient.invalidateQueries({ queryKey: ["drivers_summary"] });
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save driver.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[500px] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-line flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-ink">{driverToEdit ? "Edit Driver" : "Add New Driver"}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted hover:text-ink hover:bg-surface rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Full Name <span className="text-status-red">*</span></label>
              <input 
                type="text" 
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                placeholder="e.g. John Doe"
              />
            </div>
            
            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Driver Code (2-letter) <span className="text-status-red">*</span></label>
              <input 
                type="text" 
                maxLength={2}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className={`w-full h-11 px-3 rounded-[12px] border ${isCodeTaken ? 'border-status-red focus:border-status-red' : 'border-line focus:border-brand'} bg-surface text-[14px] text-ink outline-none focus:bg-white transition uppercase`}
                placeholder="e.g. JD"
              />
              {isCodeTaken && <span className="text-[11px] text-status-red mt-1 block">This code is already in use.</span>}
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Vehicle Registration</label>
              <input 
                type="text" 
                value={vehicleReg}
                onChange={e => setVehicleReg(e.target.value.toUpperCase())}
                className="w-full h-11 px-3 rounded-[12px] border border-line bg-surface text-[14px] font-mono text-ink outline-none focus:border-brand focus:bg-white transition uppercase"
                placeholder="e.g. AB12 CDE"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                Email Address <span className="text-status-red">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                placeholder="driver@example.com"
              />
              <span className="text-[11px] text-muted mt-1 block">Used to sign the driver in from Google Chat, and as the unique key for this record.</span>
            </div>

            <div className="col-span-2">
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Phone Number</label>
              <input 
                type="tel" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                placeholder="07..."
              />
            </div>

            <div className="col-span-2 mt-4 pt-4 border-t border-line">
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-3">System Access & Status</label>
              <div className={`p-4 rounded-[12px] border transition-colors ${active ? 'bg-status-green-bg border-status-green/20' : 'bg-[#FEF2F2] border-[#FECACA]'}`}>
                 <label className="flex items-start gap-3 cursor-pointer">
                   <div className="pt-0.5">
                     <input 
                       type="checkbox" 
                       checked={active}
                       onChange={(e) => setActive(e.target.checked)}
                       className="w-5 h-5 text-brand rounded focus:ring-brand"
                     />
                   </div>
                   <div>
                     <span className={`text-[14px] font-bold block ${active ? 'text-status-green' : 'text-status-red'}`}>
                       {active ? 'Active (Bot Access Enabled)' : 'Deactivated (Access Revoked)'}
                     </span>
                     <p className={`text-[13px] mt-1 ${active ? 'text-status-green/80' : 'text-status-red/80'}`}>
                       {active 
                         ? 'Driver can view assignments, execute bot commands, and receive client notifications.' 
                         : 'Driver is immediately blocked from the TMV Google Chat Bot. Future assignments are stopped.'}
                     </p>
                   </div>
                 </label>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-line bg-surface">
          {saveError && (
            <p className="text-[12px] text-status-red font-medium mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {saveError}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} disabled={isSaving} className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-muted hover:text-ink transition disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving || isCodeTaken || !name || !code || !email}
              className="px-6 py-2 rounded-[12px] bg-[#2563EB] disabled:bg-[#93C5FD] disabled:cursor-not-allowed hover:bg-blue-700 text-white text-[13px] font-semibold shadow-sm transition"
            >
              {isSaving ? "Saving…" : driverToEdit ? "Save Changes" : "Add Driver"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
