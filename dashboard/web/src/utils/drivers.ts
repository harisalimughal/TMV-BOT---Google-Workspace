export interface Driver {
  name: string;
  code: string;
  vehicleReg: string;
  email: string;
  phone: string;
  active: boolean;
  color: string;
}

const SEED_DRIVERS: Driver[] = [
  { name: "Maico", code: "MK", vehicleReg: "DF19 BFA", email: "Maicolima075@gmail.com", phone: "07762839667", active: true, color: "bg-blue-100 text-blue-700" },
  { name: "Caio", code: "KA", vehicleReg: "DV68 UAF", email: "caiogabrielgsouza@gmail.com", phone: "07355475492", active: true, color: "bg-emerald-100 text-emerald-700" },
  { name: "Tiago", code: "TI", vehicleReg: "GK21 LWO", email: "Tiagomenegassi1@gmail.com", phone: "07763257716", active: true, color: "bg-purple-100 text-purple-700" },
  { name: "Henrique", code: "HE", vehicleReg: "KP72 ZHZ", email: "deathdark8999@gmail.com", phone: "07873131921", active: true, color: "bg-rose-100 text-rose-700" },
  { name: "Paulo", code: "PL", vehicleReg: "MA71 XOH", email: "wcarrato@yahoo.com", phone: "07946820239", active: true, color: "bg-amber-100 text-amber-700" },
  { name: "Wander", code: "WD", vehicleReg: "WN69 FEH", email: "wandergrandaouk@gmail.com", phone: "07599950535", active: true, color: "bg-indigo-100 text-indigo-700" },
  { name: "Rafael", code: "RF", vehicleReg: "YC68 VJZ", email: "Rafael.cruz.rh7@gmail.com", phone: "07479025903", active: true, color: "bg-cyan-100 text-cyan-700" }
];


const TEST_DRIVERS: Driver[] = [
  { name: "John Test (Removable)", code: "JT", vehicleReg: "TS24 AAA", email: "john.test@example.com", phone: "07700900001", active: true, color: "bg-slate-100 text-slate-700" },
  { name: "Sarah Test (Removable)", code: "ST", vehicleReg: "TS24 BBB", email: "sarah.test@example.com", phone: "07700900002", active: true, color: "bg-slate-100 text-slate-700" },
  { name: "Mike Test (Removable)", code: "MT", vehicleReg: "TS24 CCC", email: "mike.test@example.com", phone: "07700900003", active: true, color: "bg-slate-100 text-slate-700" }
];

export const getDrivers = (): Driver[] => {
  try {
    const stored = localStorage.getItem("tmv_roster_v2");
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  const combined = [...SEED_DRIVERS, ...TEST_DRIVERS];
  localStorage.setItem("tmv_roster_v2", JSON.stringify(combined));
  return combined;
};

export const addDriver = (driver: Driver) => {
  const current = getDrivers();
  const next = [...current, driver];
  localStorage.setItem("tmv_roster_v2", JSON.stringify(next));
  window.dispatchEvent(new Event('roster_updated'));
};

export const updateDriver = (code: string, updated: Driver) => {
  const current = getDrivers();
  const next = current.map(d => d.code === code ? updated : d);
  localStorage.setItem("tmv_roster_v2", JSON.stringify(next));
  window.dispatchEvent(new Event('roster_updated'));
};

export const removeDriver = (code: string) => {
  const current = getDrivers();
  const next = current.filter(d => d.code !== code);
  localStorage.setItem("tmv_roster_v2", JSON.stringify(next));
  window.dispatchEvent(new Event('roster_updated'));
};

// Aliased for components that haven't migrated to the hook yet, though ideally they use getDrivers()
export const ACTIVE_DRIVERS = [...SEED_DRIVERS, ...TEST_DRIVERS];

export const getAvatarColor = (code: string) => {
  if (code === "UN") return "bg-surface border border-line text-muted";
  const driver = getDrivers().find(d => d.code === code);
  if (driver) return driver.color;
  return "bg-gray-100 text-gray-700";
};

export const resolveDriver = (raw: string | undefined | null) => {
  if (!raw || raw === "N/A" || raw === "undefined" || raw === "Unassigned") {
    return { name: "Unassigned", code: "UN", needsReassignment: false };
  }
  const d = String(raw).toLowerCase().trim();
  
  const roster = getDrivers();
  
  // Try exact map to new driver roster first by code or name
  for (const driver of roster) {
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
  const clean = reg.replace(/\s+/g, '').toUpperCase();
  if (clean.length === 7) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  return reg.toUpperCase();
};
