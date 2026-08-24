import { describe, expect, it } from "vitest";
import { fromPounds, pence } from "../../../src/utils/money";
import { calculateOvertimePence, reconcileFinancials, safeMoney } from "../normalize/finance";
import { normalizeDataset } from "../normalize/normalize";
import {
  calculateDelayMinutes,
  calculateMinutes,
  formatLondonDate,
  getDelayBand,
  isTimingTrustworthy,
  toUtcIso
} from "../normalize/timezone";
import { SheetDataset } from "../read/types";

describe("Timezone and Delay Banding", () => {
  it("converts timestamps to ISO UTC", () => {
    const iso = toUtcIso("2026-08-15T09:30:00.000Z");
    expect(iso).toBe("2026-08-15T09:30:00.000Z");
  });

  it("identifies trustworthy London offsets vs untrustworthy offsets", () => {
    expect(isTimingTrustworthy("2026-08-15T09:30:00Z")).toBe(true);
    expect(isTimingTrustworthy("2026-08-15T09:30:00+01:00")).toBe(true);
    expect(isTimingTrustworthy("2026-08-15T09:30:00+00:00")).toBe(true);
    expect(isTimingTrustworthy("2026-08-15T09:30:00+05:00")).toBe(false);
  });

  it("calculates delay minutes and assigns correct delay band", () => {
    // Early: booked 10:00, actual 09:50 -> -10 min
    const delayEarly = calculateDelayMinutes("2026-08-15T10:00:00Z", "2026-08-15T09:50:00Z");
    expect(delayEarly).toBe(-10);
    expect(getDelayBand(delayEarly)).toBe("EARLY");

    // On time: booked 10:00, actual 10:00 -> 0 min
    const delayOnTime = calculateDelayMinutes("2026-08-15T10:00:00Z", "2026-08-15T10:00:00Z");
    expect(delayOnTime).toBe(0);
    expect(getDelayBand(delayOnTime)).toBe("ON_TIME");

    // 5-15 min late: booked 10:00, actual 10:12 -> 12 min
    const delay5_15 = calculateDelayMinutes("2026-08-15T10:00:00Z", "2026-08-15T10:12:00Z");
    expect(delay5_15).toBe(12);
    expect(getDelayBand(delay5_15)).toBe("LATE_5_15");

    // 15-30 min late: booked 10:00, actual 10:25 -> 25 min
    const delay15_30 = calculateDelayMinutes("2026-08-15T10:00:00Z", "2026-08-15T10:25:00Z");
    expect(delay15_30).toBe(25);
    expect(getDelayBand(delay15_30)).toBe("LATE_15_30");

    // Over 30 min late: booked 10:00, actual 10:45 -> 45 min
    const delayOver30 = calculateDelayMinutes("2026-08-15T10:00:00Z", "2026-08-15T10:45:00Z");
    expect(delayOver30).toBe(45);
    expect(getDelayBand(delayOver30)).toBe("LATE_OVER_30");
  });

  it("handles BST/GMT boundary dates correctly in London time", () => {
    // Summer BST (UTC+1)
    const summer = formatLondonDate("2026-07-15T10:00:00.000Z", "yyyy-MM-dd HH:mm");
    expect(summer).toBe("2026-07-15 11:00");

    // Winter GMT (UTC+0)
    const winter = formatLondonDate("2026-01-15T10:00:00.000Z", "yyyy-MM-dd HH:mm");
    expect(winter).toBe("2026-01-15 10:00");
  });
});

describe("Financial Reconciliation & Pence", () => {
  it("parses safeMoney from strings, numbers, and symbols", () => {
    expect(safeMoney("£350.00")).toBe(35000);
    expect(safeMoney("£1,250.50")).toBe(125050);
    expect(safeMoney(120)).toBe(12000);
    expect(safeMoney("")).toBe(0);
    expect(safeMoney(undefined)).toBe(0);
  });

  it("calculates overtime rate: £55 per 30 minutes rounded up", () => {
    expect(calculateOvertimePence(0)).toBe(0);
    expect(calculateOvertimePence(15)).toBe(5500); // 1 block = £55.00
    expect(calculateOvertimePence(30)).toBe(5500); // 1 block = £55.00
    expect(calculateOvertimePence(31)).toBe(11000); // 2 blocks = £110.00
    expect(calculateOvertimePence(60)).toBe(11000); // 2 blocks = £110.00
  });

  it("reconciles base + extras + overtime == total charges", () => {
    const base = fromPounds(141);
    const extras = fromPounds(18); // Congestion
    const overtime = calculateOvertimePence(30); // £55
    const total = fromPounds(214); // 141 + 18 + 55 = 214

    expect(reconcileFinancials(base, extras, overtime, total)).toBe(true);

    // Unreconciled
    const wrongTotal = fromPounds(200);
    expect(reconcileFinancials(base, extras, overtime, wrongTotal)).toBe(false);
  });
});

describe("Dataset Normalization & Three-Way Evidence Classifier", () => {
  const mockDataset: SheetDataset = {
    bookings: [
      {
        "Job ID": "TMV-TEST001",
        "Calendar Event ID": "cal-001",
        "Driver Initials": "WD",
        "Customer": "Alice Smith",
        "Customer Email": "alice@example.com",
        "Phone": "07123456789",
        "Pickup": "10 Downing St",
        "Dropoff": "221B Baker St",
        "Crew Size": "2",
        "Base Price": "150",
        "Paid Online": "TRUE",
        "Booked Start": "2026-08-15T09:00:00.000Z",
        "Booked Finish": "2026-08-15T11:00:00.000Z",
        "Actual Start": "2026-08-15T09:10:00.000Z",
        "Actual Finish": "2026-08-15T11:15:00.000Z",
        "Booked Minutes": "120",
        "Actual Minutes": "125",
        "Difference Minutes": "10",
        "Delay Status": "LATE_10",
        "Extra Charges": "18",
        "Overtime Minutes": "0",
        "Overtime Charge": "0",
        "Total Charges": "168",
        "Payment Method": "Card",
        "Payment Status": "PAID",
        "Status": "COMPLETED",
        "Current State": "COMPLETED",
        "Drive Folder ID": "drive-folder-123",
        "Drive Folder URL": "https://drive.google.com/folders/123",
        "Created": "2026-08-10T12:00:00Z",
        "Updated": "2026-08-15T11:15:00Z"
      }
    ],
    drivers: [
      {
        "Initials": "WD",
        "Full Name": "William Davies",
        "Email": "william@tmv.co.uk",
        "Active": "TRUE",
        "Role": "Driver"
      }
    ],
    workflow: [
      {
        "Job ID": "TMV-TEST001",
        "Driver": "william@tmv.co.uk",
        "State": "COMPLETED",
        "Updated": "2026-08-15T11:15:00Z"
      }
    ],
    driverFlow: [],
    payments: [
      {
        "Timestamp": "2026-08-15T11:10:00Z",
        "Job ID": "TMV-TEST001",
        "Driver": "william@tmv.co.uk",
        "Method": "Card",
        "Amount": "168",
        "Status": "COMPLETED"
      }
    ],
    signatures: [
      {
        "Timestamp": "2026-08-15T11:12:00Z",
        "Job ID": "TMV-TEST001",
        "Driver": "william@tmv.co.uk",
        "Customer Name": "Alice Smith",
        "Mode": "Pad",
        "Confirmation Text": "https://drive.google.com/file/d/sig-file-abc-123/view"
      }
    ],
    evidence: [
      {
        "Evidence ID": "EV-01",
        "Job ID": "TMV-TEST001",
        "Driver": "william@tmv.co.uk",
        "Evidence Type": "Arrival",
        "Status": "COMPLETED",
        "Drive File ID": "arrival-img-1",
        "Drive URL": "https://drive.google.com/file/d/arrival-img-1/view",
        "Received": "2026-08-15T09:12:00Z",
        "Processing Completed": "2026-08-15T09:13:00Z"
      },
      {
        "Evidence ID": "EV-02",
        "Job ID": "TMV-TEST001",
        "Driver": "william@tmv.co.uk",
        "Evidence Type": "VanLoaded",
        "Status": "PROCESSING",
        "Received": "2026-08-15T09:45:00Z"
      },
      {
        "Evidence ID": "EV-03",
        "Job ID": "TMV-TEST001",
        "Driver": "william@tmv.co.uk",
        "Evidence Type": "EmptyVan",
        "Status": "FAILED",
        "Last Error": "Corrupted upload buffer",
        "Received": "2026-08-15T10:45:00Z"
      }
    ],
    photos: [],
    activity: [
      {
        "Timestamp": "2026-08-15T09:10:00Z",
        "Job ID": "TMV-TEST001",
        "Driver": "william@tmv.co.uk",
        "Action": "START_JOB",
        "From State": "READY",
        "To State": "WAITING_ARRIVAL_PHOTO"
      }
    ],
    processedEvents: [],
    exceptions: [],
    settings: [],
    checkIn: [],
    checkOut: [],
    parking: [],
    liability: [],
    pendingSignatures: [],
    scenarioProgress: [],
    fetchedAt: new Date().toISOString(),
    durationMs: 10,
    source: "live"
  };

  it("normalizes dataset into NormalizedJob with proper joins", () => {
    const jobs = normalizeDataset(mockDataset);
    expect(jobs).toHaveLength(1);
    const job = jobs[0];

    expect(job.jobId).toBe("TMV-TEST001");
    expect(job.driverName).toBe("William Davies");
    expect(job.customerName).toBe("Alice Smith");
    expect(job.basePrice).toBe(15000);
    expect(job.extraCharges).toBe(1800);
    expect(job.totalCharges).toBe(16800);
    expect(job.reconciled).toBe(true);

    // Three-way evidence completeness classification
    expect(job.evidenceCompleteness.arrival).toBe("COMPLETED");
    expect(job.evidenceCompleteness.vanLoaded).toBe("PROCESSING");
    expect(job.evidenceCompleteness.emptyVan).toBe("FAILED");
    expect(job.evidenceCompleteness.organized).toBe("MISSING");
    expect(job.evidenceCompleteness.signature).toBe("COMPLETED");

    // Thumb proxy URLs
    const arrivalItem = job.evidenceItems.find(e => e.category === "Arrival");
    expect(arrivalItem?.thumbProxyUrl).toBe("/ops/api/jobs/TMV-TEST001/photos/arrival-img-1");

    const sigItem = job.evidenceItems.find(e => e.category === "Signature");
    expect(sigItem?.thumbProxyUrl).toBe("/ops/api/jobs/TMV-TEST001/photos/sig-file-abc-123");
  });
});
