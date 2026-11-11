// The 29 test cases of WEEK_TO_DATE_SPEC, taken from real course files. All S1 unless marked.
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const { resolve, weekStart, weekOf } = await import(pathToFileURL(`${ROOT}/lib/weeks.js`).href);

const S1 = { sem: "S1" };
const cls = (day, time) => ({ sem: "S1", classDay: day, classTime: time });
const has = (r, flag) => r.flags.includes(flag);
const cases = [
  [1, "Week 4, Sunday", () => resolve({ kind: "week_day", week: 4, weekday: "Sun" }, S1).start === "2026-09-27"],
  [2, "Sunday Week 8", () => resolve({ kind: "week_day", week: 8, weekday: "Sunday" }, S1).start === "2026-10-25"],
  [3, "Week 7 Saturday", () => resolve({ kind: "week_day", week: 7, weekday: "Sat" }, S1).start === "2026-10-17"],
  [4, "Week 12 Saturday", () => resolve({ kind: "week_day", week: 12, weekday: "Sat" }, S1).start === "2026-11-21"],
  [5, "1 Nov, Sunday is week 9", () => { const r = resolve({ kind: "date", date: "2026-11-01", statedWeekday: "Sun" }, S1); return r.start === "2026-11-01" && r.flags.length === 0 && weekOf("S1", "2026-11-01") === 9; }],
  [6, "End of Week 10", () => { const r = resolve({ kind: "end_of_week", week: 10 }, S1); return r.start === "2026-11-08" && r.time === "23:59" && has(r, "ASSUMED_TIME"); }],
  [7, "Week 7 Sunday 23:59", () => { const r = resolve({ kind: "week_day", week: 7, weekday: "Sun", time: "23:59" }, S1); return r.start === "2026-10-18" && r.time === "23:59"; }],
  [8, "Week 5 Wed class 08:30", () => { const r = resolve({ kind: "week_day", week: 5, weekday: "Wed", time: "08:30" }, { sem: "S1", session: true }); return r.start === "2026-09-30" && r.time === "08:30" && r.status === "ok"; }],
  [9, "Week 13 Sunday", () => resolve({ kind: "week_day", week: 13, weekday: "Sun" }, S1).start === "2026-11-29"],
  [10, "Week 8 Monday class 14:30 is cancelled", () => { const r = resolve({ kind: "week_day", week: 8, weekday: "Mon", time: "14:30" }, { sem: "S1", session: true }); return r.status === "cancelled" && r.start === "2026-10-19" && has(r, "CANCELLED_HOLIDAY"); }],
  [11, "Week 5 Thursday class 15:30 (National Day)", () => { const r = resolve({ kind: "week_day", week: 5, weekday: "Thu", time: "15:30" }, { sem: "S1", session: true }); return r.status === "cancelled" && r.start === "2026-10-01" && r.holiday === "National Day"; }],
  [12, "Fri 25 Sep class 19:30 (evening holiday)", () => resolve({ kind: "date", date: "2026-09-25", time: "19:30" }, { sem: "S1", session: true }).status === "cancelled"],
  [13, "Fri 25 Sep class 10:30 goes ahead", () => resolve({ kind: "date", date: "2026-09-25", time: "10:30" }, { sem: "S1", session: true }).status === "ok"],
  [14, "Deadline Sat 10 Oct 18:00 stands", () => { const r = resolve({ kind: "date", date: "2026-10-10", time: "18:00" }, { sem: "S1", session: false }); return r.status === "ok" && !has(r, "CANCELLED_HOLIDAY"); }],
  [15, "Class Sat 10 Oct (Info Day)", () => { const r = resolve({ kind: "date", date: "2026-10-10" }, { sem: "S1", session: true }); return r.status === "cancelled" && r.holiday === "PolyU Undergraduate Info Day"; }],
  [16, "Mon, Sep 1 is a Tuesday", () => { const r = resolve({ kind: "date", date: "2026-09-01", statedWeekday: "Mon" }, S1); return r.start === "2026-09-01" && has(r, "WEEKDAY_MISMATCH"); }],
  [17, "3-Sept-25, Thursday", () => { const r = resolve({ kind: "date", date: "2025-09-03", statedWeekday: "Thu" }, S1); return has(r, "YEAR_SUSPECT") && r.suggestion === "2026-09-03"; }],
  [18, "8 March 2026", () => has(resolve({ kind: "date", date: "2026-03-08" }, S1), "OUT_OF_SEMESTER")],
  [19, "Week 14 make-up, Dec 1", () => { const r = resolve({ kind: "week_day", week: 14, weekday: "Tue" }, S1); return r.start === "2026-12-01" && has(r, "NOT_TEACHING_WEEK"); }],
  [20, "Week 0 and Week 15", () => has(resolve({ kind: "week_day", week: 0, weekday: "Mon" }, S1), "INVALID_WEEK") && has(resolve({ kind: "week_day", week: 15, weekday: "Mon" }, S1), "INVALID_WEEK")],
  [21, "24 hours before Week 6 class, class time unknown", () => { const r = resolve({ kind: "before_class", week: 6, offsetMinutes: 1440 }, S1); return r.start === null && has(r, "NEEDS_CLASS_TIME"); }],
  [22, "24 hours before Week 6 class, class Tue 08:30", () => { const r = resolve({ kind: "before_class", week: 6, offsetMinutes: 1440 }, cls("Tue", "08:30")); return r.start === "2026-10-05" && r.time === "08:30"; }],
  [23, "Final exam TBA by AR", () => { const r = resolve({ kind: "exam_period" }, S1); return r.start === "2026-12-03" && r.end === "2026-12-18" && has(r, "DATE_TBA"); }],
  [24, "S2 Week 4 start", () => weekStart("S2", 4) === "2027-02-01"],
  [25, "S2 Week 5 start after Lunar New Year", () => weekStart("S2", 5) === "2027-02-15"],
  [26, "S2 Week 13 start", () => weekStart("S2", 13) === "2027-04-12"],
  [27, "SUMMER Week 7 start", () => weekStart("SUMMER", 7) === "2027-07-05"],
  [28, "Fri 25 Sep class 20:30 to 21:20", () => resolve({ kind: "date", date: "2026-09-25", time: "20:30" }, { sem: "S1", session: true }).status === "cancelled"],
  [29, "Fri 25 Sep class 16:30 to 18:20", () => resolve({ kind: "date", date: "2026-09-25", time: "16:30" }, { sem: "S1", session: true }).status === "ok"],
];
// A few more from the spec's phrase table.
const extra = [
  ["Week only, class day known", () => resolve({ kind: "week_only", week: 12 }, cls("Mon", "14:30")).start === "2026-11-16"],
  ["Week only, class day unknown is the whole week", () => { const r = resolve({ kind: "week_only", week: 12 }, S1); return r.start === "2026-11-16" && r.end === "2026-11-22" && has(r, "APPROXIMATE_DATE"); }],
  ["Day before Week 9 class", () => { const r = resolve({ kind: "day_before_class", week: 9 }, cls("Wed", "10:30")); return r.start === "2026-10-27" && r.time === "23:59" && has(r, "ASSUMED_TIME"); }],
  ["One week after the last lecture", () => resolve({ kind: "after_last_class" }, { sem: "S1", lastClassDate: "2026-11-24" }).start === "2026-12-01"],
];
for (const [n, name, check] of cases) console.log(`${check() ? "ok" : "FAIL"} ${n}. ${name}`);
for (const [name, check] of extra) console.log(`${check() ? "ok" : "FAIL"} ${name}`);
