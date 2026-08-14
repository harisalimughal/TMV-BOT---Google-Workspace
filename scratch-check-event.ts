import { getCalendarEvent } from "./src/google/calendar";
import { parseCalendarEvent } from "./src/jobs/booking.service";

async function main() {
  const event = await getCalendarEvent("1vfq6tsp6cjb8b85i1v9hbv40n");
  console.log("raw summary:", JSON.stringify(event?.summary));
  console.log("char codes:", [...(event?.summary ?? "")].map(c => c.charCodeAt(0)));
  console.log("parsed:", JSON.stringify(parseCalendarEvent(event!), null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
