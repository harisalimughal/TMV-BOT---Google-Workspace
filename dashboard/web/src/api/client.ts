import {
  DriverSummaryItem,
  ExceptionItem,
  FinanceSummaryResponse,
  NormalizedJob,
  ScenarioItem,
  SummaryResponse
} from "../types";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface JobsResponse {
  items: NormalizedJob[];
  pagination: PaginationMeta;
  meta: { fetchedAt: string; durationMs: number };
}

export async function fetchSummary(from?: string, to?: string): Promise<SummaryResponse> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await fetch(`/ops/api/summary?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "no text");
    console.error("fetchSummary failed:", res.status, text);
    throw new Error("Failed to load summary");
  }
  return res.json();
}

export async function fetchJobs(query: Record<string, any> = {}): Promise<JobsResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") {
      params.set(k, String(v));
    }
  }
  const res = await fetch(`/ops/api/jobs?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load jobs");
  return res.json();
}

export async function fetchJobDetail(jobId: string): Promise<NormalizedJob> {
  const res = await fetch(`/ops/api/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error(`Failed to load job ${jobId}`);
  const data = await res.json();
  return data.job;
}

export async function fetchDrivers(from?: string, to?: string): Promise<{ drivers: DriverSummaryItem[] }> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await fetch(`/ops/api/drivers/summary?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load drivers summary");
  return res.json();
}

export async function fetchFinance(from?: string, to?: string, groupBy = "day"): Promise<FinanceSummaryResponse> {
  const params = new URLSearchParams({ groupBy });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await fetch(`/ops/api/finance/summary?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load finance summary");
  return res.json();
}

export async function fetchExceptions(type?: string, from?: string, to?: string, badge?: boolean): Promise<{
  total: number;
  unfilteredTotal: number;
  activeBadgeCount?: number;
  items: ExceptionItem[];
  types: Array<{ type: string; count: number }>;
}> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (badge) params.set("badge", "true");
  const res = await fetch(`/ops/api/exceptions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load exceptions");
  return res.json();
}

export async function fetchScenarios(kind: string, page = 1): Promise<{
  kind: string;
  items: ScenarioItem[];
  pagination: PaginationMeta;
}> {
  const res = await fetch(`/ops/api/scenarios/${encodeURIComponent(kind)}?page=${page}`);
  if (!res.ok) throw new Error(`Failed to load scenario ${kind}`);
  return res.json();
}

export async function fetchActivity(page = 1, from?: string, to?: string): Promise<{
  items: Array<{
    id: string;
    timestamp: string;
    jobId: string;
    driver: string;
    action: string;
    fromState?: string;
    toState?: string;
    detail?: string;
  }>;
  pagination: PaginationMeta;
}> {
  const params = new URLSearchParams({ page: String(page) });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await fetch(`/ops/api/activity?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load activity logs");
  return res.json();
}

export async function triggerDatasetRefresh(): Promise<void> {
  const res = await fetch("/ops/api/refresh", { method: "POST" });
  if (!res.ok) throw new Error("Failed to refresh dataset");
}

async function postJson(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || "Request failed");
  }
}

export interface AddJobPayload {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  pickup: string;
  dropoff: string;
  crewSize: number;
  price: number;
  paidOnline?: boolean;
  driverInitials?: string;
  start: string;
  finish: string;
}

/** Creates a real Calendar event (see dashboard/server/routes/jobs.route.ts) --
 *  not a local write, the classic bot's own sync path picks this up. */
export async function addJob(payload: AddJobPayload): Promise<void> {
  return postJson("/ops/api/jobs", payload);
}

export interface SaveDriverPayload {
  initials: string;
  fullName: string;
  email: string;
  chatUserName?: string;
  role?: string;
  active?: boolean;
  phone?: string;
  vanRegistration?: string;
}

/** Upserts a Drivers-sheet row, keyed on email -- add and edit both go through this. */
export async function saveDriver(payload: SaveDriverPayload): Promise<void> {
  return postJson("/ops/api/drivers", payload);
}

export interface EditableSetting {
  key: string;
  label: string;
  description: string;
  value: string;
  fallback: string;
}

export async function fetchSettings(): Promise<{ settings: EditableSetting[] }> {
  const res = await fetch("/ops/api/settings");
  if (!res.ok) throw new Error("Failed to load settings");
  return res.json();
}

export async function saveSetting(key: string, value: string): Promise<void> {
  return postJson("/ops/api/settings", { key, value });
}

export interface NotificationRow {
  jobId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  driverInitials: string;
  actualStart: string;
  email: { state: "sent" | "failed" | "pending" | "skipped" | "disabled"; detail: string; at: string };
  sms: { state: "sent" | "failed" | "pending" | "skipped" | "disabled"; detail: string; at: string };
}

/** Real email/SMS delivery status, from the same ActivityLog rows the classic /admin
 *  panel's Notifications tab reads -- not the fabricated per-job hash the old
 *  NotificationsPage.tsx used. */
export async function fetchNotifications(): Promise<{ rows: NotificationRow[] }> {
  const res = await fetch("/ops/api/notifications");
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

/** One van's last-known GPS position, from GPSLive (see dashboard/server/routes/fleet.route.ts).
 *  driverInitials/driverName are null when the plate/initials couldn't be matched to a
 *  row in the Drivers sheet -- still a real position, just an unidentified vehicle. */
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
  odometerMiles: number | null;
  ignitionOn: boolean | null;
  batteryVoltage: number | null;
  gpsSignalLevel: number | null;
  gsmSignalLevel: number | null;
  crashDetected: boolean;
  jammingDetected: boolean;
  ecoDrivingEvent: string | null;
  ecoDrivingScore: number | null;
}

export async function fetchLiveFleet(): Promise<{ vehicles: LiveFleetVehicle[]; fetchedAt: string }> {
  const res = await fetch("/ops/api/fleet/live");
  if (!res.ok) throw new Error("Failed to load live fleet positions");
  return res.json();
}
