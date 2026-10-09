// Owner: Calendar person. Build .ics with reminders (use the `ics` package).
import { createEvents } from "ics";

const TYPE_LABELS = { class: "Class", deadline: "Deadline", quiz: "Quiz", exam: "Exam" };

/** Small stable string hash (djb2); enough to tell events apart inside one student's calendar. */
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** One alarm per value in remindMinutes. Events with date === null are skipped. Returns the .ics text. */
export function toIcs(events, remindMinutes = [1440, 60]) {
  const seen = new Map();
  const items = events
    .filter((event) => event.date !== null)
    .map((event) => {
      const [year, month, day] = event.date.split("-").map(Number);
      const title = [event.course, event.title].filter(Boolean).join(": ");

      // The id depends only on course and title, so exporting again after a date change
      // gives the calendar the same entry to update rather than a second copy.
      const key = `${event.course}|${event.title}`.toLowerCase();
      const nth = seen.get(key) || 0;
      seen.set(key, nth + 1);

      const item = {
        uid: `${hash(key)}-${nth}@semester-planner`,
        title,
        description: [TYPE_LABELS[event.type], event.note, event.sourceQuote && `Outline: "${event.sourceQuote}"`]
          .filter(Boolean)
          .join("\n"),
        alarms: remindMinutes.map((minutes) => ({
          action: "display",
          description: title,
          trigger: { minutes, before: true },
        })),
      };

      if (event.time) {
        const [hour, minute] = event.time.split(":").map(Number);
        // "local" keeps the wall-clock time the outline states, whatever timezone the calendar is in.
        // The Event shape has no end time, so the length is assumed: an hour, or for a deadline a short
        // block starting at the due time (`ics` writes an invalid DURATION for a zero-length event).
        return {
          ...item,
          start: [year, month, day, hour, minute],
          startInputType: "local",
          startOutputType: "local",
          duration: { minutes: event.type === "deadline" ? 15 : 60 },
        };
      }
      // No time in the outline: an all-day entry. Its alarms count back from midnight at the start of the day.
      const next = new Date(Date.UTC(year, month - 1, day + 1));
      return {
        ...item,
        start: [year, month, day],
        end: [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()],
      };
    });

  const { error, value } = createEvents(items);
  if (error) throw new Error(`Could not build the calendar file: ${error.message || error}`);
  return value;
}
