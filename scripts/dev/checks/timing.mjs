// Week-to-date rules inside extraction (lib/extract.js + lib/weeks.js), with the V1 cases that went wrong:
// LEI1102 (no class time, "24 hours before Week 6 class"), MM1041 (week-only deadlines, 19 Oct holiday),
// exams with no date, a wrong year, and an evening holiday. Gemini is stubbed.
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { extractEvents } = await lib("extract");
const { TERMS } = await lib("polyu-calendar");
const { needsReview, canExport } = await lib("review");

const outline = `LEI1102
Digital Poster: due 24 hours before start time of Week 6 class
Essay Version 1: day before Week 9 class
MM1041 Lecture Mon 14:30-16:20 Z209
Individual Assignment: Week 8
Group Project: Week 12
Exam 40%
ENG4001 Weekly Class Thursday 12:30 3-Sept-25
ENGL1A29 Seminar 2 Fri 25-Sep 18:30
Quiz 1 Sat 10 Oct 2026 10:00`;
const ev = (fields) => ({ confidence: 0.9, ambiguous: false, note: "", time: null, date: null, statedWeekday: null, week: null, ...fields });
const reply = {
  assessments: [],
  anchors: [],
  events: [
    ev({ title: "Digital Poster", course: "LEI1102", type: "deadline", sourceQuote: "Digital Poster: due 24 hours before start time of Week 6 class", week: 6, timing: "before_class", offsetMinutes: 1440 }),
    ev({ title: "Essay Version 1", course: "LEI1102", type: "deadline", sourceQuote: "Essay Version 1: day before Week 9 class", week: 9, timing: "day_before_class" }),
    ev({ title: "Lecture", course: "MM1041", type: "class", time: "14:30", statedWeekday: "Mon", sourceQuote: "MM1041 Lecture Mon 14:30-16:20 Z209", timing: "none" }),
    ev({ title: "Individual Assignment", course: "MM1041", type: "deadline", sourceQuote: "Individual Assignment: Week 8", week: 8, timing: "week_only" }),
    ev({ title: "Exam", course: "MM1041", type: "exam", sourceQuote: "Exam 40%", timing: "exam_period" }),
    ev({ title: "Weekly Class", course: "ENG4001", type: "quiz", date: "2025-09-03", time: "12:30", statedWeekday: "Thu", sourceQuote: "ENG4001 Weekly Class Thursday 12:30 3-Sept-25", timing: "date" }),
    ev({ title: "Seminar 2 (25 Sep)", course: "ENGL1A29", type: "quiz", date: "2026-09-25", time: "18:30", statedWeekday: "Fri", sourceQuote: "ENGL1A29 Seminar 2 Fri 25-Sep 18:30", timing: "date" }),
    ev({ title: "Quiz 1", course: "ENGL1A29", type: "quiz", date: "2026-10-10", time: "10:00", statedWeekday: "Sat", sourceQuote: "Quiz 1 Sat 10 Oct 2026 10:00", timing: "date" }),
  ],
};
globalThis.fetch = async () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }], role: "model" }, finishReason: "STOP" }] }), { status: 200, headers: { "content-type": "application/json" } });
process.env.GOOGLE_CREDENTIALS_JSON ||= JSON.stringify({ type: "service_account", client_email: "stub@example.test" });

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };
const { events } = await extractEvents(outline, TERMS[0]);
const find = (title) => events.find((e) => e.title === title);

const poster = find("Digital Poster");
check("LEI1102 poster with no class time: NEEDS_CLASS_TIME, needs checking", poster.flags.includes("NEEDS_CLASS_TIME") && needsReview(poster) && poster.suggestedDates.length === 0);
check("LEI1102 essay with no class time: NEEDS_CLASS_TIME", find("Essay Version 1").flags.includes("NEEDS_CLASS_TIME"));
const assignment = find("Individual Assignment");
check("MM1041 week-only deadline uses the class day (Mon of week 8)", assignment.suggestedDates[0] === "2026-10-19" && !assignment.flags.includes("APPROXIMATE_DATE"));
check("a deadline on a holiday is not cancelled", assignment.status === "");
const exam = find("Exam");
check("exam with no date: DATE_TBA, exam period span, not flagged", exam.flags.includes("DATE_TBA") && exam.endDate === "2026-12-18" && !needsReview(exam));
const wrongYear = find("Weekly Class");
check("3-Sept-25 in a 2026/27 file: YEAR_SUSPECT, 2026-09-03 suggested, needs checking", wrongYear.flags.includes("YEAR_SUSPECT") && wrongYear.suggestedDates[0] === "2026-09-03" && needsReview(wrongYear));
const evening = find("Seminar 2 (25 Sep)");
check("session on the evening of 25 Sep is cancelled and not exported", evening.status === "cancelled" && evening.flags.includes("CANCELLED_HOLIDAY") && !canExport(evening));
check("a test on Info Day (10 Oct) is cancelled", find("Quiz 1").status === "cancelled");
const lecture = find("Lecture");
check("weekly lecture leaves out 19 Oct", lecture.suggestedDates.length === 12 && !lecture.suggestedDates.includes("2026-10-19"));

// With a picture as the source, an exam date is flagged for checking.
reply.events = [ev({ title: "Final exam", course: "X1", type: "exam", date: "2026-12-10", statedWeekday: "Thu", sourceQuote: "Exam 40%", timing: "date" })];
const fromPic = (await extractEvents(outline, TERMS[0], { fromPicture: true })).events[0];
check("exam date read from a picture needs checking", fromPic.flags.includes("REVIEW_EXAM_DATE") && needsReview(fromPic));
const fromText = (await extractEvents(outline, TERMS[0])).events[0];
check("the same exam date from text does not", !needsReview(fromText));
console.log(failures === 0 ? "ALL PASS" : `${failures} failed`);
