import { DateTime } from "luxon";
import { listCalendarEvents } from "./src/google/calendar";
import { parseCalendarEvent } from "./src/jobs/booking.service";
import { env } from "./src/config/env";

async function main() {
  const day = DateTime.now().setZone(env.timezone).plus({ days: 1 });
  const start = day.startOf("day");
  const end = day.endOf("day");
  const events = await listCalendarEvents(start.toUTC().toISO()!, end.toUTC().toISO()!, { showDeleted: true });
  const target = events.find(e => e.id === "1vfq6tsp6cjb8b85i1v9hbv40n");
  console.log("found:", !!target);
  console.log("summary:", JSON.stringify(target?.summary));
  console.log("parsed price:", parseCalendarEvent(target!)?.price);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
