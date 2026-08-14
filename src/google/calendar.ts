import { google, calendar_v3 } from "googleapis";
import { createGoogleAuth, env, SCOPES } from "../config/env";
import { withRetry } from "../utils/retry";

let clientPromise: Promise<calendar_v3.Calendar> | null = null;

async function client(): Promise<calendar_v3.Calendar> {
  if (!clientPromise) {
    clientPromise = createGoogleAuth(SCOPES.CALENDAR)
      .then(auth => google.calendar({ version: "v3", auth }))
      .catch(error => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

export interface ListEventsOptions {
  /** Include cancelled events so the sync can reconcile deletions (§P1-5). */
  showDeleted?: boolean;
}

export async function listCalendarEvents(
  timeMin: string,
  timeMax: string,
  options: ListEventsOptions = {}
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = await client();
  const response = await withRetry("calendar.events.list", () =>
    calendar.events.list({
      calendarId: env.calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      showDeleted: options.showDeleted ?? false,
      orderBy: "startTime",
      maxResults: 250
    })
  );
  return response.data.items ?? [];
}

export async function getCalendarEvent(eventId: string): Promise<calendar_v3.Schema$Event | null> {
  const calendar = await client();
  const response = await withRetry("calendar.events.get", () =>
    calendar.events.get({ calendarId: env.calendarId, eventId })
  );
  return response.data ?? null;
}
