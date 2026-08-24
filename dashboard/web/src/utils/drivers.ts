export interface Driver {
  name: string;
  code: string;
  vehicleReg: string;
  email: string;
  phone: string;
  active: boolean;
  color: string;
}

export const ACTIVE_DRIVERS: Driver[] = [
  { name: "Maico", code: "MK", vehicleReg: "DF19 BFA", email: "Maicolima075@gmail.com", phone: "07762839667", active: true, color: "bg-blue-100 text-blue-700" },
  { name: "Caio", code: "KA", vehicleReg: "DV68 UAF", email: "caiogabrielgsouza@gmail.com", phone: "07355475492", active: true, color: "bg-emerald-100 text-emerald-700" },
  { name: "Tiago", code: "TI", vehicleReg: "GK21 LWO", email: "Tiagomenegassi1@gmail.com", phone: "07763257716", active: true, color: "bg-purple-100 text-purple-700" },
  { name: "Henrique", code: "HE", vehicleReg: "KP72 ZHZ", email: "deathdark8999@gmail.com", phone: "07873131921", active: true, color: "bg-rose-100 text-rose-700" },
  { name: "Paulo", code: "PL", vehicleReg: "MA71 XOH", email: "wcarrato@yahoo.com", phone: "07946820239", active: true, color: "bg-amber-100 text-amber-700" },
  { name: "Wander", code: "WD", vehicleReg: "WN69 FEH", email: "wandergrandaouk@gmail.com", phone: "07599950535", active: true, color: "bg-indigo-100 text-indigo-700" },
  { name: "Rafael", code: "RF", vehicleReg: "YC68 VJZ", email: "Rafael.cruz.rh7@gmail.com", phone: "07479025903", active: true, color: "bg-cyan-100 text-cyan-700" }
];

export const getAvatarColor = (code: string) => {
  if (code === "UN") return "bg-surface border border-line text-muted";
  const driver = ACTIVE_DRIVERS.find(d => d.code === code);
  if (driver) return driver.color;
  return "bg-gray-100 text-gray-700";
};

export const resolveDriver = (raw: string | undefined | null) => {
  if (!raw || raw === "N/A" || raw === "undefined" || raw === "Unassigned") {
    return { name: "Unassigned", code: "UN", needsReassignment: false };
  }
  const d = String(raw).toLowerCase().trim();
  
  // Try exact map to new driver roster first by code or name
  for (const driver of ACTIVE_DRIVERS) {
    if (d === driver.code.toLowerCase() || d.includes(driver.name.toLowerCase())) {
      return { name: driver.name, code: driver.code, vehicleReg: driver.vehicleReg, needsReassignment: false, color: driver.color };
    }
  }

  // Legacy fallback
  return {
    name: String(raw),
    code: String(raw).substring(0, 2).toUpperCase(),
    needsReassignment: true,
    color: "bg-gray-100 text-gray-700"
  };
};

export const formatVanReg = (reg: string) => {
  if (!reg) return "";
  // Ensure the reg is styled like "DF19 BFA" if it is missing the space but is 7 chars
  const clean = reg.replace(/\s+/g, '').toUpperCase();
  if (clean.length === 7) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  return reg.toUpperCase();
};
