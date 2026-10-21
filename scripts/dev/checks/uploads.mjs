// Checks for picture and scanned-PDF uploads, week ranges and file checks. Gemini is stubbed (fetch replaced).
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
process.env.GEMINI_MODELS = "model-a,model-b"; // before the code under test reads it
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { readFileText, extractEvents } = await lib("extract");
const { suggestWeekly } = await lib("suggest");
const { TERMS } = await lib("polyu-calendar");
const { validateUpload } = await lib("validate");

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };
const term = TERMS[0];

// suggestWeekly week ranges
const all = suggestWeekly("Mon", term);
const range = suggestWeekly("Mon", term, { from: 2, to: 13 });
check("no options: unchanged", all.dates.length === 12 && !/Weeks/.test(all.note));
check("weeks 2-13 drops week 1", range.dates[0] === "2026-09-07" && range.dates.length === 11 && /Weeks 2 to 13 only/.test(range.note));
const skip = suggestWeekly("Tue", term, { skip: [8] });
check("skip week 8 drops 20 Oct", !skip.dates.includes("2026-10-20") && skip.dates.length === 12 && /week 8 \(20 Oct\)/.test(skip.note));
check("nonsense weeks ignored", suggestWeekly("Tue", term, { from: 0, to: 99, skip: [42, "x", null] }).dates.length === 13);
check("to before from ignored", suggestWeekly("Tue", term, { from: 5, to: 3 }).dates[0] === "2026-09-29");
check("everything skipped: no dates", suggestWeekly("Tue", term, { from: 3, to: 3, skip: [3] }).dates.length === 0);

// validate
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
check("png accepted", validateUpload("a.png", png) === null);
check("fake png refused", /do not match/.test(validateUpload("a.png", Buffer.from("hello"))));
check("gif refused", /only/.test(validateUpload("a.gif", png)));

// Gemini stub: a queue of replies
let replies = [];
let calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: JSON.parse(init.body) });
  const next = replies.shift();
  if (next.status !== 200) return new Response(JSON.stringify({ error: { code: next.status, message: next.message } }), { status: next.status, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: next.text }], role: "model" }, finishReason: "STOP" }] }), { status: 200, headers: { "content-type": "application/json" } });
};
process.env.GEMINI_API_KEY ||= "stub";

replies = [{ status: 200, text: "COMP1010\nQuiz 1 Week 5" }];
check("image text copied out", (await readFileText("outline.png", png)) === "COMP1010\nQuiz 1 Week 5");
check("image sent inline with copy instructions", calls[0].body.contents[0].parts[0].inlineData.mimeType === "image/png" && /copy the text/i.test(JSON.stringify(calls[0].body.systemInstruction)));

calls = [];
replies = [{ status: 429, message: "You exceeded your current quota, please check your plan. Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, GenerateRequestsPerDayPerProjectPerModel" }, { status: 429, message: "quota GenerateRequestsPerDayPerProjectPerModel" }, { status: 429, message: "quota PerDay" }, { status: 429, message: "quota PerDay" }];
let message = "";
try { await readFileText("outline2.png", png); } catch (err) { message = err.message; }
check("daily limit reported as daily limit, not a corrupt file", message === "outline2.png: Gemini request failed (429, daily limit)");

calls = [];
replies = [{ status: 400, message: "bad request" }];
message = "";
try { await readFileText("outline3.jpg", Buffer.from([0xff, 0xd8, 0xff, 0])); } catch (err) { message = err.message; }
check("other Gemini error has status, not 'corrupt'", message === "outline3.jpg: Gemini request failed (400)");

replies = [{ status: 200, text: "   " }];
message = "";
try { await readFileText("blank.webp", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])); } catch (err) { message = err.message; }
check("blank picture says no readable text", /no readable text found/.test(message));

check("text file needs no Gemini", (await readFileText("a.txt", Buffer.from("hello"))) === "hello");

// "during": an item in the lab takes the lab's day and time; disagreeing sections give nothing
const outline = "Lab S01 Tue 14:30\nLab S02 Tue 14:30\nTutorial T1 Wed 10:30\nTutorial T2 Thu 10:30\nQuiz in Week 5 lab\nPresentation in Week 6 tutorial\nExamination 100%";
const model = {
  assessments: [{ course: "X", name: "Examination", weight: 100, quote: "Examination 100%", eventTitles: ["Exam"] }],
  anchors: [],
  events: [
    { title: "Lab S01", course: "X", type: "class", time: "14:30", statedWeekday: "Tue", sourceQuote: "Lab S01 Tue 14:30", ambiguous: false, confidence: 0.9, choice: "Lab" },
    { title: "Lab S02", course: "X", type: "class", time: "14:30", statedWeekday: "Tue", sourceQuote: "Lab S02 Tue 14:30", ambiguous: false, confidence: 0.9, choice: "Lab" },
    { title: "Tutorial T1", course: "X", type: "class", time: "10:30", statedWeekday: "Wed", sourceQuote: "Tutorial T1 Wed 10:30", ambiguous: false, confidence: 0.9, choice: "Tut" },
    { title: "Tutorial T2", course: "X", type: "class", time: "10:30", statedWeekday: "Thu", sourceQuote: "Tutorial T2 Thu 10:30", ambiguous: false, confidence: 0.9, choice: "Tut" },
    { title: "Quiz", course: "X", type: "quiz", date: null, week: 5, during: "lab", sourceQuote: "Quiz in Week 5 lab", ambiguous: false, confidence: 0.9 },
    { title: "Presentation", course: "X", type: "deadline", date: null, week: 6, during: "tutorial", sourceQuote: "Presentation in Week 6 tutorial", ambiguous: false, confidence: 0.9 },
    { title: "Exam", course: "X", type: "exam", date: null, sourceQuote: "Examination 100%", ambiguous: false, confidence: 0.9 },
  ],
};
replies = [{ status: 200, text: JSON.stringify(model) }];
const { events } = await extractEvents(outline, term);
const quiz = events.find((e) => e.title === "Quiz");
const pres = events.find((e) => e.title === "Presentation");
check("quiz in the lab gets Tue of week 5 and 14:30", quiz.suggestedDates[0] === "2026-09-29" && quiz.time === "14:30");
check("tutorial on two days: no day guessed", pres.suggestedDates.length === 0 && pres.time === "10:30");
console.log(failures === 0 ? "ALL PASS" : `${failures} failed`);
