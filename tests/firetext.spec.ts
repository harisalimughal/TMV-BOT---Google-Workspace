import { describe, expect, it } from "vitest";
import { normalizeUkMobile, renderSmsTemplate, SMS_JOB_STARTED_TEMPLATE } from "../src/integrations/firetext";
import { env } from "../src/config/env";
import { Job, JobStatus } from "../src/jobs/job.types";

const JOB: Job = {
  jobId: "TMV-TEST0001", calendarEventId: "evt-1", driverInitials: "WD",
  customerName: "Barry Thompson", customerEmail: "barry@example.test", customerPhone: "07123456789",
  pickup: "10 Example Street", dropoff: "74 Ferndale Road, N15 6UQ",
  crewSize: 2, basePrice: 350, paidOnline: false,
  bookedStart: "2026-08-15T09:00:00.000Z", bookedFinish: "2026-08-15T10:00:00.000Z",
  actualStart: "", actualFinish: "", bookedMinutes: 60, actualMinutes: 0, differenceMinutes: 0,
  delayStatus: "", extraCharges: [], overtimeMinutes: 0, overtimeCharge: 0, totalCharges: 0,
  paymentMethod: "", paymentStatus: "", clientNamePostcode: "", clientConfirmedBy: "",
  driveFolderId: "", driveFolderUrl: "",
  status: JobStatus.READY, currentState: "READY", createdAt: "", updatedAt: ""
};

describe("normalizeUkMobile", () => {
  it("replaces a UK leading zero with the country code", () => {
    expect(normalizeUkMobile("07123456789")).toBe("447123456789");
  });

  it("strips spaces and dashes typed at booking time", () => {
    expect(normalizeUkMobile("07123 456 789")).toBe("447123456789");
    expect(normalizeUkMobile("07123-456-789")).toBe("447123456789");
  });

  it("leaves an already-international number untouched (minus a leading +)", () => {
    expect(normalizeUkMobile("+447123456789")).toBe("447123456789");
    expect(normalizeUkMobile("447123456789")).toBe("447123456789");
  });

  it("does not invent a country code for a number with neither a leading 0 nor 44", () => {
    // Not a UK number this app can guess at -- passed through digits-only, so Firetext's
    // own validation rejects it clearly rather than silently mis-dialing a UK number.
    expect(normalizeUkMobile("15551234567")).toBe("15551234567");
  });
});

describe("renderSmsTemplate", () => {
  it("substitutes every documented placeholder", () => {
    const rendered = renderSmsTemplate(
      "Hi {customerName} ({companyName}): {pickup} -> {dropoff}", JOB
    );
    expect(rendered).toBe(`Hi Barry Thompson (${env.notificationFromName}): 10 Example Street -> 74 Ferndale Road, N15 6UQ`);
  });

  it("falls back to 'there' when the job has no customer name", () => {
    expect(renderSmsTemplate("Hi {customerName}", { ...JOB, customerName: "" })).toBe("Hi there");
  });

  it("the default admin-editable template renders without leftover placeholders", () => {
    const rendered = renderSmsTemplate(SMS_JOB_STARTED_TEMPLATE, JOB);
    expect(rendered).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(rendered).toContain("Barry Thompson");
    expect(rendered).toContain("10 Example Street");
  });
});
