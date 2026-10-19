// A student's settings, saved with their account in the `settings` column of `planners`.
import { TERMS } from "./polyu-calendar";

/** How long before an event its reminders can fire, in minutes, with the words shown for each. */
export const REMINDER_OPTIONS = [
  [10080, "1 week before"],
  [4320, "3 days before"],
  [1440, "1 day before"],
  [180, "3 hours before"],
  [60, "1 hour before"],
  [15, "15 minutes before"],
];

export const VIEW_OPTIONS = [
  ["list", "List"],
  ["month", "Month"],
  ["week", "Week"],
];

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
const isPercent = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 100;

/** A saved grade breakdown, checked like any other stored input; null if it is not usable. */
function cleanBreakdown(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.rows)) return null;
  const rows = raw.rows
    .filter((row) => row && isPercent(row.weight) && text(row.name, 120))
    .slice(0, 30)
    .map((row) => ({ name: text(row.name, 120), weight: row.weight }));
  const ref = raw.reference && typeof raw.reference === "object" ? raw.reference : null;
  return {
    course: text(raw.course, 120),
    total: typeof raw.total === "number" && Number.isFinite(raw.total) ? raw.total : null,
    rows,
    reference: ref && text(ref.message, 600)
      ? {
          matches: typeof ref.matches === "boolean" ? ref.matches : null,
          message: text(ref.message, 600),
          sourceUrl: /^https:\/\//.test(ref.sourceUrl || "") ? text(ref.sourceUrl, 300) : null,
        }
      : null,
  };
}

const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/**
 * Settings = {
 *   reminders: number[],          // minutes before each event; [] means no reminders
 *   semester: string | null,      // a TERMS id, "other", or null for "whichever term is running"
 *   weekOneMonday: string | null, // ISO date, used only when semester is "other"
 *   defaultView: "list" | "month" | "week",
 *   weekStart: "mon" | "sun",     // first column of the calendar; PolyU teaching weeks are Monday to Sunday regardless
 *   noClassCourses: string[],     // courses (by courseKey in lib/review.js) the student said have no classes, so they are not asked again
 *   breakdowns: { [courseKey]: { course, total, rows: [{ name, weight }], reference } },
 *                                 // each course's grade breakdown as read from its outline at the last upload, shown in the sidebar
 *   ignoredGaps: string[]         // numbered items the student said are not missing ("ama1702|exercise|8"), see numberGaps
 * }
 * Stored values are checked like any other input: anything missing or malformed falls back to the default.
 */
export function makeSettings(saved) {
  const raw = saved && typeof saved === "object" ? saved : {};
  const allowed = REMINDER_OPTIONS.map(([minutes]) => minutes);
  return {
    reminders: Array.isArray(raw.reminders) ? allowed.filter((minutes) => raw.reminders.includes(minutes)) : [1440, 60],
    semester: raw.semester === "other" || TERMS.some((term) => term.id === raw.semester) ? raw.semester : null,
    weekOneMonday: isIsoDate(raw.weekOneMonday) ? raw.weekOneMonday : null,
    defaultView: VIEW_OPTIONS.some(([key]) => key === raw.defaultView) ? raw.defaultView : "month",
    weekStart: raw.weekStart === "sun" ? "sun" : "mon",
    noClassCourses: Array.isArray(raw.noClassCourses)
      ? raw.noClassCourses.filter((key) => typeof key === "string" && key.length > 0 && key.length <= 60).slice(0, 100)
      : [],
    breakdowns: Object.fromEntries(
      Object.entries(raw.breakdowns && typeof raw.breakdowns === "object" ? raw.breakdowns : {})
        .filter(([key]) => key.length > 0 && key.length <= 60)
        .map(([key, value]) => [key, cleanBreakdown(value)])
        .filter(([, value]) => value)
        .slice(0, 40),
    ),
    ignoredGaps: Array.isArray(raw.ignoredGaps)
      ? raw.ignoredGaps.filter((key) => typeof key === "string" && key.length > 0 && key.length <= 200).slice(0, 200)
      : [],
  };
}

/** The reminders in words, e.g. "1 day and 1 hour before". */
export function describeReminders(reminders) {
  const words = REMINDER_OPTIONS.filter(([minutes]) => reminders.includes(minutes)).map(([, label]) => label.replace(" before", ""));
  if (words.length === 0) return "";
  return `${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ` : ""}${words.at(-1)} before`;
}
