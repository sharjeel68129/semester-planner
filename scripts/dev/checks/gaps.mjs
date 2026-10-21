// Checks for numbered items with a gap (Exercise 1-7 and 9-13) and saved grade breakdowns.
import { fileURLToPath, pathToFileURL } from "node:url";
// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");
const lib = (name) => import(pathToFileURL(`${ROOT}/lib/${name}.js`).href);
const { numberGaps, describeNumbers } = await lib("review");
const { makeEvent } = await lib("schema");
const { makeSettings } = await lib("settings");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) failures++; };
const ev = (title, p = {}) => makeEvent({ title, course: "AMA1702", type: "deadline", ...p });

const exercises = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13].map((n) => ev(`Exercise ${n}`));
const g = numberGaps(exercises);
check("Exercise 8 found missing", g.length === 1 && g[0].missing.join() === "8" && g[0].stem === "Exercise");
check("described as 1-7 and 9-13", describeNumbers(g[0].numbers) === "1-7 and 9-13");
check("ignored once answered", numberGaps(exercises, [`${g[0].key}|8`]).length === 0);
check("complete series: nothing", numberGaps([1, 2, 3].map((n) => ev(`Quiz ${n}`))).length === 0);
check("two items only: nothing", numberGaps([1, 3].map((n) => ev(`Quiz ${n}`))).length === 0);
check("many holes (1, 5, 10): not a series", numberGaps([1, 5, 10].map((n) => ev(`Lab ${n}`))).length === 0);
check("sections with a choice left out", numberGaps(["Lab S01", "Lab S02", "Lab S04"].map((t) => ev(t, { choice: "Lab", type: "class" }))).length === 0);
check("different courses kept apart", numberGaps([ev("Quiz 1"), ev("Quiz 3", { course: "COMP1010" }), ev("Quiz 4")]).length === 0);
check("'Ex. 1' style counted", numberGaps(["Ex. 1", "Ex. 2", "Ex. 4"].map((t) => ev(t)))[0]?.missing.join() === "3");
check("weekly copies of one class do not count", numberGaps(Array.from({ length: 5 }, () => ev("Lecture 2", { type: "class" }))).length === 0);
check("describe single and runs", describeNumbers([2]) === "2" && describeNumbers([1, 3, 4, 6]) === "1, 3-4 and 6");

const saved = makeSettings({
  breakdowns: {
    AMA1702: { course: "AMA1702", total: 100, rows: [{ name: "Final Examination", weight: 60 }, { name: "bad", weight: 900 }, { name: "", weight: 5 }], reference: { matches: true, message: "Matches.", sourceUrl: "javascript:alert(1)" } },
    BROKEN: "nope",
  },
  ignoredGaps: ["ama1702|exercise|8", 7],
});
check("breakdown kept, bad rows dropped", saved.breakdowns.AMA1702.rows.length === 1 && saved.breakdowns.AMA1702.total === 100);
check("non-https link dropped", saved.breakdowns.AMA1702.reference.sourceUrl === null);
check("malformed breakdown dropped", !("BROKEN" in saved.breakdowns));
check("ignoredGaps keeps strings", JSON.stringify(saved.ignoredGaps) === '["ama1702|exercise|8"]');
check("defaults empty", JSON.stringify(makeSettings({}).breakdowns) === "{}" && makeSettings({}).ignoredGaps.length === 0);
console.log(failures === 0 ? "ALL PASS" : `${failures} failed`);
