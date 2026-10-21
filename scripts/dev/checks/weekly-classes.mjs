// Checks that a weekly class the model dates only once still gets every teaching week. Gemini is stubbed.
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { extractEvents } = await lib("extract");
const { TERMS } = await lib("polyu-calendar");
const { expandWeekly, needsReview } = await lib("review");

const outline = `COMP1010
Lecture L02 Mon 16:30-18:20
Lab S01 Thu 16:30-18:20
Guest talk on 12 October 2026 at 14:00
Assessment: Examination 100%`;
const reply = {
  assessments: [{ course: "COMP1010", name: "Examination", weight: 100, quote: "Examination 100%", eventTitles: ["Final exam"] }],
  anchors: [],
  events: [
    { title: "Lecture L02 (Week 1)", course: "COMP1010", type: "class", date: "2026-08-31", time: "16:30", confidence: 0.9, sourceQuote: "Lecture L02 Mon 16:30-18:20", ambiguous: false, note: "", statedWeekday: "Mon" },
    { title: "Lab S01 - Week 1", course: "COMP1010", type: "class", date: "2026-09-03", time: "16:30", confidence: 0.9, sourceQuote: "Lab S01 Thu 16:30-18:20", ambiguous: false, note: "", statedWeekday: null },
    { title: "Lab S02", course: "COMP1010", type: "class", date: null, time: "16:30", confidence: 0.9, sourceQuote: "Lab S01 Thu 16:30-18:20", ambiguous: false, note: "", statedWeekday: "Thu" },
    { title: "Final exam", course: "COMP1010", type: "exam", date: null, time: null, confidence: 0.9, sourceQuote: "Examination 100%", ambiguous: false, note: "" },
  ],
};
let calls = 0;
globalThis.fetch = async () => {
  calls++;
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }], role: "model" }, finishReason: "STOP" }] }), { status: 200, headers: { "content-type": "application/json" } });
};
process.env.GEMINI_API_KEY ||= "stub";

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };
const { events } = await extractEvents(outline, TERMS[0]);
const [lec, lab, undated] = events;
check("model was asked once", calls === 1);
check("dated lecture keeps its date", lec.date === "2026-08-31");
check('"(Week 1)" removed from lecture title', lec.title === "Lecture L02");
check('"- Week 1" removed from lab title', lab.title === "Lab S01");
check("dated lecture offered weekly Mondays", lec.suggestedDates.length >= 12 && lec.suggestedDates.every((d) => new Date(d).getUTCDay() === 1));
check("lab weekday taken from its date (Thu)", lab.suggestedDates.length >= 12 && lab.suggestedDates.every((d) => new Date(d).getUTCDay() === 4));
check("note explains the single date", /Only one date/.test(lec.note));
check("not flagged just for this", !needsReview(lec) && !needsReview(lab));
check("undated class unchanged (title, suggestions)", undated.title === "Lab S02" && undated.date === null && undated.suggestedDates.length >= 12);
const expanded = expandWeekly(events, 0);
const lectures = expanded.filter((e) => e.title === "Lecture L02");
check("expanding gives one class per teaching Monday, own date included once", lectures.length === lec.suggestedDates.length && lectures[0].date === "2026-08-31" && new Set(lectures.map((e) => e.date)).size === lectures.length);
const offTerm = expandWeekly([{ ...lec, date: "2026-08-24" }], 0);
check("a date outside the suggestions is kept when expanding", offTerm[0].date === "2026-08-24" && offTerm.length === lec.suggestedDates.length + 1);
console.log(failures === 0 ? "ALL PASS" : `${failures} failed`);
