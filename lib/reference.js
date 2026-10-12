// Cross-check: compare what was read from an uploaded outline with the dataset of known grade splits
// (data/course-assessments.json). It only informs. The student's outline always wins, because an entry
// can be out of date, so nothing here changes, removes or flags an event. The dataset is never shown to the model.
import entries from "../data/course-assessments.json";
import { entryProblems } from "./course-rules.mjs";

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const percent = (n) => `${Math.round(n * 100) / 100}%`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const OLD_AFTER_YEARS = 3;

// An entry that breaks a rule is left out, so a typing mistake in the file cannot mislead a student.
const byCode = new Map();
for (const entry of entries) {
  if (entryProblems(entry).length > 0) continue;
  for (const code of [entry.code, ...entry.aliases]) if (!byCode.has(code)) byCode.set(code, entry);
}

/** The subject code in a course name ("COMP1010 Introduction to Computing" -> "COMP1010"), or "". */
export function codeOf(course) {
  const match = String(course || "").toUpperCase().match(/\b([A-Z]{2,5})[\s-]?(\d{3,4}[A-Z0-9]{0,3})\b/);
  return match ? match[1] + match[2] : "";
}

/** The dataset entry for a course, by its code or an alias; undefined if there is none. */
export function findReference(course) {
  return byCode.get(codeOf(course));
}

// The final examination, not a mid-term, test or quiz that happens to be called an exam.
const isExamName = (name) => /\bexam/i.test(name) && !/mid|test|quiz|continuous/i.test(name);

const sumOf = (rows) => Math.round(rows.reduce((n, row) => n + row.weight, 0) * 100) / 100;

function sourceLabel(entry) {
  if (entry.source === "outline") return `the ${entry.semester} outline on file`;
  const date = entry.sourceDate ? `${MONTHS[Number(entry.sourceDate.slice(5)) - 1]} ${entry.sourceDate.slice(0, 4)}` : "undated";
  return `PolyU's subject form (${date})`;
}

/**
 * Compare one course's 100% check (from lib/assess.js: { course, total, rows: [{ name, weight }] }) with its
 * dataset entry. Returns null when the course has no entry, otherwise
 * { matches: true | false | null, message, sourceUrl }. `matches` is null when the outline gave nothing to compare.
 * `thisYear` is passed in so the "may be out of date" wording can be tested.
 */
export function compareToReference(check, thisYear = new Date().getFullYear()) {
  const entry = findReference(check.course);
  if (!entry) return null;
  const label = sourceLabel(entry);
  const refExam = sumOf(entry.rows.filter((row) => row.kind === "exam"));
  const split = refExam > 0 ? `examination ${percent(refExam)}${refExam < 100 ? `, all other assessment ${percent(100 - refExam)}` : ""}` : "no examination, all coursework";
  const stale =
    entry.source === "form" && entry.sourceDate && thisYear - Number(entry.sourceDate.slice(0, 4)) > OLD_AFTER_YEARS
      ? ` The form is from ${entry.sourceDate.slice(0, 4)} and may be out of date.`
      : "";
  const caution = ` Outlines can differ from ${entry.source === "form" ? "the form" : "an earlier semester"}; check which is current.${stale}`;
  const result = (matches, message) => ({ matches, message, sourceUrl: entry.sourceUrl || null });

  if (check.total === null || check.rows.length === 0) {
    return result(null, `For comparison, ${label} lists: ${split}.${stale}`);
  }

  const differences = [];
  // An entry typed from a real outline has every row, so compare row by row.
  if (entry.source === "outline") {
    const found = new Map(check.rows.map((row) => [squash(row.name), row.weight]));
    for (const row of entry.rows) {
      const weight = found.get(squash(row.name));
      if (weight === undefined) differences.push(`${row.name} (${percent(row.weight)}) is not in this outline`);
      else if (weight !== row.weight) differences.push(`${row.name} is ${percent(weight)} here, not ${percent(row.weight)}`);
      found.delete(squash(row.name));
    }
    for (const row of check.rows) if (found.has(squash(row.name))) differences.push(`${row.name} (${percent(row.weight)}) is new`);
    if (differences.length === 0) return result(true, `Matches ${label}.`);
    return result(false, `Differs from ${label}: ${differences.join("; ")}.${caution}`);
  }

  // A form is only reliable for the final examination's share against everything else.
  const exam = sumOf(check.rows.filter((row) => isExamName(row.name)));
  if (exam === refExam) return result(true, `Matches ${label}: ${split}.${stale}`);
  if (refExam === 0) return result(false, `${label} lists no examination, but this outline has one worth ${percent(exam)}.${caution}`);
  if (exam === 0) return result(false, `${label} lists an examination worth ${percent(refExam)}, but none was found in this outline.${caution}`);
  return result(false, `${label} lists the examination at ${percent(refExam)}. This outline's final examination is ${percent(exam)}.${caution}`);
}
