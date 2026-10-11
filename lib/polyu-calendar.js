// PolyU teaching weeks, copied by hand from the university's Academic Calendar (2026/27 page).
// It covers PolyU only and only the terms listed here: add next year's terms by hand each year.
//
// The pattern (confirmed by the team): a semester is 13 teaching weeks, each Monday to Sunday,
// from week 1 Monday to week 13 Sunday. A break week is skipped in the count, not numbered.
// Summer Term has the same shape with 7 weeks. So only week 1 and the breaks are stored;
// every other week is worked out from them.
import { addDays, formatDate, startOfWeek } from "./dates";

export const TERMS = [
  {
    id: "2026-27-s1",
    label: "2026/27 Semester 1",
    weekOne: "2026-08-31", // "Semester 1 commences": Mon 31 Aug 2026
    weeks: 13,
    breakWeeks: [], // no teaching break in Semester 1
    teachingEnds: "2026-11-28", // "Semester 1 teaching ends": Sat 28 Nov 2026 (used only by the self-check below)
    exams: ["2026-12-03", "2026-12-18"], // "Semester 1 examination period": 3 to 18 Dec 2026
    // Days with no classes inside the teaching weeks: 26 Sep, 1 Oct, 10 Oct (Info Day), 19 Oct 2026.
    noClass: ["2026-09-26", "2026-10-01", "2026-10-10", "2026-10-19"],
  },
  {
    id: "2026-27-s2",
    label: "2026/27 Semester 2",
    weekOne: "2027-01-11", // "Semester 2 commences": Mon 11 Jan 2027
    weeks: 13,
    breakWeeks: ["2027-02-08"], // Lunar New Year break, 6 to 14 Feb 2027: the week of Mon 8 Feb is not a teaching week
    teachingEnds: "2027-04-17", // "Semester 2 teaching ends": Sat 17 Apr 2027
    exams: ["2027-04-22", "2027-05-08"], // "Semester 2 examination period": 22 Apr to 8 May 2027
    // 6 Feb is the first day of the break and falls in week 4. 26, 27, 29 Mar and 5 Apr 2027 are holidays.
    noClass: ["2027-02-06", "2027-02-07", "2027-03-26", "2027-03-27", "2027-03-29", "2027-04-05"],
  },
  {
    id: "2026-27-summer",
    label: "2026/27 Summer Term",
    weekOne: "2027-05-24", // "Summer Term commences": Mon 24 May 2027
    weeks: 7,
    breakWeeks: [],
    teachingEnds: "2027-07-10", // "Summer Term teaching ends": Sat 10 Jul 2027
    exams: ["2027-07-12", "2027-07-17"], // "Summer Term examination period": 12 to 17 Jul 2027
    noClass: ["2027-06-09", "2027-07-01"], // 9 Jun and 1 Jul 2027
  },
];

/** The Monday of every teaching week, in order: weekMondays(term)[0] is week 1. */
export function weekMondays(term) {
  const mondays = [];
  for (let monday = term.weekOne; mondays.length < term.weeks; monday = addDays(monday, 7)) {
    if (!term.breakWeeks.includes(monday)) mondays.push(monday);
  }
  return mondays;
}

/** First and last day an event of this term can fall on: week 1 Monday to the end of the exam period. */
export function termRange(term) {
  const lastSunday = addDays(weekMondays(term).at(-1), 6);
  // A term typed in by hand has no known exam period, so leave three weeks after teaching for exams.
  return { start: term.weekOne, end: term.exams ? term.exams[1] : addDays(lastSunday, 21) };
}

const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/**
 * The term a student chose in the upload form. `semester` is a TERMS id, or "other" with the Monday of week 1
 * typed by hand: that gets the same 13-week pattern with no breaks, holidays or exam period known.
 * Returns null when neither is usable.
 */
export function resolveTerm(semester, weekOne) {
  const known = TERMS.find((term) => term.id === semester);
  if (known) return known;
  if (semester !== "other" || !isIsoDate(weekOne)) return null;
  const monday = startOfWeek(weekOne);
  return {
    id: "other",
    label: `13 weeks from ${formatDate(monday, { day: "numeric", month: "short", year: "numeric" })}`,
    weekOne: monday,
    weeks: 13,
    breakWeeks: [],
    exams: null,
    noClass: [],
  };
}

// Self-check: the Saturday of the last teaching week must be the calendar's own "teaching ends" day.
// A mismatch means a break week is missing or week 1 is wrong, which would shift every suggested date.
for (const term of TERMS) {
  const lastSaturday = addDays(weekMondays(term).at(-1), 5);
  if (lastSaturday !== term.teachingEnds) {
    throw new Error(`polyu-calendar: ${term.label} works out to end on ${lastSaturday}, but the calendar says ${term.teachingEnds}`);
  }
}
