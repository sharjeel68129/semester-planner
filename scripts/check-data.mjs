// `npm run check-data`: checks every entry in data/course-assessments.json against the rules in
// lib/course-rules.mjs and names each one that fails. Run it after adding or changing an entry by hand.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { datasetProblems } from "../lib/course-rules.mjs";

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "course-assessments.json");
let entries;
try {
  entries = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (err) {
  console.error(`data/course-assessments.json could not be read: ${err.message}`);
  process.exit(1);
}
const problems = datasetProblems(entries);
for (const problem of problems) console.error(`  ${problem}`);
const forms = entries.filter((entry) => entry.source === "form").length;
console.log(`${entries.length} entries (${forms} from PolyU forms, ${entries.length - forms} from outlines). ${problems.length === 0 ? "All pass." : `${problems.length} problem(s) above.`}`);
process.exit(problems.length === 0 ? 0 : 1);
