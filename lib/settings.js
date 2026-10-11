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

const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/**
 * Settings = {
 *   reminders: number[],          // minutes before each event; [] means no reminders
 *   semester: string | null,      // a TERMS id, "other", or null for "whichever term is running"
 *   weekOneMonday: string | null, // ISO date, used only when semester is "other"
 *   defaultView: "list" | "month" | "week",
 *   weekStart: "mon" | "sun"      // first column of the calendar; PolyU teaching weeks are Monday to Sunday regardless
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
  };
}

/** The reminders in words, e.g. "1 day and 1 hour before". */
export function describeReminders(reminders) {
  const words = REMINDER_OPTIONS.filter(([minutes]) => reminders.includes(minutes)).map(([, label]) => label.replace(" before", ""));
  if (words.length === 0) return "";
  return `${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ` : ""}${words.at(-1)} before`;
}
