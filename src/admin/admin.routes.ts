import { Router } from "express";
import { checkAdminPassword, clearSessionCookie, issueSessionCookie, requireAdminSession } from "./admin.auth";
import { dashboardShell, loginPage } from "./admin.page";
import { listObjects, SCHEMA, SHEETS } from "../google/sheets";
import { log } from "../utils/logger";

/** Allowlist: the URL only ever selects a sheet name from this map, never passes one through. */
const TAB_SHEETS: Record<string, string> = {
  jobs: SHEETS.BOOKINGS,
  checkin: SHEETS.STORAGE_CHECK_IN,
  checkout: SHEETS.STORAGE_CHECK_OUT,
  parking: SHEETS.PARKING_LIABILITY,
  liability: SHEETS.LIABILITY_REPORT,
  drivers: SHEETS.DRIVERS
};

export function adminRouter(): Router {
  const router = Router();

  router.get("/login", (_req, res) => {
    res.status(200).send(loginPage());
  });

  router.post("/login", (req, res) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!checkAdminPassword(password)) {
      return res.status(401).send(loginPage("Incorrect password."));
    }
    issueSessionCookie(res);
    return res.redirect(302, "/admin");
  });

  router.post("/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  });

  router.use(requireAdminSession);

  router.get("/", (_req, res) => {
    res.status(200).send(dashboardShell());
  });

  router.get("/api/dashboard", async (_req, res) => {
    try {
      const [bookings, checkins, checkouts, parking, liability] = await Promise.all([
        listObjects(SHEETS.BOOKINGS, 0),
        listObjects(SHEETS.STORAGE_CHECK_IN, 0),
        listObjects(SHEETS.STORAGE_CHECK_OUT, 0),
        listObjects(SHEETS.PARKING_LIABILITY, 0),
        listObjects(SHEETS.LIABILITY_REPORT, 0)
      ]);
      const inProgress = bookings.filter(b => b.Status === "IN_PROGRESS").length;
      const completed = bookings.filter(b => b.Status === "COMPLETED").length;
      res.status(200).json({
        kpis: [
          { label: "Total jobs", value: bookings.length },
          { label: "In progress", value: inProgress },
          { label: "Completed", value: completed },
          { label: "Check-ins", value: checkins.length },
          { label: "Check-outs", value: checkouts.length },
          { label: "Parking liability reports", value: parking.length },
          { label: "Liability reports", value: liability.length }
        ]
      });
    } catch (error) {
      log.error("admin dashboard load failed", error);
      res.status(500).json({ error: "Failed to load dashboard." });
    }
  });

  router.get("/api/table/:tab", async (req, res) => {
    const sheetName = TAB_SHEETS[req.params.tab];
    if (!sheetName) return res.status(404).json({ error: "Unknown tab." });
    try {
      const rows = await listObjects(sheetName, 0);
      res.status(200).json({ columns: SCHEMA[sheetName] ?? [], rows: rows.reverse() });
    } catch (error) {
      log.error("admin table load failed", error, { tab: req.params.tab });
      res.status(500).json({ error: "Failed to load data." });
    }
  });

  return router;
}
