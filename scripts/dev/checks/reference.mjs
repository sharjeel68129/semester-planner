// Checks for the course dataset rules and the comparison with PolyU's forms.
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const root = ROOT;
const { compareToReference, codeOf, findReference } = await import(pathToFileURL(`${root}/lib/reference.js`).href);
const { entryProblems, datasetProblems } = await import(pathToFileURL(`${root}/lib/course-rules.mjs`).href);

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};
const check = (course, rows) => ({ course, total: rows ? Math.round(rows.reduce((n, r) => n + r.weight, 0) * 100) / 100 : null, rows: rows || [] });
const row = (name, weight) => ({ name, weight, events: 1 });

eq("code from a long course name", codeOf("COMP1010 Introduction to Computing"), "COMP1010");
eq("code with a space", codeOf("comp 1010"), "COMP1010");
eq("no code", codeOf("Introduction to Computing"), "");
eq("unknown course has no entry", compareToReference(check("ABCD9999", [row("Exam", 100)])), null);
eq("no course name has no entry", compareToReference(check("", [row("Exam", 100)])), null);

const same = compareToReference(check("COMP1010", [row("Quiz 1", 10), row("Assignments", 20), row("Final Examination", 70)]), 2026);
eq("COMP1010 with a 70% exam matches", same.matches, true);
console.log("     ", same.message, same.sourceUrl);
const differs = compareToReference(check("COMP1010 Computational Thinking", [row("Quizzes", 20), row("Midterm Test", 20), row("Final Examination", 60)]), 2026);
eq("COMP1010 with a 60% exam differs", differs.matches, false);
console.log("     ", differs.message);
const midterm = compareToReference(check("COMP1010", [row("Mid-term Exam", 30), row("Examination", 70)]), 2026);
eq("a mid-term exam is not counted as the examination", midterm.matches, true);
const none = compareToReference(check("COMP1010", [row("Project", 100)]), 2026);
eq("no exam in the outline", none.matches, false);
console.log("     ", none.message);
const formNone = compareToReference(check("DSAI1202", [row("Project", 40), row("Final Examination", 60)]), 2026);
eq("form has no exam, outline does", formNone.matches, false);
console.log("     ", formNone.message);
const formNoneOk = compareToReference(check("DSAI1202", [row("Project", 40), row("Quizzes", 60)]), 2026);
eq("form has no exam, outline has none", formNoneOk.matches, true);
console.log("     ", formNoneOk.message);
const nothing = compareToReference(check("COMP1010", null), 2026);
eq("outline with no breakdown: shown for comparison only", nothing.matches, null);
console.log("     ", nothing.message);
const old = compareToReference(check("COMP1001", [row("Examination", 45), row("Coursework", 55)]), 2026);
eq("a 2021 form is marked as possibly out of date", [old.matches, /from 2021 and may be out of date/.test(old.message)], [true, true]);
const fresh = compareToReference(check("COMP1010", [row("Examination", 70), row("Coursework", 30)]), 2026);
eq("a 2025 form is not marked old", /out of date/.test(fresh.message), false);

// ---- rules
const good = findReference("COMP1010");
eq("a collected entry passes the rules", entryProblems(good), []);
eq("weights adding to 90 are refused", entryProblems({ ...good, rows: [{ ...good.rows[0], weight: 60 }, good.rows[1]] }).some((p) => /add up to 90/.test(p)), true);
eq("a row not in the evidence is refused", entryProblems({ ...good, rows: [{ name: "Final Viva", weight: 70, kind: "exam" }, good.rows[1]] }).some((p) => /not in the evidence/.test(p)), true);
eq("a weight not in the evidence is refused", entryProblems({ ...good, evidence: "Examination 65% Total 100%" }).some((p) => /70% for/.test(p)), true);
const outline = {
  code: "TEST1001", aliases: ["OLDC1001"], title: "Test", source: "outline", sourceUrl: null, sourceDate: null, semester: "2026-27-s1", checkedBy: "me",
  rows: [{ name: "Quiz 1", weight: 10, kind: "coursework" }, { name: "Project", weight: 30, kind: "coursework" }, { name: "Final Examination", weight: 60, kind: "exam" }],
  evidence: "Quiz 1 10% Project 30% Final Examination 60%",
};
eq("a hand-typed outline entry passes", entryProblems(outline), []);
eq("an outline entry may not have a worked-out row", entryProblems({ ...outline, rows: [{ ...outline.rows[0], computed: true }, ...outline.rows.slice(1)] }).length > 0, true);
eq("an outline entry needs its semester", entryProblems({ ...outline, semester: null }).some((p) => /semester/.test(p)), true);
eq("a code used twice is reported", datasetProblems([good, { ...outline, aliases: ["COMP1010"] }]).some((p) => /also used/.test(p)), true);
console.log(failed ? `${failed} FAILED` : "all passed");
