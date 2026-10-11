// Works out a date from "Week 7, Tue". The model only copies the week number and weekday from the outline;
// the arithmetic is done here, and the result is only ever a suggestion the student accepts or ignores.
import { addDays, formatDate, startOfWeek } from "./dates";
import { weekMondays } from "./polyu-calendar";

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const short = (iso) => formatDate(iso, { day: "numeric", month: "short" });
const long = (iso) => formatDate(iso, { day: "numeric", month: "short", year: "numeric" });

/**
 * The Monday of teaching week `week`, with where it came from. Order of trust: a date the outline itself
 * ties to that week, then the term's calendar. `anchors` is [{ week, date }] read from the outline.
 * Returns null if the week is not in the term.
 */
export function weekStart(week, term, anchors = []) {
  const fromTerm = term ? weekMondays(term)[week - 1] : undefined;
  const anchor = anchors.find((a) => a.week === week);
  if (anchor) {
    const monday = startOfWeek(anchor.date);
    return {
      monday,
      basis: `the outline puts week ${week} at ${short(anchor.date)}`,
      // The outline and the calendar disagreeing usually means the outline is for another semester.
      conflict: fromTerm && fromTerm !== monday ? `${term.label} has week ${week} starting ${short(fromTerm)}` : "",
    };
  }
  if (!fromTerm) return null;
  return { monday: fromTerm, basis: `${term.label}, week 1 starting ${short(term.weekOne)}`, conflict: "" };
}

/**
 * What to suggest for an undated item the outline places in a numbered week.
 * Returns { dates, note, conflict }: one date when the outline also states the weekday, otherwise no date
 * and a note giving the week's range. `conflict` is true when the outline and the calendar disagree.
 */
export function suggestForWeek(week, weekday, term, anchors) {
  const start = Number.isInteger(week) && week > 0 ? weekStart(week, term, anchors) : null;
  if (!start) return { dates: [], note: "", conflict: false };
  const day = WEEKDAYS.indexOf(String(weekday || "").slice(0, 3).toLowerCase());
  const range = `Week ${week} is ${short(start.monday)} to ${long(addDays(start.monday, 6))} (${start.basis}).`;
  const clash = start.conflict ? ` But ${start.conflict}; check this outline is for the semester you chose.` : "";
  if (day === -1) {
    return { dates: [], note: `${range} The outline does not say which day.${clash}`, conflict: Boolean(clash) };
  }
  const date = addDays(start.monday, day);
  const holiday = term?.noClass?.includes(date) ? " There are no classes that day, so it may have been moved." : "";
  return {
    dates: [date],
    note: `Suggested date ${formatDate(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}, worked out from week ${week} and the weekday in the outline. ${range}${holiday}${clash}`,
    conflict: Boolean(clash),
  };
}

/** For an exam with no date: the exam period, never a suggested day. "" if the term's exam period is not known. */
export function examPeriodNote(term) {
  return term?.exams ? `The exam period is ${short(term.exams[0])} to ${long(term.exams[1])}.` : "";
}
