import { Request, Response, Router } from "express";
import { fetchGpsLiveDevices, GpsLiveDevice } from "../../../src/integrations/gpslive";
import { log } from "../../../src/utils/logger";
import { DRIVERS_MAP } from "../normalize/mapping";
import { readDataset } from "../read/sheet-reader";
import { sheetCache } from "../read/cache";

export interface LiveFleetVehicle {
  imei: string;
  name: string;
  plateNumber: string;
  lat: number;
  lng: number;
  speedMph: number;
  lastUpdate: string;
  driverInitials: string | null;
  driverName: string | null;
}

/** GPSLive plate numbers and our own Van Registration column are typed freely
 * ("WN69 FEH" vs "wn69feh") -- compare on letters/digits only. */
function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** GPSLive device names follow "<PLATE> - <DRIVER INITIALS>" / "<PLATE> -<INITIALS>"
 * for vans that have been labelled that way in the GPSLive dashboard -- not guaranteed
 * for every device, so this is only a fallback when the plate itself doesn't match. */
function parseTrailingInitials(name: string): string | null {
  const match = name.match(/-\s*([A-Za-z]{2,4})\s*$/);
  return match ? match[1].toUpperCase() : null;
}

// GPSLive devices move continuously; cache briefly so several dashboard tabs polling
// at once don't each hit the upstream API, without serving positions that are stale
// enough to matter for "where is this van right now".
const FLEET_CACHE_TTL_MS = 8_000;
let cachedVehicles: LiveFleetVehicle[] | null = null;
let cachedAt = 0;

async function getLiveFleet(): Promise<LiveFleetVehicle[]> {
  if (cachedVehicles && Date.now() - cachedAt < FLEET_CACHE_TTL_MS) {
    return cachedVehicles;
  }

  // Vehicle positions matter more than driver-name matching: a Sheets hiccup shouldn't
  // blank out the whole live map, so a driver-lookup failure degrades to "no driver
  // matched" per vehicle instead of failing the request.
  const [devices, dataset] = await Promise.all([
    fetchGpsLiveDevices(),
    sheetCache.getOrFetch(readDataset).catch(error => {
      log.warn("fleet route: driver lookup unavailable, showing positions without driver match", {
        error: String(error)
      });
      return null;
    })
  ]);

  const driversByPlate = new Map<string, { initials: string; fullName: string }>();
  const driversByInitials = new Map<string, { initials: string; fullName: string }>();
  for (const d of dataset?.drivers ?? []) {
    const initials = String(d[DRIVERS_MAP.initials] || "").trim().toUpperCase();
    if (!initials) continue;
    const fullName = String(d["Full Name"] || initials);
    driversByInitials.set(initials, { initials, fullName });
    const plate = String(d[DRIVERS_MAP.vanRegistration] || "").trim();
    if (plate) driversByPlate.set(normalizePlate(plate), { initials, fullName });
  }

  const vehicles: LiveFleetVehicle[] = devices.map((device: GpsLiveDevice) => {
    const byPlate = driversByPlate.get(normalizePlate(device.plateNumber || ""));
    const trailingInitials = parseTrailingInitials(device.name || "");
    const byInitials = trailingInitials ? driversByInitials.get(trailingInitials) : undefined;
    const matched = byPlate || byInitials || null;

    return {
      imei: device.imei,
      name: device.name,
      plateNumber: device.plateNumber,
      lat: device.lat,
      lng: device.lng,
      speedMph: Math.round((device.speed || 0) * 0.621371), // GPSLive reports km/h
      lastUpdate: device.dtTracker,
      driverInitials: matched?.initials ?? null,
      driverName: matched?.fullName ?? null
    };
  });

  cachedVehicles = vehicles;
  cachedAt = Date.now();
  return vehicles;
}

export function fleetRoute(): Router {
  const router = Router();

  router.get("/live", async (_req: Request, res: Response) => {
    try {
      const vehicles = await getLiveFleet();
      return res.status(200).json({ vehicles, fetchedAt: new Date().toISOString() });
    } catch (error) {
      log.error("fleet live lookup failed", error);
      return res.status(502).json({
        error: { code: "FLEET_LOOKUP_FAILED", message: "Failed to fetch live vehicle positions." }
      });
    }
  });

  return router;
}
