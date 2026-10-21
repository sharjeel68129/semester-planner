// SPENDS GEMINI QUOTA. Two made-up COMP1010 outlines through real extraction, to see the dataset comparison end to end.
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { extractEvents } = await lib("extract");
const { TERMS } = await lib("polyu-calendar");
const { needsReview } = await lib("review");

const outline = (exam) => `COMP1010 Computational Thinking and Problem Solving
Semester 1, 2026/27
Lecture: Mon 10:30-12:20

Assessment
Quiz 1 ${(100 - exam) / 4}%
Quiz 2 ${(100 - exam) / 4}%
Programming assignment ${(100 - exam) / 2}%
Final examination ${exam}%

Schedule
Week 4   Quiz 1 (Tue, in lab)
Week 9   Quiz 2 (Tue, in lab)
Week 11  Programming assignment due Fri 23:59
Final examination: date to be announced
`;
for (const exam of [60]) {
  console.log(`\n===== exam ${exam}%`);
  try {
    const { events, checks } = await extractEvents(outline(exam), TERMS[0]);
    console.log(`events ${events.length}, flagged ${events.filter((e) => needsReview(e)).length}: ${events.map((e) => e.title).join(" | ")}`);
    for (const c of checks) console.log(`total ${c.total} complete ${c.complete}\n  reference: ${JSON.stringify(c.reference)}`);
  } catch (err) {
    console.log("ERROR", err.message);
  }
}
