// SPENDS GEMINI QUOTA. Made-up outlines through the real extraction. Optional argument: the start of one outline's name.
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { extractEvents } = await lib("extract");
const { TERMS } = await lib("polyu-calendar");
const { needsReview } = await lib("review");

const head = `COMP1010 Introduction to Computing
Semester 1, 2026/27

Class sections
Lecture L01  Mon 10:30-12:20  Room N001
Lecture L02  Wed 14:30-16:20  Room N002
Lab S01  Tue 08:30-10:20  PQ604A
Lab S02  Thu 12:30-14:20  PQ604B
Lab S03  Fri 15:30-17:20  PQ604C
`;
const schedule = `
Teaching schedule
Week 1   Introduction
Week 4   Quiz 1 (in lab, Tue)
Week 7   Midterm Test, Wed 19:00
Week 9   Quiz 2 (in lab, Tue)
Week 12  Group project report due Fri 23:59
Final examination: date to be announced by the Academic Registry
`;

const outlines = {
  "A adds to 100, with a heading row": `${head}
Assessment
Continuous Assessment 40%
  Quiz 1            5%
  Quiz 2            5%
  Midterm Test     15%
  Group project    15%
Examination 60%
  Final examination 60%
${schedule}`,
  "B item only in the table (Lab participation)": `${head}
Assessment
Quiz 1 5%
Quiz 2 5%
Midterm Test 15%
Group project 15%
Lab participation 10%
Final examination 50%
${schedule}`,
  "C table adds to 90": `${head}
Assessment
Quiz 1 5%
Quiz 2 5%
Midterm Test 15%
Group project 15%
Final examination 50%
${schedule}`,
  "D no breakdown, written dates": `COMP2011 Data Structures
Assignment 1 due Friday 9 October 2026, 23:59.
Assignment 2 due 13 Nov (Fri) at 23:59.
Midterm: Tuesday 20 October 2026 at 19:00.
Lectures: Thu 09:30-11:20.
`,
};

const only = process.argv[2];
for (const [name, text] of Object.entries(outlines)) {
  if (only && !name.startsWith(only)) continue;
  console.log(`\n===== ${name}`);
  try {
    const { events, checks } = await extractEvents(text, TERMS[0]);
    for (const e of events) {
      console.log(
        `${needsReview(e) ? "FLAG" : "    "} ${e.type.padEnd(8)} ${String(e.date).padEnd(10)} ${String(e.time).padEnd(5)} ${e.title} | w=${e.weight} choice=[${e.choice}] sug=${e.suggestedDates.length}:${e.suggestedDates[0] || ""}..${e.suggestedDates.at(-1) || ""}\n       note: ${e.note}`,
      );
    }
    console.log(JSON.stringify(checks));
  } catch (err) {
    console.log("ERROR", err.message);
  }
}
