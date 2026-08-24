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

export const getDrivers = (): Driver[] => {
  try {
    const stored = localStorage.getItem("tmv_roster_v3");
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  localStorage.setItem("tmv_roster_v3", JSON.stringify(SEED_DRIVERS));
  return SEED_DRIVERS;
};

export const addDriver = (driver: Driver) => {
  const current = getDrivers();
  const next = [...current, driver];
  localStorage.setItem("tmv_roster_v3", JSON.stringify(next));
  window.dispatchEvent(new Event('roster_updated'));
};

export const updateDriver = (code: string, updated: Driver) => {
  const current = getDrivers();
  const next = current.map(d => d.code === code ? updated : d);
  localStorage.setItem("tmv_roster_v3", JSON.stringify(next));
  window.dispatchEvent(new Event('roster_updated'));
};

export const removeDriver = (code: string) => {
  const current = getDrivers();
  const next = current.filter(d => d.code !== code);
  localStorage.setItem("tmv_roster_v3", JSON.stringify(next));
  window.dispatchEvent(new Event('roster_updated'));
};

export const ACTIVE_DRIVERS = SEED_DRIVERS;

export const getAvatarColor = (code: string) => {
  if (code === "UN") return "bg-surface border border-line text-muted";
  const driver = getDrivers().find(d => d.code === code);
  if (driver) return driver.color;
  return "bg-amber-100 text-amber-700"; // Legacy drivers highlight amber
};

export const resolveDriver = (raw: string | undefined | null) => {
  if (!raw || raw === "N/A" || raw === "undefined" || raw === "Unassigned") {
    return { name: "Unassigned", code: "UN", needsReassignment: false, color: "bg-surface border border-line text-muted" };
  }
  const d = String(raw).toLowerCase().trim();
  
  const roster = getDrivers();
  
  for (const driver of roster) {
    if (d === driver.code.toLowerCase() || d.includes(driver.name.toLowerCase())) {
      return { name: driver.name, code: driver.code, vehicleReg: driver.vehicleReg, needsReassignment: false, color: driver.color };
    }
  }

  // Legacy fallback -> strictly needs reassignment
  const originalStr = String(raw).trim();
  let pseudoCode = originalStr.substring(0, 2).toUpperCase();
  if (pseudoCode.length < 2) pseudoCode = "?";

  return {
    name: originalStr,
    code: pseudoCode,
    needsReassignment: true,
    color: "bg-amber-100 text-amber-700"
  };
};

export const formatVanReg = (reg: string) => {
  if (!reg) return "";
  const clean = reg.replace(/\s+/g, '').toUpperCase();
  if (clean.length === 7) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  return reg.toUpperCase();
};
