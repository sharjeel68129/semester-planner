// Checks for the pure modules: PolyU calendar, suggested dates, the 100% check, review and merge helpers.
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { TERMS, weekMondays, termRange, resolveTerm } = await lib("polyu-calendar");
const { suggestForWeek, suggestWeekly, examPeriodNote } = await lib("suggest");
const { checkAssessments, describeProblems, problemCount } = await lib("assess");
const { needsReview, canExport, mergeEvents, expandWeekly, openChoices, chooseSection } = await lib("review");
const { makeEvent } = await lib("schema");

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};

const [s1, s2, summer] = TERMS;
for (const t of TERMS) console.log(t.label, weekMondays(t).map((m, i) => `${i + 1}:${m}`).join(" "), termRange(t));
eq("s1 week 13 Monday", weekMondays(s1)[12], "2026-11-23");
eq("s2 week 5 skips the break", weekMondays(s2)[4], "2027-02-15");
eq("s2 week 13 Monday", weekMondays(s2)[12], "2027-04-12");
eq("summer week 7 Monday", weekMondays(summer)[6], "2027-07-05");
eq("s1 range", termRange(s1), { start: "2026-08-31", end: "2026-12-18" });

eq("week 7 Tue s1", suggestForWeek(7, "Tue", s1, []).dates, ["2026-10-13"]);
eq("week 7 Tuesday long name", suggestForWeek(7, "Tuesday", s1, []).dates, ["2026-10-13"]);
eq("week 13 Sun s1", suggestForWeek(13, "Sun", s1, []).dates, ["2026-11-29"]);
eq("week 5 Mon s2 (after break)", suggestForWeek(5, "Mon", s2, []).dates, ["2027-02-15"]);
eq("no weekday -> no date", suggestForWeek(7, null, s1, []).dates, []);
console.log("     note:", suggestForWeek(7, null, s1, []).note);
eq("week 14 not in term", suggestForWeek(14, "Mon", s1, []), { dates: [], note: "", conflict: false });
eq("week null", suggestForWeek(null, "Mon", s1, []).dates, []);
const anchored = suggestForWeek(6, "Tue", s1, [{ week: 6, date: "2026-10-06" }]);
eq("anchor agrees with calendar", [anchored.dates, anchored.conflict], [["2026-10-06"], false]);
const clash = suggestForWeek(6, "Tue", s1, [{ week: 6, date: "2026-02-17" }]);
eq("anchor disagrees -> conflict", [clash.dates, clash.conflict], [["2026-02-17"], true]);
console.log("     note:", clash.note);
const hol = suggestForWeek(5, "Thu", s1, []);
eq("holiday date still suggested", hol.dates, ["2026-10-01"]);
console.log("     note:", hol.note);
const other = resolveTerm("other", "2026-09-09");
eq("other snaps to Monday", other.weekOne, "2026-09-07");
eq("other week 2 Wed", suggestForWeek(2, "Wed", other, []).dates, ["2026-09-16"]);
eq("other range", termRange(other), { start: "2026-09-07", end: "2026-12-27" });
eq("bad semester", resolveTerm("nope", ""), null);
eq("other with bad date", resolveTerm("other", "soon"), null);
eq("exam note", examPeriodNote(s1), "The exam period is 3 Dec to 18 Dec 2026.");
eq("exam note other", examPeriodNote(other), "");

const ev = (title, extra) => makeEvent({ title, course: "COMP1010", ...extra });
const events = [ev("Quiz 1", { type: "quiz" }), ev("Quiz 2", { type: "quiz" }), ev("Final exam", { type: "exam" }), ev("Lecture", { type: "class" })];
const rows = [
  { course: "COMP1010", name: "Quizzes", weight: 40, eventTitles: ["Quiz 1", "Quiz 2"] },
  { course: "COMP1010", name: "Examination", weight: 60, eventTitles: ["Final Exam"] },
];
eq("adds to 100", checkAssessments(rows, events), [
  { course: "COMP1010", total: 100, complete: true, rows: [{ name: "Quizzes", weight: 40, events: 2 }, { name: "Examination", weight: 60, events: 1 }] },
]);
const short = checkAssessments([rows[0], { ...rows[1], weight: 50, eventTitles: ["Project"] }], events);
eq("90 with an uncovered row", [short[0].total, short[0].complete, problemCount(short)], [90, false, 2]);
console.log("     ", describeProblems(short));
eq("thirds", checkAssessments([33.3, 33.3, 33.4].map((weight, i) => ({ course: "", name: `P${i}`, weight, eventTitles: ["Quiz 1"] })), events)[0].total, 100);
eq("a row can be covered by any named event", checkAssessments([{ course: "", name: "Lecture", weight: 100, eventTitles: ["Lecture"] }], events)[0].complete, true);
eq("no rows", checkAssessments([], events), []);

eq("undated is not flagged", needsReview(ev("Quiz 1")), false);
eq("undated is not exported", canExport(ev("Quiz 1")), false);
eq("dated and clean is exported", canExport(ev("Quiz 1", { date: "2026-10-13" })), true);
eq("dated but flagged is not exported", canExport(ev("Quiz 1", { date: "2026-10-13", ambiguous: true })), false);
const old = [ev("Quiz 1", { ambiguous: true, note: "No date found in the outline.", type: "deadline" }), ev("Quiz 2", { date: "2026-10-20" })];
const fresh = [ev("Quiz 1", { type: "quiz", suggestedDates: ["2026-10-13"], note: "Suggested" }), ev("Quiz 2", { type: "quiz" })];
const merged = mergeEvents(old, fresh);
eq("re-upload refreshes an undated event, keeps its type", [merged[0].ambiguous, merged[0].suggestedDates, merged[0].type], [false, ["2026-10-13"], "deadline"]);
eq("re-upload keeps the student's date", [merged.length, merged[1].date], [2, "2026-10-20"]);
eq("old saved event gets defaults", [makeEvent({ title: "x" }).suggestedDates, makeEvent({ title: "x" }).weight, makeEvent({ title: "x" }).choice], [[], null, ""]);

// ---- stage 2
const mon = suggestWeekly("Mon", s1);
eq("s1 Mondays: 13 minus 19 Oct", [mon.dates.length, mon.dates[0], mon.dates.at(-1), mon.dates.includes("2026-10-19")], [12, "2026-08-31", "2026-11-23", false]);
console.log("     note:", mon.note);
eq("s1 Sundays end 29 Nov", [suggestWeekly("Sun", s1).dates.length, suggestWeekly("Sun", s1).dates.at(-1)], [13, "2026-11-29"]);
const s2mon = suggestWeekly("Monday", s2).dates;
eq("s2 Mondays skip the break week and two holidays", [s2mon.length, s2mon.includes("2027-02-08"), s2mon.includes("2027-03-29"), s2mon.includes("2027-04-05")], [11, false, false, false]);
eq("other: 13, with a warning", [suggestWeekly("Wed", other).dates.length, /not known/.test(suggestWeekly("Wed", other).note)], [13, true]);
eq("no weekday", suggestWeekly(null, s1).dates, []);

const cls = (title, choice, extra) => makeEvent({ title, course: "COMP1010", type: "class", time: "08:30", choice, suggestedDates: ["2026-09-01", "2026-09-08", "2026-09-15"], ...extra });
let plan = [cls("Lecture L01", "COMP1010 Lecture"), cls("Lecture L02", "COMP1010 Lecture"), cls("Lab S01", "COMP1010 Lab"), cls("Lab S02", "COMP1010 Lab"), cls("Lab S03", "COMP1010 Lab"), ev("Quiz 1", { type: "quiz" })];
eq("two open choices", openChoices(plan).map((g) => [g.choice, g.options.length]), [["COMP1010 Lecture", 2], ["COMP1010 Lab", 3]]);
plan = expandWeekly(plan, 2);
eq("expanding S01 gives 3 dated classes", [plan.length, plan[2].date, plan[4].date, plan[2].suggestedDates], [8, "2026-09-01", "2026-09-15", []]);
eq("lab choice still open after expanding", openChoices(plan).map((g) => [g.choice, g.options.length]), [["COMP1010 Lecture", 2], ["COMP1010 Lab", 3]]);
plan = chooseSection(plan, "COMP1010 Lab", "Lab S01");
eq("choosing S01 keeps its 3 classes, drops S02 and S03", [plan.length, plan.filter((e) => e.title.startsWith("Lab")).map((e) => e.title), openChoices(plan).length], [6, ["Lab S01", "Lab S01", "Lab S01"], 1]);
plan = chooseSection(plan, "COMP1010 Lecture", null);
eq("keep them all settles the question", [plan.length, openChoices(plan)], [6, []]);
const again = mergeEvents(plan, [cls("Lecture L01", "COMP1010 Lecture"), cls("Lecture L02", "COMP1010 Lecture"), cls("Lab S01", "COMP1010 Lab"), cls("Lab S02", "COMP1010 Lab"), cls("Lab S03", "COMP1010 Lab"), ev("Quiz 1", { type: "quiz" })]);
eq("re-upload: dropped sections stay dropped, nothing flagged, no question", [again.length, again.filter((e) => e.ambiguous).length, openChoices(again)], [6, 0, []]);
eq("re-upload keeps the expanded dates", again.filter((e) => e.title === "Lab S01").map((e) => e.date), ["2026-09-01", "2026-09-08", "2026-09-15"]);
const firstTime = mergeEvents([], [cls("Lab S01", "COMP1010 Lab"), cls("Lab S02", "COMP1010 Lab")]);
eq("first upload keeps every section and asks", [firstTime.length, openChoices(firstTime).length], [2, 1]);
console.log(failed ? `${failed} FAILED` : "all passed");
