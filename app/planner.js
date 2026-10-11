"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { canExport, chooseSection, expandWeekly, mergeEvents, needsReview, openChoices } from "@/lib/review";
import { toIcs } from "@/lib/calendar";
import { MAX_FILE_BYTES, MAX_FILES } from "@/lib/validate";
import { addDays, addMonths, focusDate, formatDate, today } from "@/lib/dates";
import { TERMS, resolveTerm, termRange } from "@/lib/polyu-calendar";
import { VIEW_OPTIONS, describeReminders } from "@/lib/settings";
import { CheckIcon, ListView, MonthView, WeekView, TYPE_LABELS, periodLabel } from "./views";
import EventEditor from "./event-editor";

const MAX_MB = MAX_FILE_BYTES / 1024 / 1024;

/** Turn a server error into something a student can act on. */
function explain(message) {
  if (/\((429|503)\)/.test(message)) {
    return "The AI service is busy right now. Wait a minute, then press the button again.";
  }
  return message || "Something went wrong. Try again.";
}

const percent = (n) => `${Math.round(n * 100) / 100}%`;

/** One course's 100% check in words. It covers graded components only, and says nothing about dates. */
function checkLine({ total, rows }) {
  if (total === null) return "No grade breakdown was found, so the assessments could not be checked against 100%.";
  const parts = rows.map((row) => `${row.name} ${percent(row.weight)}`).join(", ");
  const empty = rows.filter((row) => row.events === 0).map((row) => `${row.name} (${percent(row.weight)})`);
  const lines = [];
  if (total === 100) lines.push(`Assessments add up to 100%: ${parts}.`);
  else if (total < 100) {
    lines.push(`Assessments found add up to ${percent(total)}: ${parts}. ${percent(100 - total)} is missing; check the outline's assessment section.`);
  } else lines.push(`Assessments found add up to ${percent(total)}, which is over 100%: ${parts}. Something may be counted twice.`);
  if (empty.length > 0) lines.push(`No event was found for ${empty.join(", ")}.`);
  return lines.join(" ");
}

/**
 * The signed-in screen: outlines go in on the left, the calendar is in the middle.
 * `events` is the saved list (null when empty); `settings` is from lib/settings.js; `account` is the bar's right-hand side.
 */
export default function Planner({ events, setEvents, settings, account, saveLine }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);
  const [progress, setProgress] = useState("");
  const [exportError, setExportError] = useState("");
  const [checks, setChecks] = useState([]);
  // The semester from Settings; if none is chosen there, the term running now or the next one.
  const semester = settings.semester || TERMS.find((item) => today() <= termRange(item).end)?.id || "other";
  const term = resolveTerm(semester, settings.weekOneMonday);
  // Starts in the view chosen in Settings; switching here lasts until the page is left.
  const [view, setView] = useState(settings.defaultView);
  const [cursor, setCursor] = useState(today);
  const [open, setOpen] = useState(null);

  const list = events || [];
  const ready = list.filter(canExport);
  const toCheck = list.filter((event) => needsReview(event)).length;
  const undated = list.filter((event) => !event.date && !needsReview(event)).length;

  // When events first appear, open the calendar where they are, not on an empty month.
  const hadEvents = useRef(false);
  useEffect(() => {
    if (list.length > 0 && !hadEvents.current) setCursor(focusDate(list));
    hadEvents.current = list.length > 0;
  }, [events]);

  // One file per request: each stays under the host's size and time limits, and one bad file cannot sink the rest.
  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const files = form.getAll("files");
    if (files.length > MAX_FILES) return setError(`Choose at most ${MAX_FILES} files at a time.`);
    const found = [];
    const checked = [];
    const skipped = [];
    let stopped = false;
    setLoading(true);
    setError("");
    setFailed([]);
    setChecks([]);
    for (const [i, file] of files.entries()) {
      // Checked here as well as on the server, so a large file is not uploaded just to be refused.
      if (file.size > MAX_FILE_BYTES) {
        skipped.push({ file: file.name, error: `larger than ${MAX_MB} MB` });
        continue;
      }
      setProgress(`Reading ${files.length === 1 ? "" : `${i + 1} of ${files.length}: `}${file.name}.`);
      const body = new FormData();
      body.set("files", file);
      body.set("semester", semester);
      body.set("weekOne", settings.weekOneMonday || "");
      try {
        const res = await fetch("/api/extract", { method: "POST", body });
        // The host can answer before our route runs (too large, timed out), and then the reply is not JSON.
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setError(data.error || "Sign in to upload outlines.");
          stopped = true;
          break;
        }
        if (res.ok) {
          found.push(...data.events);
          checked.push(...(data.assessmentChecks || []));
        }
        else if (res.status === 413) skipped.push({ file: file.name, error: "too large for this server to accept" });
        else skipped.push({ file: file.name, error: data.error || `the server could not process it (${res.status})` });
      } catch {
        skipped.push({ file: file.name, error: "could not reach the server; check your connection" });
      }
    }
    // Merged in one go, so two outlines for the same course are not mistaken for an old and a new version.
    if (found.length > 0) setEvents((current) => mergeEvents(current || [], found));
    else if (skipped.length === 0 && !stopped) {
      setError("No classes, deadlines, quizzes or exams were found. Check these are the right outlines.");
    }
    setFailed(skipped);
    setChecks(checked);
    setProgress("");
    setLoading(false);
  }

  function changeEvent(index, patch) {
    setEvents((current) => current.map((event, i) => (i === index ? { ...event, ...patch } : event)));
  }

  // The editor is closed first in both, because the positions in the list change.
  function expandEvent(index) {
    setOpen(null);
    setEvents((current) => expandWeekly(current, index));
  }

  function removeEvent(index) {
    if (!window.confirm("Remove this event? If you upload the same outline again it will come back.")) return;
    setOpen(null);
    setEvents((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length > 0 ? next : null;
    });
  }

  function downloadCalendar() {
    setExportError("");
    try {
      const url = URL.createObjectURL(new Blob([toIcs(ready, settings.reminders)], { type: "text/calendar" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "semester-planner.ics";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(String(err.message || err));
    }
  }

  const step = (n) => setCursor(view === "month" ? addMonths(cursor, n) : addDays(cursor, 7 * n));

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">AI Semester Planner</span>
        <div className="topbar-account">{account}</div>
      </header>

      <aside className="sidebar" aria-label="Add outlines and download">
        <form onSubmit={onSubmit} aria-busy={loading}>
          <h2>Add outlines</h2>
          <div className="field">
            <label htmlFor="files">Course outlines</label>
            <span className="hint" id="files-hint">
              PDF, Word or text. Up to {MAX_FILES} files, {MAX_MB} MB each.
            </span>
            <input id="files" type="file" name="files" accept=".pdf,.docx,.txt" multiple required aria-describedby="files-hint" />
          </div>
          <div className="field">
            <span className="field-name">Semester</span>
            <span className="hint">
              {term ? `${term.label}. ` : "Not set yet: give the Monday of week 1 in Settings. "}
              <Link className="link" href="/settings#semester">
                Change
              </Link>
            </span>
          </div>
          <button className="button button-wide" type="submit" disabled={loading || !term}>
            {loading ? "Finding deadlines" : "Find my deadlines"}
          </button>
          <div className="status" aria-live="polite">
            {loading && (
              <p className="status-loading">
                <span className="spinner" aria-hidden="true" />
                {progress} This usually takes under a minute per file, and a few minutes when the AI service is busy.
              </p>
            )}
          </div>
          {error && (
            <p className="alert" role="alert">
              <strong>Deadlines not found yet</strong>
              {error}
            </p>
          )}
        </form>

        {failed.length > 0 && (
          <div className="alert" role="alert">
            <strong>{failed.length === 1 ? "1 file was skipped" : `${failed.length} files were skipped`}</strong>
            <ul>
              {failed.map(({ file, error: why }) => (
                <li key={file}>
                  {/* readFileText already prefixes its messages with the file name */}
                  <b>{file}:</b> {explain(why.startsWith(`${file}: `) ? why.slice(file.length + 2) : why)}
                </li>
              ))}
            </ul>
            Upload the skipped {failed.length === 1 ? "file" : "files"} again to add{" "}
            {failed.length === 1 ? "its" : "their"} events.
          </div>
        )}

        {checks.length > 0 && (
          <ul className="checks" aria-label="Assessment check">
            {checks.map((check, i) => (
              <li key={i} className={check.complete ? "check-ok" : "check-gap"}>
                <b>{check.course || check.file}:</b> {checkLine(check)}
              </li>
            ))}
          </ul>
        )}

        <section className="sidebar-section">
          <h2>Calendar file</h2>
          <button className="button button-wide" type="button" disabled={ready.length === 0} onClick={downloadCalendar}>
            Download ({ready.length} {ready.length === 1 ? "event" : "events"})
          </button>
          <p className="hint">
            {toCheck > 0 &&
              `${toCheck} still to check ${toCheck === 1 ? "is" : "are"} left out until you mark ${toCheck === 1 ? "it" : "them"} as checked. `}
            {undated > 0 && `${undated} with no date yet ${undated === 1 ? "is" : "are"} left out until you add one. `}
            {settings.reminders.length > 0
              ? `Each event reminds you ${describeReminders(settings.reminders)}. `
              : "Events have no reminders. "}
            <Link className="link" href="/settings">
              Change reminders
            </Link>
            . Open the file to add it to your own calendar.
          </p>
          {exportError && (
            <p className="alert" role="alert">
              <strong>Calendar file not made</strong>
              {exportError}
            </p>
          )}
        </section>

        <div className="sidebar-foot">
          {saveLine}
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <div className="toolbar-period">
            <h1 aria-live="polite">{periodLabel(view, cursor, list.length, settings.weekStart)}</h1>
            {view !== "list" && (
              <div className="toolbar-nav">
                <button type="button" className="button button-quiet" onClick={() => step(-1)}>
                  <span aria-hidden="true">‹</span>
                  <span className="sr-only">Previous {view}</span>
                </button>
                <button type="button" className="button button-quiet" onClick={() => setCursor(today())}>
                  Today
                </button>
                <button type="button" className="button button-quiet" onClick={() => step(1)}>
                  <span aria-hidden="true">›</span>
                  <span className="sr-only">Next {view}</span>
                </button>
              </div>
            )}
          </div>
          <div className="segmented" role="group" aria-label="Calendar view">
            {VIEW_OPTIONS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <p className="notice">No events yet. Add your course outlines to fill the calendar.</p>
        ) : (
          <p className="notice">
            {toCheck === 0 ? (
              "Nothing needs checking. Select any event to change its date, time or type."
            ) : (
              <>
                <CheckIcon /> {toCheck} to check. Select an event marked like this to see why, fix it and mark it as
                checked.
              </>
            )}
            {undated > 0 && ` ${undated} with no date yet: open ${undated === 1 ? "it" : "each one"} in the list to add a date.`}
          </p>
        )}

        {openChoices(list).map(({ choice, options }) => (
          <div key={choice} className="choice" role="group" aria-label={`Choose your ${choice} section`}>
            <p>
              <strong>
                This outline lists {options.length} {choice} sections.
              </strong>{" "}
              Choose yours and the others are removed.
            </p>
            <div className="choice-options">
              {options.map(({ title, time, firstDate }) => (
                <button key={title} type="button" className="button button-quiet" onClick={() => setEvents((current) => chooseSection(current, choice, title))}>
                  {[title, firstDate && formatDate(firstDate, { weekday: "short" }), time].filter(Boolean).join(", ")}
                </button>
              ))}
              <button type="button" className="link" onClick={() => setEvents((current) => chooseSection(current, choice, null))}>
                Keep them all
              </button>
            </div>
          </div>
        ))}

        {view === "list" && <ListView events={list} onOpen={setOpen} />}
        {view === "month" && (
          <MonthView
            events={list}
            cursor={cursor}
            weekStart={settings.weekStart}
            onOpen={setOpen}
            onShowWeek={(day) => {
              setCursor(day);
              setView("week");
            }}
          />
        )}
        {view === "week" && <WeekView events={list} cursor={cursor} weekStart={settings.weekStart} onOpen={setOpen} />}

        {view !== "list" && list.some((event) => !event.date) && (
          <p className="notice">
            {list.filter((event) => !event.date).length} with no date yet cannot be shown here.{" "}
            <button type="button" className="link" onClick={() => setView("list")}>
              See them in the list
            </button>
          </p>
        )}

        <ul className="legend" aria-label="What the colours mean">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <li key={type}>
              <span className={`chip chip-${type} legend-swatch`}>{label}</span>
            </li>
          ))}
          <li>
            <CheckIcon /> Needs checking
          </li>
        </ul>
      </main>

      {open !== null && list[open] && (
        <EventEditor
          event={list[open]}
          onChange={(patch) => changeEvent(open, patch)}
          onExpand={() => expandEvent(open)}
          onRemove={() => removeEvent(open)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
