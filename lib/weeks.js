// Week-to-date rules (WEEK_TO_DATE_SPEC): Gemini copies the raw timing ("Week 6", "End of Week 10", "24 hours before
// Week 6 class"); this file works out the date from the academic calendar, applies holidays, and returns a flag for
// every assumption it had to make. Nothing here guesses silently. Results are only ever offered as suggestions
// (product rule 1); the student accepts them.
import calendar from "../data/academic-calendar.js";

export const FLAGS = [
  "ASSUMED_TIME", "APPROXIMATE_DATE", "NEEDS_CLASS_TIME", "DATE_TBA", "NOT_TEACHING_WEEK", "INVALID_WEEK",
  "CANCELLED_HOLIDAY", "WEEKDAY_MISMATCH", "WEEK_MISMATCH", "YEAR_SUSPECT", "OUT_OF_SEMESTER",
];

// What each flag says to a student, in plain words.
export const FLAG_LABELS = {
  ASSUMED_TIME: "Time not given: 23:59 assumed",
  APPROXIMATE_DATE: "Only the week is given",
  NEEDS_CLASS_TIME: "Needs your class time",
  DATE_TBA: "Date not announced yet",
  NOT_TEACHING_WEEK: "Not a teaching week",
  INVALID_WEEK: "Week number looks wrong",
  CANCELLED_HOLIDAY: "Cancelled: public holiday",
  WEEKDAY_MISMATCH: "Weekday and date don't match",
  WEEK_MISMATCH: "Week and date don't match",
  YEAR_SUSPECT: "Year looks wrong",
  OUT_OF_SEMESTER: "Outside this semester",
};

// Flags that mean a student must look before trusting the event. The rest are information only. A missing exam
// date is normal (the university sets it later), so DATE_TBA is information unless the exam came from a picture.
export const REVIEW_FLAGS = new Set([
  "APPROXIMATE_DATE", "NEEDS_CLASS_TIME", "INVALID_WEEK", "WEEKDAY_MISMATCH", "WEEK_MISMATCH", "YEAR_SUSPECT", "OUT_OF_SEMESTER",
]);

const DAY_MS = 86400000;
const toMs = (iso) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso, days) => toIso(toMs(iso) + days * DAY_MS);
/** 0 = Monday ... 6 = Sunday, as in the spec. */
export const weekdayOf = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

const DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
/** "Tue", "tuesday", 1 -> 1; anything else -> -1. */
export function dayIndex(day) {
  if (Number.isInteger(day)) return day >= 0 && day <= 6 ? day : -1;
  return DAY_NAMES.indexOf(String(day || "").slice(0, 3).toLowerCase());
}

/** The spec's semester keys from the planner's term ids ("2026-27-s1" -> "S1"). */
export function semesterOf(termId) {
  return { "2026-27-s1": "S1", "2026-27-s2": "S2", "2026-27-summer": "SUMMER" }[termId] || termId;
}

const semester = (sem) => calendar.semesters[sem] || null;

/** Monday of week N: week 1 plus 7 days a week, plus 7 more for each skipped calendar week on or before it. */
export function weekStart(sem, week) {
  const s = semester(sem);
  if (!s || !Number.isInteger(week)) return null;
  let start = addDays(s.teachingWeek1Monday, 7 * (week - 1));
  for (const [from] of [...s.skippedCalendarWeeks].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (from <= start) start = addDays(start, 7);
  }
  return start;
}

export const dateOf = (sem, week, weekday) => {
  const start = weekStart(sem, week);
  return start && weekday >= 0 && weekday <= 6 ? addDays(start, weekday) : null;
};

/** The teaching week a date falls in (including the revision week after the last one), or null. */
export function weekOf(sem, date) {
  const s = semester(sem);
  if (!s) return null;
  for (let week = 1; week <= s.teachingWeeks + 1; week++) {
    const start = weekStart(sem, week);
    if (date >= start && date <= addDays(start, 6)) return week;
  }
  return null;
}

/** The holiday that cancels a session on this date, or null. An evening holiday only cancels sessions from 18:00. */
export function holidayOn(date, startTime) {
  for (const day of calendar.noClassDays) {
    const hit = day.date ? day.date === date : date >= day.range[0] && date <= day.range[1];
    if (!hit) continue;
    if (day.scope === "evening" && !(startTime && startTime >= calendar.eveningStartsAt)) continue;
    return { name: day.name };
  }
  return null;
}

/** First and last day anything of this semester can be: week 1 Monday to the end of the exam period. */
export function semesterRange(sem) {
  const s = semester(sem);
  return s ? { start: s.teachingWeek1Monday, end: s.examPeriod[1] } : null;
}

/** Minutes after midnight for "HH:MM". */
const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/**
 * Works out when one item happens. `timing` is what the model copied:
 *   { kind, week, weekday, time, date, offsetMinutes, statedWeekday, statedWeek }
 *   kind: "date" (a written date), "week_day", "end_of_week", "week_only", "before_class", "day_before_class",
 *         "after_last_class", "exam_period", or "none".
 * `context`: { sem, session (a class, test or exam: holidays cancel these, never a deadline), classDay, classTime,
 *   lastClassDate }.
 * Returns { start, end, time, allDay, status, flags, holiday, suggestion } where start/end are ISO dates or null,
 * status is "ok", "cancelled" or "unresolved", and `suggestion` is a corrected date for YEAR_SUSPECT.
 */
export function resolve(timing = {}, context = {}) {
  const { sem, session = false } = context;
  const flags = [];
  const out = (fields) => {
    const result = { start: null, end: null, time: timing.time || null, allDay: !timing.time, status: "ok", holiday: null, suggestion: null, ...fields, flags };
    // Holidays cancel classes, tests and exams on that day, never a submission deadline.
    if (session && result.start && !result.end) {
      const holiday = holidayOn(result.start, result.time);
      if (holiday) {
        flags.push("CANCELLED_HOLIDAY");
        result.status = "cancelled";
        result.holiday = holiday.name;
      }
    }
    return result;
  };
  const s = semester(sem);
  if (!s) return out({ status: "unresolved" });

  // Week numbers outside the semester are reported, and week 14 of a 13-week semester is the revision week.
  const checkWeek = (week) => {
    if (!Number.isInteger(week) || week < 1 || week > s.teachingWeeks + 1) {
      flags.push("INVALID_WEEK");
      return false;
    }
    if (week === s.teachingWeeks + 1) flags.push("NOT_TEACHING_WEEK");
    return true;
  };
  const classDay = dayIndex(context.classDay);
  const classTime = /^\d{2}:\d{2}$/.test(context.classTime || "") ? context.classTime : null;

  switch (timing.kind) {
    case "date": {
      const date = timing.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return out({ status: "unresolved" });
      const range = semesterRange(sem);
      const stated = dayIndex(timing.statedWeekday);
      let suggestion = null;
      if (date < range.start || date > range.end) {
        // A date copied from last year's outline: the same day and month this year, if the outline's weekday agrees.
        const candidates = [range.start.slice(0, 4), range.end.slice(0, 4)].map((year) => `${year}${date.slice(4)}`);
        const fixed = candidates.find((c) => c >= range.start && c <= range.end && (stated === -1 || weekdayOf(c) === stated));
        if (fixed && stated !== -1 && date.slice(0, 4) !== fixed.slice(0, 4)) {
          flags.push("YEAR_SUSPECT");
          suggestion = fixed;
        } else flags.push("OUT_OF_SEMESTER");
      } else if (stated !== -1 && weekdayOf(date) !== stated) flags.push("WEEKDAY_MISMATCH");
      if (Number.isInteger(timing.statedWeek) && weekOf(sem, date) !== null && weekOf(sem, date) !== timing.statedWeek) flags.push("WEEK_MISMATCH");
      return out({ start: date, suggestion });
    }
    case "week_day": {
      const day = dayIndex(timing.weekday);
      if (!checkWeek(timing.week) || day === -1) return out({ status: "unresolved" });
      return out({ start: dateOf(sem, timing.week, day) });
    }
    case "end_of_week": {
      if (!checkWeek(timing.week)) return out({ status: "unresolved" });
      if (!timing.time) flags.push("ASSUMED_TIME");
      return out({ start: dateOf(sem, timing.week, 6), time: timing.time || "23:59", allDay: false });
    }
    case "week_only": {
      if (!checkWeek(timing.week)) return out({ status: "unresolved" });
      if (classDay !== -1) return out({ start: dateOf(sem, timing.week, classDay), time: timing.time || classTime, allDay: !(timing.time || classTime) });
      flags.push("APPROXIMATE_DATE");
      return out({ start: weekStart(sem, timing.week), end: dateOf(sem, timing.week, 6), allDay: true });
    }
    case "before_class": {
      if (!checkWeek(timing.week)) return out({ status: "unresolved" });
      if (classDay === -1 || !classTime || !Number.isInteger(timing.offsetMinutes)) {
        flags.push("NEEDS_CLASS_TIME");
        return out({ status: "unresolved" });
      }
      const at = minutes(classTime) - timing.offsetMinutes;
      const dayShift = Math.floor(at / 1440);
      return out({ start: addDays(dateOf(sem, timing.week, classDay), dayShift), time: clock(at - dayShift * 1440), allDay: false });
    }
    case "day_before_class": {
      if (!checkWeek(timing.week)) return out({ status: "unresolved" });
      if (classDay === -1) {
        flags.push("NEEDS_CLASS_TIME");
        return out({ status: "unresolved" });
      }
      if (!timing.time) flags.push("ASSUMED_TIME");
      return out({ start: addDays(dateOf(sem, timing.week, classDay), -1), time: timing.time || "23:59", allDay: false });
    }
    case "after_last_class": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(context.lastClassDate || "")) {
        flags.push("NEEDS_CLASS_TIME");
        return out({ status: "unresolved" });
      }
      if (!timing.time) flags.push("ASSUMED_TIME");
      return out({ start: addDays(context.lastClassDate, 7), time: timing.time || "23:59", allDay: false });
    }
    case "exam_period": {
      flags.push("DATE_TBA");
      return out({ start: s.examPeriod[0], end: s.examPeriod[1], allDay: true, time: null });
    }
    default:
      return out({ status: "unresolved" });
  }
}
