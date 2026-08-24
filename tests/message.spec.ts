import { describe, expect, it } from "vitest";
import { JOB_STARTED_MESSAGE_TEMPLATE, REVIEW_REQUEST_EMAIL_TEMPLATE, renderMessageTemplate } from "../src/notifications/message";
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

const DRIVER = { phone: "07900123456", vanRegistration: "AB12 CDE" };

// One shared function renders every customer-facing message template in the app --
// the "on my way" message (email + SMS) and the review-request email alike.
describe("renderMessageTemplate", () => {
  it("substitutes every documented placeholder", () => {
    const rendered = renderMessageTemplate(
      "Hi {customerName} ({companyName}): {pickup} -> {dropoff}. Driver: {driverPhone} / {vanRegistration}",
      JOB,
      DRIVER
    );
    expect(rendered).toBe(
      `Hi Barry Thompson (${env.notificationFromName}): 10 Example Street -> 74 Ferndale Road, N15 6UQ. ` +
        "Driver: 07900123456 / AB12 CDE"
    );
  });

  it("falls back to 'there' when the job has no customer name", () => {
    expect(renderMessageTemplate("Hi {customerName}", { ...JOB, customerName: "" })).toBe("Hi there");
  });

  it("renders driver placeholders blank when no driver is given", () => {
    expect(renderMessageTemplate("Phone: {driverPhone}, Van: {vanRegistration}", JOB)).toBe("Phone: , Van: ");
  });

  it("the default 'on my way' template renders without leftover placeholders", () => {
    const rendered = renderMessageTemplate(JOB_STARTED_MESSAGE_TEMPLATE, JOB, DRIVER);
    expect(rendered).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(rendered).toContain("07900123456");
    expect(rendered).toContain("AB12 CDE");
  });

  it("the default review-request template renders without leftover placeholders", () => {
    const rendered = renderMessageTemplate(REVIEW_REQUEST_EMAIL_TEMPLATE, JOB);
    expect(rendered).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(rendered).toContain("Barry Thompson");
    expect(rendered).toContain(env.notificationFromName);
  });
});
