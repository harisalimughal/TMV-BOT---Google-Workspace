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
