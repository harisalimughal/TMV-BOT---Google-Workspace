import React, { useState } from "react";
import { X } from "lucide-react";
import { getDrivers, addDriver } from "../utils/drivers";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddDriverModal({ isOpen, onClose }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code.length < 2) {
      setCode(val.substring(0, 2).toUpperCase());
    }
  };

  const isCodeTaken = getDrivers().some(d => d.code === code.toUpperCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[500px] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-line flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-ink">Add New Driver</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted hover:text-ink hover:bg-surface rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] border border-line bg-surface text-[14px] text-ink outline-none focus:border-brand focus:bg-white transition"
                placeholder="driver@example.com"
              />
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

            <div className="col-span-2 mt-2">
               <label className="flex items-center gap-3 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={active}
                   onChange={(e) => setActive(e.target.checked)}
                   className="w-5 h-5 text-brand rounded focus:ring-brand"
                 />
                 <span className="text-[14px] font-semibold text-ink">Set as Active</span>
               </label>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-line bg-surface flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-[12px] text-[13px] font-semibold text-muted hover:text-ink transition">
            Cancel
          </button>
          <button 
            onClick={() => {
              addDriver({ 
                name, 
                code, 
                vehicleReg, 
                email, 
                phone, 
                active, 
                color: "bg-blue-100 text-blue-700" 
              });
              onClose();
              setName("");
              setCode("");
              setVehicleReg("");
              setEmail("");
              setPhone("");
            }} 
            disabled={isCodeTaken || !name || !code} 
            className="px-6 py-2 rounded-[12px] bg-[#2563EB] disabled:bg-[#93C5FD] disabled:cursor-not-allowed hover:bg-blue-700 text-white text-[13px] font-semibold shadow-sm transition"
          >
            Add Driver
          </button>
        </div>
      </div>
    </div>
  );
}
