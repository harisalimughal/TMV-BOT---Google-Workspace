import { describe, expect, it } from "vitest";
import { JOB_STARTED_MESSAGE_TEMPLATE, renderJobStartedMessage } from "../src/notifications/message";
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

// One shared template renders BOTH the email body and the SMS body -- same wording,
// both channels, no separate templates that can drift apart.
describe("renderJobStartedMessage", () => {
  it("substitutes every documented placeholder", () => {
    const rendered = renderJobStartedMessage(
      "Hi {customerName} ({companyName}): {pickup} -> {dropoff}", JOB
    );
    expect(rendered).toBe(`Hi Barry Thompson (${env.notificationFromName}): 10 Example Street -> 74 Ferndale Road, N15 6UQ`);
  });

  it("falls back to 'there' when the job has no customer name", () => {
    expect(renderJobStartedMessage("Hi {customerName}", { ...JOB, customerName: "" })).toBe("Hi there");
  });

  it("the default admin-editable template renders without leftover placeholders", () => {
    const rendered = renderJobStartedMessage(JOB_STARTED_MESSAGE_TEMPLATE, JOB);
    expect(rendered).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(rendered).toContain("Barry Thompson");
    expect(rendered).toContain("10 Example Street");
  });
});
