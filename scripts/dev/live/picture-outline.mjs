// SPENDS GEMINI QUOTA (2 requests). A picture of an outline through readFileText + extractEvents. Argument: the picture's path.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { readFileText, extractEvents } = await lib("extract");
const { TERMS } = await lib("polyu-calendar");
const file = process.argv[2];
let t = Date.now();
const text = await readFileText(path.basename(file), fs.readFileSync(file));
console.log(`--- copied text (${Date.now() - t} ms):\n${text}\n---`);
t = Date.now();
const { events, checks } = await extractEvents(text, TERMS[0]);
console.log(`--- extraction (${Date.now() - t} ms)`);
for (const e of events) {
  console.log(`${e.ambiguous ? "FLAG" : "    "} ${e.type.padEnd(8)} ${String(e.date).padEnd(10)} ${String(e.time).padEnd(5)} ${e.title} | sug=${e.suggestedDates.length}:${e.suggestedDates[0] || ""}..${e.suggestedDates.at(-1) || ""}\n       note: ${e.note}`);
}
console.log(checks.map((c) => `${c.course}: total ${c.total}, complete ${c.complete}`).join("\n"));
