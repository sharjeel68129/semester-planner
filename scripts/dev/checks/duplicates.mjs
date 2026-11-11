// tidyDuplicates (lib/review.js): joins only exact duplicates from one upload, the V1 cases that listed items twice.
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const { tidyDuplicates, mergeEvents } = await import(pathToFileURL(`${ROOT}/lib/review.js`).href);
const { makeEvent } = await import(pathToFileURL(`${ROOT}/lib/schema.js`).href);

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };
const e = (p) => makeEvent({ sourceQuote: p.title, confidence: 0.9, ...p });

// COMP1010 read from two files as "COMP1010" and "COMP 1010"
const comp = tidyDuplicates([
  e({ title: "Quiz 1", course: "COMP1010", type: "quiz", date: "2026-09-30" }),
  e({ title: "Quiz 1", course: "COMP 1010", type: "quiz", date: "2026-09-30", time: "08:30" }),
  e({ title: "Final Exam", course: "COMP 1010", type: "exam" }),
]);
check("COMP 1010 and COMP1010 are one course", comp.events.every((ev) => ev.course === "COMP1010"));
check("the same quiz from two files is kept once, with the time the second adds", comp.events.filter((ev) => ev.title === "Quiz 1").length === 1 && comp.events[0].time === "08:30" && comp.joined === 1);

// LEI1102: screenshots with no course code repeat the outline's items
const lei = tidyDuplicates([
  e({ title: "Digital Poster", course: "LEI1102", type: "deadline", weight: 20 }),
  e({ title: "Essay Version 2", course: "LEI1102", type: "deadline", date: "2026-11-08", time: "23:59" }),
  e({ title: "Digital Poster", course: "", type: "deadline" }),
  e({ title: "Essay Version 2", course: "", type: "deadline", date: "2026-11-08", time: "23:59" }),
  e({ title: "Version 3 (Final Academic Essay)", course: "", type: "deadline" }),
  e({ title: "Final Academic Essay (Version 3)", course: "LEI1102", type: "deadline" }),
]);
check("no-course copies with the same title are joined", lei.events.filter((ev) => ev.title === "Digital Poster").length === 1 && lei.events.filter((ev) => ev.title === "Essay Version 2").length === 1);
check("one course in the upload: an item with no course gets it", lei.events.every((ev) => ev.course === "LEI1102"));
check("a near match (words in another order) is left for the student", lei.events.some((ev) => ev.title === "Version 3 (Final Academic Essay)") && lei.events.some((ev) => ev.title === "Final Academic Essay (Version 3)"));

// Different items are never joined
const apart = tidyDuplicates([
  e({ title: "Quiz", course: "AMA1110", type: "quiz", date: "2026-10-05" }),
  e({ title: "Quiz", course: "AMA1110", type: "quiz", date: "2026-11-02" }),
  e({ title: "Quiz", course: "AMA1120", type: "quiz", date: "2026-10-05" }),
  e({ title: "Midterm", course: "", type: "exam" }),
]);
check("same title on different dates stays two", apart.events.filter((ev) => ev.course === "AMA1110").length === 2);
check("same title in another course stays separate", apart.events.some((ev) => ev.course === "AMA1120"));
check("two courses: an item with no course keeps no course", apart.events.find((ev) => ev.title === "Midterm").course === "");

// A re-upload that spells the code with a space still matches the saved events
const saved = [e({ title: "Quiz 1", course: "COMP1010", type: "quiz", date: "2026-09-30" })];
const merged = mergeEvents(saved, [e({ title: "Quiz 1", course: "COMP 1010", type: "quiz", date: "2026-09-30" })]);
check("re-upload with \"COMP 1010\" does not add a second Quiz 1", merged.events ? merged.events.length === 1 : merged.length === 1);
console.log(failures === 0 ? "ALL PASS" : `${failures} failed`);
