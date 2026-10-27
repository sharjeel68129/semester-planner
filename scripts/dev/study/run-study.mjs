// SPENDS GEMINI QUOTA (about 1-3 requests per file). Accuracy study runner for the DSAI1202 videos.
//
// Not part of the website and scores nothing: it runs each course's outline files through the same code the
// website uses (upload check, text reading, Gemini, output checks, and the planner's handling of two files for one
// course), and writes down what the website would have shown, one row per event, for the group to score by hand.
// How the study works: the group guideline, and scripts/dev/study/README.md.
//
//   node --env-file=.env.local --import ./scripts/dev/loader/register.mjs scripts/dev/study/run-study.mjs \
//     --round R1 --version baseline-2026-10-27 --in study/set-A --out study/results
//
// --round    R1 (set A, old version), R2 (set A, fixed), R3 (set B, old), R4 (set B, fixed)
// --version  a git tag or commit of the website to run; its lib/ is unpacked into .study-versions/.
//            "working" runs the files as they are now (only for trying things out, never for a scored round).
// --in       a folder with one folder per course, named by its Course ID (C001, C002, ...), holding all of that course's files
// --out      where the two result files go: <round>-events.csv (one row per event) and <round>-runs.csv (one per course)
// --model    the one Gemini model to use for the whole study (default gemini-3.5-flash-lite), so rounds compare fairly
// --term     PolyU term id from lib/polyu-calendar.js (default 2026-27-s1). Run semester 2 courses separately.
// --only     run only these Course IDs (comma-separated)
//
// Running it again carries on: a course already done in this round is skipped. A course that failed, or that Gemini
// was too busy for, is tried again; a busy course's events are not recorded, as busy says nothing about accuracy.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// The project folder, three levels up from this file (scripts/dev/<folder>/).
const ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/[\\/]$/, "");

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
for (const name of ["round", "version", "in", "out"]) {
  if (!args[name]) {
    console.error(`Missing --${name}. Usage is at the top of scripts/dev/study/run-study.mjs.`);
    process.exit(1);
  }
}
const model = args.model || "gemini-3.5-flash-lite";
// Read by lib/extract.js when it is imported, so it must be set first: one model only, no fallback to another.
process.env.GEMINI_MODELS = model;

/** The folder whose lib/ is run, and the exact commit it came from. */
function unpackVersion(version) {
  const head = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  if (version === "working") {
    const dirty = execSync("git status --porcelain -- lib", { cwd: ROOT }).toString().trim() ? " + uncommitted changes" : "";
    return { dir: ROOT, label: `working tree (${head}${dirty})` };
  }
  const commit = execSync(`git rev-parse --short "${version}^{commit}"`, { cwd: ROOT }).toString().trim();
  const dir = path.join(ROOT, ".study-versions", version.replace(/[^\w.-]/g, "_"));
  if (!fs.existsSync(path.join(dir, "lib"))) {
    fs.mkdirSync(dir, { recursive: true });
    // lib/ is the code that reads outlines; data/ holds the course dataset lib/reference.js reads.
    execSync(`git archive --format=tar "${version}" lib data | tar -x -C "${dir.replace(/\\/g, "/")}"`, { cwd: ROOT, shell: "bash" });
  }
  return { dir, label: `${version} (${commit})` };
}

const version = unpackVersion(args.version);
const lib = (name) => import(pathToFileURL(path.join(version.dir, "lib", `${name}.js`)).href);
const { readFileText, extractEvents } = await lib("extract");
const { validateUpload } = await lib("validate");
const { needsReview, mergeEvents, preferDetailed } = await lib("review");
const { TERMS } = await lib("polyu-calendar");

const term = TERMS.find((t) => t.id === (args.term || "2026-27-s1"));
if (!term) {
  console.error(`Unknown --term. Known: ${TERMS.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

// ---- CSV files (UTF-8 with a BOM, so Excel and Google Sheets show Chinese and accents correctly) ----
const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
function appendRows(file, header, rows) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, `﻿${header.map(cell).join(",")}\r\n`);
  fs.appendFileSync(file, rows.map((row) => `${row.map(cell).join(",")}\r\n`).join(""));
}
/** Rows of a CSV this script wrote (quoted fields may hold commas, quotes and line breaks). */
function readRows(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  return rows.slice(1);
}

const EVENT_HEADER = ["Round", "Course ID", "Event #", "Course code", "Title", "Type", "Date", "Suggested dates", "Time", "Weight %", "Section group", "Flagged", "Website note", "Source quote", "From file", "Version", "Model", "Run at"];
const RUN_HEADER = ["Round", "Course ID", "Files", "Status", "Events", "Flagged", "Breakdown total %", "Error", "Version", "Model", "Seconds", "Run at"];

fs.mkdirSync(args.out, { recursive: true });
const eventsFile = path.join(args.out, `${args.round}-events.csv`);
const runsFile = path.join(args.out, `${args.round}-runs.csv`);
// Done = the last run of that course in this round was ok or partial. A failed or busy ("retry") course is tried again.
const lastStatus = new Map(readRows(runsFile).map((row) => [row[1], row[3]]));

/** Local time, "2026-10-27 20:29", for the Run at column. */
const now = () => new Date().toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Suggested dates as a person reads them: one date, or "Wed x13: 2026-09-02 to 2026-11-25" for a weekly class. */
function suggested(dates) {
  if (!dates?.length) return "";
  if (dates.length === 1) return dates[0];
  const days = [...new Set(dates.map((d) => WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()]))].join("/");
  return `${days} x${dates.length}: ${dates[0]} to ${dates.at(-1)}`;
}

// The model that answered is only in the log lines lib/extract.js prints, so listen for them.
let answeredBy = [];
const print = console.log.bind(console);
console.log = (...parts) => {
  const found = String(parts[0]).match(/^Gemini answered with (\S+)/);
  if (found) answeredBy.push(found[1]);
  print(...parts);
};

const only = args.only ? new Set(args.only.split(",").map((id) => id.trim())) : null;
const courses = fs
  .readdirSync(args.in, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && (!only || only.has(entry.name)))
  .map((entry) => entry.name)
  .sort();

print(`Round ${args.round}: ${courses.length} courses from ${args.in}, version ${version.label}, model ${model}, ${term.label}`);
let ran = 0;
for (const id of courses) {
  if (["ok", "partial"].includes(lastStatus.get(id))) continue;
  const folder = path.join(args.in, id);
  const files = fs.readdirSync(folder).filter((name) => !name.startsWith(".") && !name.startsWith("~$") && fs.statSync(path.join(folder, name)).isFile()).sort();
  const started = Date.now();
  answeredBy = [];
  print(`\n== ${id}: ${files.join(", ") || "(no files)"}`);

  // As app/planner.js does: each file on its own (as app/api/extract/route.js does), then the files put together.
  const results = [];
  const errors = [];
  for (const name of files) {
    const buffer = fs.readFileSync(path.join(folder, name));
    const problem = validateUpload(name, buffer);
    if (problem) {
      errors.push(problem);
      continue;
    }
    try {
      const text = await readFileText(name, buffer);
      // The baseline's extractEvents takes two arguments and ignores the file; later versions read a PDF's layout from it.
      const found = await extractEvents(text, term, /\.pdf$/i.test(name) ? buffer : null);
      results.push({ file: name, events: found.events, checks: found.checks.map((check) => ({ file: name, ...check })) });
    } catch (err) {
      errors.push(`${name}: ${err.message || err}`);
    }
  }
  // Gemini busy, out of quota or timed out says nothing about the website's accuracy: record nothing, retry later.
  const busy = errors.filter((error) => /Gemini request failed(\s\((429|5\d\d)|$)/.test(error));
  if (busy.length > 0) {
    appendRows(runsFile, RUN_HEADER, [[args.round, id, files.join(" | "), "retry", "", "", "", busy.join(" | "), version.label, model, Math.round((Date.now() - started) / 1000), now()]]);
    print(`   retry later: ${busy.join(" | ")}`);
    if (busy.some((error) => /daily limit/.test(error))) {
      print("Daily Gemini limit reached; stopping. Run the same command tomorrow (or with billing on) to carry on.");
      break;
    }
    continue;
  }
  if (errors.some((error) => /missing GEMINI_API_KEY/.test(error))) {
    print("No GEMINI_API_KEY: run with --env-file=.env.local (see the top of this file).");
    process.exit(1);
  }

  const { events: kept, checks } = preferDetailed(results);
  const events = mergeEvents([], kept);
  const fileOf = new Map(results.flatMap(({ file, events: found }) => found.map((event) => [event, file])));

  const status = results.length === 0 ? "failed" : errors.length > 0 ? "partial" : "ok";
  const runAt = now();
  const models = [...new Set(answeredBy)].join(" + ") || "-";
  appendRows(
    eventsFile,
    EVENT_HEADER,
    events.map((e, i) => [
      args.round, id, `${id}-E${String(i + 1).padStart(2, "0")}`, e.course, e.title, e.type, e.date || "", suggested(e.suggestedDates),
      e.time || "", e.weight ?? "", e.choice || "", needsReview(e) ? "yes" : "no", e.note, e.sourceQuote,
      fileOf.get(e) || "", version.label, models, runAt,
    ]),
  );
  const totals = checks.map((check) => (check.total === null ? "none found" : `${check.course || "?"}: ${check.total}`)).join("; ");
  appendRows(runsFile, RUN_HEADER, [[
    args.round, id, files.join(" | "), status, events.length, events.filter((e) => needsReview(e)).length, totals,
    errors.join(" | "), version.label, models, Math.round((Date.now() - started) / 1000), runAt,
  ]]);
  print(`   ${status}: ${events.length} events, ${events.filter((e) => needsReview(e)).length} flagged${errors.length ? ` | ${errors.join(" | ")}` : ""}`);
  ran++;
}

const failed = [...new Map(readRows(runsFile).map((row) => [row[1], row[3]]))].filter(([, s]) => s === "failed" || s === "retry").map(([id]) => id);
print(`\nRan ${ran} course(s). Results: ${eventsFile} and ${runsFile}.`);
if (failed.length) print(`Failed (run the same command again to retry): ${failed.join(", ")}`);
