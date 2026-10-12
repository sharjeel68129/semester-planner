// Rules every entry in data/course-assessments.json must pass. Used by the collector, by `npm run check-data`,
// and (so a bad entry can never mislead a student) by the cross-check before it uses an entry.
// A .mjs file so plain Node scripts and the Next app can both import it.

export const squashText = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();

const isCode = (value) => typeof value === "string" && /^[A-Z]{2,5}\d{3,4}[A-Z0-9]{0,3}$/.test(value);

/**
 * Entry = {
 *   code: string,                 // "COMP1010"
 *   aliases: string[],            // other codes the same subject is known by
 *   title: string,
 *   rows: [{ name, weight, kind: "exam" | "coursework", computed?: true }],
 *                                 // In a "form" entry only the examination rows are copied from the form; one
 *                                 // `computed` row holds the rest (100 minus the examination), because the form's
 *                                 // other rows are too tangled with sub-items to read reliably.
 *   source: "form" | "outline",   // PolyU's subject description form, or a real outline typed in by hand
 *   sourceUrl: string | null,     // required for "form"
 *   sourceDate: string | null,    // "YYYY-MM" on the form; null if it carries no date
 *   semester: string | null,      // required for "outline", e.g. "2026-27-s1"
 *   checkedBy: string,            // who compared the rows with the source
 *   evidence: string              // the words copied from the source that the rows come from
 * }
 * Returns a list of problems in plain words; an empty list means the entry may be used.
 */
export function entryProblems(entry) {
  const problems = [];
  if (!entry || typeof entry !== "object") return ["is not an object"];
  if (!isCode(entry.code)) problems.push(`code "${entry.code}" is not a subject code like COMP1010`);
  if (!Array.isArray(entry.aliases) || !entry.aliases.every(isCode)) problems.push("aliases must be a list of subject codes");
  if (!entry.title || typeof entry.title !== "string") problems.push("title is missing");
  if (!["form", "outline"].includes(entry.source)) problems.push('source must be "form" or "outline"');
  if (entry.source === "form" && !/^https:\/\//.test(entry.sourceUrl || "")) problems.push("a form entry needs its sourceUrl");
  if (entry.source === "outline" && !entry.semester) problems.push("an outline entry needs its semester");
  if (entry.sourceDate !== null && !/^\d{4}-\d{2}$/.test(entry.sourceDate || "")) problems.push('sourceDate must be "YYYY-MM" or null');
  if (!entry.checkedBy) problems.push("checkedBy is missing");
  if (!entry.evidence || typeof entry.evidence !== "string") problems.push("evidence is missing");

  const rows = Array.isArray(entry.rows) ? entry.rows : [];
  if (rows.length === 0) problems.push("has no rows");
  const evidence = squashText(entry.evidence || "");
  if (rows.filter((row) => row.computed).length > 1) problems.push("only one row may be worked out, not copied");
  for (const row of rows) {
    if (row.computed && (entry.source !== "form" || row.kind !== "coursework")) problems.push("only a form's coursework row may be worked out, not copied");
    if (!row.name || typeof row.name !== "string") problems.push("a row has no name");
    else if (!row.computed && !evidence.includes(squashText(row.name))) problems.push(`row "${row.name}" is not in the evidence`);
    if (typeof row.weight !== "number" || !(row.weight > 0 && row.weight <= 100)) problems.push(`row "${row.name}" has weight ${row.weight}`);
    else if (!row.computed && !new RegExp(`(^|[^\\d.])${String(row.weight).replace(".", "\\.")}\\s*%`).test(evidence)) {
      problems.push(`${row.weight}% for "${row.name}" is not in the evidence`);
    }
    if (!["exam", "coursework"].includes(row.kind)) problems.push(`row "${row.name}" needs kind "exam" or "coursework"`);
  }
  const total = Math.round(rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0) * 100) / 100;
  if (rows.length > 0 && total !== 100) problems.push(`rows add up to ${total}, not 100`);
  return problems;
}

/** Problems across the whole file: each entry's own, plus a code or alias used twice. */
export function datasetProblems(entries) {
  if (!Array.isArray(entries)) return ["the file must be a list of entries"];
  const problems = [];
  const seen = new Map();
  entries.forEach((entry, i) => {
    const label = entry?.code || `entry ${i + 1}`;
    for (const problem of entryProblems(entry)) problems.push(`${label}: ${problem}`);
    for (const code of [entry?.code, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])]) {
      if (!code) continue;
      if (seen.has(code)) problems.push(`${label}: code ${code} is also used by ${seen.get(code)}`);
      else seen.set(code, label);
    }
  });
  return problems;
}
