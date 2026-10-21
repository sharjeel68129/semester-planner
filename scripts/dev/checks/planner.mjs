// Checks for accept-all, same course in two files, the class-time question, settings and merging.
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { acceptSuggestions, preferDetailed, coursesWithoutClass, courseKey, mergeEvents } = await lib("review");
const { makeEvent } = await lib("schema");
const { makeSettings } = await lib("settings");
const { focusDate } = await lib("dates");

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };
const ev = (p) => makeEvent({ course: "AMA1702", sourceQuote: "q", confidence: 0.9, ...p });

// courseKey
check("courseKey reads the code", courseKey("AMA1702 Applied Mathematics") === "AMA1702" && courseKey("ama 1702") === "AMA1702");
check("courseKey falls back to the name", courseKey("Intro to Stats") === "intro to stats");

// acceptSuggestions
const weekly = ["2026-08-31", "2026-09-07", "2026-09-14"];
const list = [
  ev({ title: "Quiz 1", type: "quiz", suggestedDates: ["2026-09-22"] }),
  ev({ title: "Test", type: "quiz", suggestedDates: ["2026-10-10"], ambiguous: true }),
  ev({ title: "Lecture", type: "class", time: "10:30", suggestedDates: weekly }),
  ev({ title: "Lab S01", type: "class", choice: "Lab", suggestedDates: weekly }),
  ev({ title: "Lab S02", type: "class", choice: "Lab", suggestedDates: weekly }),
  ev({ title: "Tutorial", type: "class", date: "2026-09-02", suggestedDates: ["2026-09-02", "2026-09-09"] }),
  ev({ title: "Final", type: "exam" }),
  ev({ title: "Essay", type: "deadline", date: "2026-10-01" }),
];
const { events: after, accepted } = acceptSuggestions(list);
check("accepted counts quiz, lecture, tutorial", accepted === 3);
check("quiz takes its suggestion", after.find((e) => e.title === "Quiz 1").date === "2026-09-22");
check("flagged test left alone", after.find((e) => e.title === "Test").date === null);
check("lecture becomes 3 dated classes", after.filter((e) => e.title === "Lecture").map((e) => e.date).join() === weekly.join());
check("open section choice left alone", after.filter((e) => e.title === "Lab S01").length === 1 && after.find((e) => e.title === "Lab S01").date === null);
check("dated tutorial expanded, own date once", after.filter((e) => e.title === "Tutorial").map((e) => e.date).join() === "2026-09-02,2026-09-09");
check("undated exam with nothing suggested untouched", after.find((e) => e.title === "Final").date === null);
check("nothing dropped", after.length === list.length - 2 + 3 + 2);
check("accepting twice changes nothing more", acceptSuggestions(after).accepted === 0);

// preferDetailed
const form = { file: "AMA1702 SDF.pdf", events: [ev({ title: "Tests/assignments", type: "deadline" }), ev({ title: "Examination", type: "exam" }), ev({ title: "Lecture", type: "class" })], checks: [{ course: "AMA1702", total: 100, complete: true, rows: [{}, {}] }] };
const outline = { file: "AMA1702 outline.pdf", events: [ev({ title: "Final Exam", type: "exam" }), ev({ title: "Test", type: "quiz" })], checks: [{ course: "AMA1702 Applied Maths", total: 100, complete: true, rows: [{}, {}, {}, {}] }] };
const comp = { file: "COMP1010.pdf", events: [ev({ title: "Quiz 1", course: "COMP1010", type: "quiz" })], checks: [{ course: "COMP1010", total: 100, complete: true, rows: [{}, {}] }] };
const r = preferDetailed([form, outline, comp]);
check("form's marks left out", !r.events.some((e) => ["Tests/assignments", "Examination"].includes(e.title)));
check("form's class kept", r.events.some((e) => e.title === "Lecture"));
check("outline and other course kept", ["Final Exam", "Test", "Quiz 1"].every((t) => r.events.some((e) => e.title === t)));
check("left-out list names course, kept file, events", r.leftOut.length === 1 && r.leftOut[0].kept === "AMA1702 outline.pdf" && r.leftOut[0].events.length === 2);
check("form's check line removed, others kept", r.checks.length === 2 && !r.checks.some((c) => c.file === "AMA1702 SDF.pdf"));
const tie = preferDetailed([form, { ...outline, checks: [{ course: "AMA1702", total: 100, complete: true, rows: [{}, {}] }] }]);
check("equal detail: nothing left out", tie.leftOut.length === 0 && tie.events.length === 5);
check("one file only: nothing left out", preferDetailed([form]).leftOut.length === 0);
const putBack = mergeEvents(r.events, r.leftOut[0].events);
check("putting back restores the events", ["Tests/assignments", "Examination"].every((t) => putBack.some((e) => e.title === t)));
const putBackPartial = mergeEvents(r.events, r.leftOut[0].events, { partial: true });
check("putting back flags nothing", putBackPartial.every((e) => !e.ambiguous) && putBackPartial.length === r.events.length + 2);

// coursesWithoutClass
const mixed = [ev({ title: "Quiz", type: "quiz" }), ev({ title: "Quiz", course: "COMP1010", type: "quiz" }), ev({ title: "Lec", course: "COMP1010 Intro", type: "class" }), ev({ title: "Essay", course: "", type: "deadline" })];
check("asks only for the course with no class", JSON.stringify(coursesWithoutClass(mixed)) === JSON.stringify([{ key: "AMA1702", course: "AMA1702" }]));
check("skipped course not asked again", coursesWithoutClass(mixed, ["AMA1702"]).length === 0);

// merge: a class the student typed in is not "missing" from a re-upload
const typed = makeEvent({ title: "AMA1702 class", course: "AMA1702", type: "class", date: "2026-09-01", time: "10:30", note: "Class time you entered." });
const reup = mergeEvents([typed, ev({ title: "Quiz 1", type: "quiz" })], [ev({ title: "Quiz 1", type: "quiz" })]);
check("typed class not flagged on re-upload", reup[0].ambiguous === false);
const gone = mergeEvents([ev({ title: "Quiz 9", type: "quiz" })], [ev({ title: "Quiz 1", type: "quiz" })]);
check("outline event missing from re-upload still flagged", gone[0].ambiguous === true);

// settings
check("noClassCourses defaults to []", JSON.stringify(makeSettings({}).noClassCourses) === "[]");
check("noClassCourses keeps strings only", JSON.stringify(makeSettings({ noClassCourses: ["AMA1702", 5, "", null] }).noClassCourses) === '["AMA1702"]');

// focus date uses suggestions
check("calendar opens on a suggested date", focusDate([ev({ title: "x", suggestedDates: ["2099-01-05"] })]) === "2099-01-05");
console.log(failures === 0 ? "ALL PASS" : `${failures} failed`);
