// SPENDS GEMINI QUOTA (1-3 requests) unless --saved is given. Scores one real outline against a hand-labelled truth file.
//
//   node --env-file=.env.local --import ./scripts/dev/loader/register.mjs scripts/dev/live/score-outline.mjs <outline> <truth.json> [--out result.json]
//   node --import ./scripts/dev/loader/register.mjs scripts/dev/live/score-outline.mjs - <truth.json> --saved result.json
//
// --out saves the events found, so a result can be scored again later with --saved (no Gemini).
// Real outlines stay outside the repo; truth files are in scripts/dev/truth/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { score } = await lib("evaluate");
const { TERMS } = await lib("polyu-calendar");

const [outline, truthFile] = process.argv.slice(2);
const option = (name) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : null; };
const truth = JSON.parse(fs.readFileSync(truthFile, "utf8")).events;

let events;
if (option("--saved")) events = JSON.parse(fs.readFileSync(option("--saved"), "utf8"));
else {
  const { readFileText, extractEvents } = await lib("extract");
  const buffer = fs.readFileSync(outline);
  const text = await readFileText(path.basename(outline), buffer);
  // As the site does (app/api/extract/route.js): a PDF goes as the file too.
  ({ events } = await extractEvents(text, TERMS[0], /\.pdf$/i.test(outline) ? buffer : null));
  if (option("--out")) fs.writeFileSync(option("--out"), JSON.stringify(events, null, 2));
}

// "L010S01" and "S010S01" are the outline's "010S01" with a letter in front; compare the section codes alone.
const plain = (title) => String(title).replace(/\b[a-z](?=\d)/gi, "");
const result = score(events.map((e) => ({ ...e, title: plain(e.title) })), truth.map((t) => ({ ...t, title: plain(t.title) })));
console.log(`precision ${result.precision.toFixed(2)}  recall ${result.recall.toFixed(2)}  (${events.length} found, ${truth.length} in truth)`);
for (const t of result.missed) console.log(`  missed  ${t.title}`);
for (const p of result.wrong) console.log(`  wrong   ${p.title} (${p.date} ${p.time})`);

// Weekly classes have no date until accepted, so also check each one by its first meeting and start time.
const first = (e) => e.date || e.suggestedDates?.[0] || null;
console.log("\nclasses (truth -> found)");
for (const t of truth.filter((t) => t.type === "class")) {
  // Two sections can meet at the same time (a lecture and another section's lab), so prefer the one named alike.
  const sameName = (e) => plain(e.title).toLowerCase() === plain(t.title).toLowerCase();
  const meets = events.filter((e) => e.type === "class" && e.time === t.time && first(e) === t.firstClass);
  const found = meets.find(sameName) || meets[0];
  const named = found && sameName(found);
  console.log(`  ${found ? (named ? "ok   " : "NAME ") : "MISS "} ${t.title} ${t.firstClass} ${t.time}${found && !named ? `  -> called "${found.title}"` : ""}`);
}
console.log("\nweights (truth -> found)");
for (const t of truth.filter((t) => t.weight)) {
  const found = events.find((e) => plain(e.title).toLowerCase() === plain(t.title).toLowerCase());
  console.log(`  ${found?.weight === t.weight ? "ok   " : "WRONG"} ${t.title} ${t.weight}%${found?.weight === t.weight ? "" : ` -> ${found ? found.weight : "not found"}`}`);
}
const flagged = events.filter((e) => e.ambiguous);
console.log(`\nflagged for checking: ${flagged.map((e) => e.title).join(", ") || "none"}`);
