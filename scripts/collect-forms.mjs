// Developer tool, not part of the website. Builds data/course-assessments.json from PolyU's public
// Subject Description Forms. No AI model is involved: the assessment table is read with pattern matching,
// and a form that does not pass every rule in lib/course-rules.mjs is listed in data/forms-not-read.json
// with the reason, never guessed at.
//
//   node scripts/collect-forms.mjs <folder to keep downloaded PDFs in> [DEPT ...]
//
// The PDFs are kept outside the repository (pass a folder that is not in it). Only facts go in the dataset:
// code, title, weights, link, date, and the words the weights were read from.
// It fetches one file a second, and PolyU's robots.txt (checked Oct 2026) does not disallow these paths.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { entryProblems, squashText } from "../lib/course-rules.mjs";

const pdfParse = createRequire(import.meta.url)("pdf-parse");
const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), "..");
const ORIGIN = "https://www.polyu.edu.hk";
const AGENT = "Mozilla/5.0 (semester-planner; DSAI1202 student project)";

// Each department lists its forms differently, so each needs its own entry: the pages to read and what a form link looks like.
const SOURCES = {
  DSAI: { pages: ["/dsai/study/subjects-on-offer/"], link: /href="(\/dsai\/-\/media\/department\/dsai\/programme\/sdfs\/[^"]+\.pdf[^"]*)"/g },
  COMP: {
    pages: ["/comp/study/subject-offerings/", "/comp/study/ug-programmes/scheme-in-computing-and-ai/subjects/"],
    link: /href="((?:https:\/\/www\.polyu\.edu\.hk)?\/comp\/docdrive\/ug\/subject\/[^"]+\.pdf[^"]*)"/g,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** Read one form's text into an entry. Throws, with the reason, if any part cannot be read with confidence. */
export function readForm(text, url) {
  const code = (text.match(/Subject\s+Code\s*:?\s*([A-Z]{2,5})\s?(\d{3,4}[A-Z0-9]{0,3})\b/) || []).slice(1).join("");
  if (!code) throw new Error("no subject code found in the form");
  const fileCode = decodeURIComponent(url).split("/").pop().split("?")[0].replace(/\.pdf$/i, "").toUpperCase();
  if (!fileCode.split(/[-_ ]/).includes(code)) throw new Error(`the form says ${code} but the file is named ${fileCode}`);

  const title = squashKeepCase((text.match(/Subject\s+Title\s*:?\s*([\s\S]*?)\n\s*(?:Credit\s+Value|Level\b)/) || [])[1] || "");
  if (!title) throw new Error("no subject title found");

  // The date is printed at the top of some forms ("Jul 2025"); many carry none.
  const dated = text.slice(0, 400).match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(20\d{2})\b/);
  const sourceDate = dated ? `${dated[2]}-${String(MONTHS.indexOf(dated[1].toLowerCase()) + 1).padStart(2, "0")}` : null;

  const start = text.search(/Assessment\s+Methods\s+in\s+Alignment/i);
  if (start === -1) throw new Error("no assessment section found");
  const rest = text.slice(start);
  const totalAt = rest.search(/\bTotal\s*:?\s*100\s*%/i);
  if (totalAt === -1) throw new Error('the assessment table has no "Total 100%" line');
  const section = rest.slice(0, totalAt + rest.slice(totalAt).match(/\bTotal\s*:?\s*100\s*%/i)[0].length);

  // The rows start after the table's heading, which ends with the column of outcome letters ("a b c d e").
  const heading = section.match(/to\s+be\s+assessed[\s\S]*?\n\s*(?:[a-z]\s+)*[a-z]\s*\n/i) || section.match(/%\s*\n?\s*weighting/i);
  if (!heading) throw new Error("could not find where the assessment table's rows begin");
  const body = section.slice(heading.index + heading[0].length, totalAt);

  // Read every weight with the words printed before it. In these tables a row's sub-items ("1. Assignments
  // 2. Project") often carry no weight of their own and print after their row's weight, so the words before a
  // weight are a mix of the previous row's leftovers and this row's name. Only the LAST line is this row's name.
  let rows = [];
  let last = 0;
  for (const match of body.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)) {
    const lines = itemLines(body.slice(last, match.index));
    last = match.index + match[0].length;
    if (lines.length === 0) throw new Error(`a weight of ${match[1]}% has no words before it`);
    rows.push({ name: lines.at(-1), before: lines.at(-2) || "", weight: Number(match[1]) });
  }
  if (rows.length === 0) throw new Error("no weights found in the assessment table");

  // Some forms print a heading row ("Continuous Assessment 60%") and then its parts. Keep the parts, drop the heading.
  const sum = (list) => Math.round(list.reduce((n, row) => n + row.weight, 0) * 100) / 100;
  if (sum(rows) !== 100) {
    const kept = [];
    for (let i = 0; i < rows.length; i++) {
      let parts = 0;
      let j = i + 1;
      while (j < rows.length && parts < rows[i].weight) parts = Math.round((parts + rows[j++].weight) * 100) / 100;
      if (j > i + 2 && parts === rows[i].weight) continue; // a heading: its parts follow and add up to it
      kept.push(rows[i]);
    }
    rows = kept;
  }
  if (sum(rows) !== 100) throw new Error(`the weights add up to ${sum(rows)}, not 100`);

  // What a form can be trusted for is the split between the final examination and everything else: the other
  // rows' names are too tangled with sub-items to rely on. So an entry keeps the examination row(s) as printed,
  // and one worked-out row for the rest. A mid-term, test or quiz is not the examination even if called an exam.
  // A name can wrap onto two lines ("Mid-term Programming" / "Exam"), so the line before it is checked as well.
  const isExam = (row) =>
    /\bexam/i.test(row.name) && !/mid|test|quiz|continuous/i.test(row.name) && !/(?:mid[\s-]*term|midterm|\bmid|programming|\blab|practical|oral)$/i.test(row.before);
  const exams = rows.filter(isExam).map((row) => ({ name: row.name, weight: row.weight, kind: "exam" }));
  // If the table talks about an examination but no weight could be tied to it, the split is unknown: do not guess.
  const mentions = (body.match(/\b(?:final\s+)?exam(?:ination)?s?\b/gi) || []).length;
  const notFinal = (body.match(/\b(?:mid[\s-]*term|midterm|programming|lab|practical|oral)\s+exam(?:ination)?s?\b/gi) || []).length;
  if (exams.length === 0 && mentions > notFinal) throw new Error("the table mentions an examination but its weight could not be picked out");
  const others = Math.round((100 - sum(exams)) * 100) / 100;
  rows = [...exams, ...(others > 0 ? [{ name: "All other assessment", weight: others, kind: "coursework", computed: true }] : [])];

  const entry = {
    code,
    aliases: [],
    title,
    rows,
    source: "form",
    sourceUrl: url.split("?")[0],
    sourceDate,
    semester: null,
    checkedBy: "script rules; read by Claude",
    evidence: squashKeepCase(body + " Total 100%"),
  };
  const problems = entryProblems(entry);
  if (problems.length > 0) throw new Error(problems.join("; "));
  return entry;
}

const squashKeepCase = (s) => String(s).replace(/\s+/g, " ").trim();

/** The words before a weight, as separate lines: no bracketed examples, outcome ticks, list numbers or bullets. */
function itemLines(raw) {
  return raw
    .replace(/[✓✔√]/g, " ")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .split(/\n|(?:^|\s)(?:\d+[.)]|[•▪■◦])\s+/)
    .map((line) => squashKeepCase(line).replace(/^(?:\d+[.)]|[a-z][.)]|[•\-–])\s*/i, "").replace(/^[\s:.\-–]+|[\s:.\-–]+$/g, ""))
    .filter((line) => /[a-z]{3}/i.test(line));
}

async function main() {
  const [cache, ...asked] = process.argv.slice(2);
  if (!cache) throw new Error("usage: node scripts/collect-forms.mjs <folder for PDFs, outside the repo> [DEPT ...]");
  fs.mkdirSync(cache, { recursive: true });
  const depts = asked.length > 0 ? asked : Object.keys(SOURCES);

  const datasetPath = path.join(ROOT, "data", "course-assessments.json");
  const rejectedPath = path.join(ROOT, "data", "forms-not-read.json");
  const existing = fs.existsSync(datasetPath) ? JSON.parse(fs.readFileSync(datasetPath, "utf8")) : [];
  // Entries typed in by hand from outlines are never touched by this tool.
  const byCode = new Map(existing.filter((entry) => entry.source === "outline").map((entry) => [entry.code, entry]));
  for (const entry of existing) if (!byCode.has(entry.code)) byCode.set(entry.code, entry);
  const rejected = new Map((fs.existsSync(rejectedPath) ? JSON.parse(fs.readFileSync(rejectedPath, "utf8")) : []).map((r) => [r.url, r]));

  for (const dept of depts) {
    const source = SOURCES[dept];
    if (!source) throw new Error(`no source is set up for ${dept}`);
    const links = new Set();
    for (const page of source.pages) {
      const html = await (await get(ORIGIN + page)).text();
      for (const match of html.matchAll(source.link)) links.add(new URL(match[1].replace(/&amp;/g, "&"), ORIGIN).href);
      await sleep(1000);
    }
    let read = 0;
    let failed = 0;
    for (const url of links) {
      const short = url.split("?")[0];
      const file = path.join(cache, `${dept}-${decodeURIComponent(short).split("/").pop()}`);
      try {
        if (!fs.existsSync(file)) {
          fs.writeFileSync(file, Buffer.from(await (await get(url)).arrayBuffer()));
          await sleep(1000);
        }
        const entry = readForm((await pdfParse(fs.readFileSync(file))).text, url);
        if (byCode.get(entry.code)?.source !== "outline") byCode.set(entry.code, entry);
        rejected.delete(short);
        read++;
      } catch (err) {
        rejected.set(short, { dept, url: short, reason: String(err.message || err) });
        failed++;
      }
    }
    console.log(`${dept}: ${links.size} forms linked, ${read} read, ${failed} not read`);
  }

  const sorted = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  fs.writeFileSync(datasetPath, `${JSON.stringify(sorted, null, 2)}\n`);
  fs.writeFileSync(rejectedPath, `${JSON.stringify([...rejected.values()].sort((a, b) => a.url.localeCompare(b.url)), null, 2)}\n`);
  console.log(`dataset: ${sorted.length} entries; not read: ${rejected.size}`);
}

// Only when run directly, so readForm can be imported and tried on its own.
if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
