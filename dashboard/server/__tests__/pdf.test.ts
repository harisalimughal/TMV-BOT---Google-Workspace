import { describe, expect, it } from "vitest";
import { generateJobPdf } from "../pdf/pdf-generator";
import { fromPounds } from "../../../src/utils/money";
import { JobStatus } from "../../../src/jobs/job.types";
import { NormalizedJob } from "../normalize/types";

describe("PDF Report Generator", () => {
  const mockJob: NormalizedJob = {
    jobId: "TMV-PDF-001",
    calendarEventId: "cal-pdf-001",
    bookedStart: "2026-08-15T09:00:00.000Z",
    bookedFinish: "2026-08-15T11:00:00.000Z",
    actualStart: "2026-08-15T09:10:00.000Z",
    actualFinish: "2026-08-15T11:15:00.000Z",
    bookedMinutes: 120,
    actualMinutes: 125,
    delayMinutes: 10,
    delayBand: "LATE_5_15",
    timingTrustworthy: true,
    customerName: "Robert Taylor",
    customerEmail: "robert@example.com",
    customerPhone: "07987654321",
    pickup: "10 Downing St, London",
    dropoff: "221B Baker St, London",
    crewSize: 2,
    driverInitials: "WD",
    driverName: "William Davies",
    driverEmail: "william@tmv.co.uk",
    status: JobStatus.COMPLETED,
    currentState: "COMPLETED",
    workflowCompletionPct: 100,
    basePrice: fromPounds(150),
    extraCharges: fromPounds(18),
    overtimeMinutes: 0,
    overtimeCharge: fromPounds(0),
    totalCharges: fromPounds(168),
    reconciled: true,
    paymentMethod: "Card",
    paymentStatus: "PAID",
    paidOnline: true,
    evidenceCompleteness: {
      arrival: "COMPLETED",
      vanLoaded: "COMPLETED",
      emptyVan: "COMPLETED",
      organized: "COMPLETED",
      signature: "COMPLETED"
    },
    evidenceItems: [],
    clientConfirmedName: "Robert Taylor",
    activity: [],
    exceptions: [],
    created: "2026-08-10T12:00:00Z",
    updated: "2026-08-15T11:15:00Z"
  };

  it("generates a valid binary PDF buffer with PDF headers and trailers", () => {
    const buffer = generateJobPdf(mockJob);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(500);

    const pdfString = buffer.toString("utf8");
    expect(pdfString.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfString.includes("TMV-PDF-001")).toBe(true);
    expect(pdfString.includes("Robert Taylor")).toBe(true);
    expect(pdfString.includes("%%EOF")).toBe(true);
  });
});
