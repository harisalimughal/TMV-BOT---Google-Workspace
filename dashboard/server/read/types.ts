export interface SheetDataset {
  bookings: Record<string, string>[];
  drivers: Record<string, string>[];
  workflow: Record<string, string>[];
  driverFlow: Record<string, string>[];
  payments: Record<string, string>[];
  signatures: Record<string, string>[];
  evidence: Record<string, string>[];
  photos: Record<string, string>[];
  activity: Record<string, string>[];
  processedEvents: Record<string, string>[];
  exceptions: Record<string, string>[];
  settings: Record<string, string>[];
  checkIn: Record<string, string>[];
  checkOut: Record<string, string>[];
  parking: Record<string, string>[];
  liability: Record<string, string>[];
  pendingSignatures: Record<string, string>[];
  scenarioProgress: Record<string, string>[];
  fetchedAt: string;
  durationMs: number;
}

export interface ReadOptions {
  forceRefresh?: boolean;
}
