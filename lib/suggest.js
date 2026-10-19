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

/**
 * Every meeting of a weekly class: that weekday in each teaching week, leaving out days with no classes.
 * `weeks` is what the outline says about this class, read by the model: { from, to } for "Weeks 2-13", and
 * `skip` for "No lecture in Week 8" (teaching week numbers). Anything that is not a week of this term is ignored.
 * Returns { dates, note }; no dates if the weekday or the term is unknown. Make-up classes are not known.
 */
export function suggestWeekly(weekday, term, weeks = {}) {
  const day = WEEKDAYS.indexOf(String(weekday || "").slice(0, 3).toLowerCase());
  if (day === -1 || !term) return { dates: [], note: "" };
  const mondays = weekMondays(term);
  const isWeek = (n) => Number.isInteger(n) && n >= 1 && n <= mondays.length;
  const from = isWeek(weeks.from) ? weeks.from : 1;
  const to = isWeek(weeks.to) && weeks.to >= from ? weeks.to : mondays.length;
  const skip = new Set((Array.isArray(weeks.skip) ? weeks.skip : []).filter(isWeek));

  const all = mondays.map((monday, i) => ({ week: i + 1, date: addDays(monday, day) })).filter(({ week }) => week >= from && week <= to);
  const cancelled = all.filter(({ week }) => skip.has(week));
  const held = all.filter(({ week, date }) => !skip.has(week) && !term.noClass.includes(date));
  const holidays = all.filter(({ week, date }) => !skip.has(week) && term.noClass.includes(date));
  if (held.length === 0) return { dates: [], note: "" };

  const range = from > 1 || to < mondays.length ? ` Weeks ${from} to ${to} only, as the outline says.` : "";
  const noClass = cancelled.length > 0 ? ` Left out because the outline says there is no class: ${cancelled.map(({ week, date }) => `week ${week} (${short(date)})`).join(", ")}.` : "";
  const left = holidays.length > 0 ? ` Left out because there are no classes: ${holidays.map(({ date }) => short(date)).join(", ")}.` : "";
  const unknown = term.exams ? "" : " Breaks and holidays are not known for this semester, so remove any class that falls in one.";
  const dates = held.map(({ date }) => date);
  return {
    dates,
    note: `${dates.length} weekly classes suggested, ${short(dates[0])} to ${long(dates.at(-1))} (${term.label}).${range}${noClass}${left}${unknown}`,
  };
}

/** For an exam with no date: the exam period, never a suggested day. "" if the term's exam period is not known. */
export function examPeriodNote(term) {
  return term?.exams ? `The exam period is ${short(term.exams[0])} to ${long(term.exams[1])}.` : "";
}
