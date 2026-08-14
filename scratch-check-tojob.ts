import { getCalendarEvent } from "./src/google/calendar";
import { parseCalendarEvent } from "./src/jobs/booking.service";

// Re-implement toJob's basePrice line to see what it produces for a brand-new event.
async function main() {
  const event = await getCalendarEvent("1vfq6tsp6cjb8b85i1v9hbv40n");
  const parsed = parseCalendarEvent(event!)!;
  console.log("parsed.price:", parsed.price, typeof parsed.price);
  const existing = undefined;
  const started = Boolean((existing as any)?.actualStart);
  const basePrice = started ? (existing as any)!.basePrice : parsed.price;
  console.log("computed basePrice:", basePrice);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
