"use client";
import { useEffect, useRef, useState } from "react";
import { needsReview, mergeEvents } from "@/lib/review";
import { toIcs } from "@/lib/calendar";
import { MAX_FILE_BYTES, MAX_FILES } from "@/lib/validate";
import { addDays, addMonths, focusDate, today } from "@/lib/dates";
import { CheckIcon, ListView, MonthView, WeekView, TYPE_LABELS, periodLabel } from "./views";
import EventEditor from "./event-editor";

const MAX_MB = MAX_FILE_BYTES / 1024 / 1024;

const VIEWS = [
  ["list", "List"],
  ["month", "Month"],
  ["week", "Week"],
];

/** Turn a server error into something a student can act on. */
function explain(message) {
  if (/\((429|503)\)/.test(message)) {
    return "The AI service is busy right now. Wait a minute, then press the button again.";
  }
  return message || "Something went wrong. Try again.";
}

/**
 * The signed-in screen: outlines go in on the left, the calendar is in the middle.
 * `events` is the saved list (null when empty); `account` is the bar's right-hand side.
 */
export default function Planner({ events, setEvents, account, saveLine }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);
  const [progress, setProgress] = useState("");
  const [exportError, setExportError] = useState("");
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(today);
  const [open, setOpen] = useState(null);

  const list = events || [];
  const ready = list.filter((event) => !needsReview(event));
  const toCheck = list.length - ready.length;

  // Remember the chosen view on this device. Storage can be blocked; the default view then stays.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("planner-view");
      if (VIEWS.some(([key]) => key === saved)) setView(saved);
    } catch {}
  }, []);
  function chooseView(next) {
    setView(next);
    try {
      localStorage.setItem("planner-view", next);
    } catch {}
  }

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
    const skipped = [];
    let stopped = false;
    setLoading(true);
    setError("");
    setFailed([]);
    for (const [i, file] of files.entries()) {
      // Checked here as well as on the server, so a large file is not uploaded just to be refused.
      if (file.size > MAX_FILE_BYTES) {
        skipped.push({ file: file.name, error: `larger than ${MAX_MB} MB` });
        continue;
      }
      setProgress(`Reading ${files.length === 1 ? "" : `${i + 1} of ${files.length}: `}${file.name}.`);
      const body = new FormData();
      body.set("files", file);
      body.set("start", form.get("start"));
      body.set("end", form.get("end"));
      try {
        const res = await fetch("/api/extract", { method: "POST", body });
        // The host can answer before our route runs (too large, timed out), and then the reply is not JSON.
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setError(data.error || "Sign in to upload outlines.");
          stopped = true;
          break;
        }
        if (res.ok) found.push(...data.events);
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
    setProgress("");
    setLoading(false);
  }

  function changeEvent(index, patch) {
    setEvents((current) => current.map((event, i) => (i === index ? { ...event, ...patch } : event)));
  }

  function removeAll() {
    if (!window.confirm("Remove all your events? This cannot be undone.")) return;
    setOpen(null);
    setFailed([]);
    setEvents(null);
  }

  function downloadCalendar() {
    setExportError("");
    try {
      const url = URL.createObjectURL(new Blob([toIcs(ready)], { type: "text/calendar" }));
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
            <label htmlFor="start">Semester starts</label>
            <input id="start" type="date" name="start" required />
          </div>
          <div className="field">
            <label htmlFor="end">Semester ends</label>
            <input id="end" type="date" name="end" required />
          </div>
          <button className="button button-wide" type="submit" disabled={loading}>
            {loading ? "Finding deadlines" : "Find my deadlines"}
          </button>
          <div className="status" aria-live="polite">
            {loading && (
              <p className="status-loading">
                <span className="spinner" aria-hidden="true" />
                {progress} This can take up to a minute per file.
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

        <section className="sidebar-section">
          <h2>Calendar file</h2>
          <button className="button button-wide" type="button" disabled={ready.length === 0} onClick={downloadCalendar}>
            Download ({ready.length} {ready.length === 1 ? "event" : "events"})
          </button>
          <p className="hint">
            {toCheck > 0 &&
              `${toCheck} still to check ${toCheck === 1 ? "is" : "are"} left out until you mark ${toCheck === 1 ? "it" : "them"} as checked. `}
            Each event reminds you 1 day and 1 hour before. Open the file to add it to your own calendar.
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
          {list.length > 0 && (
            <button type="button" className="link" onClick={removeAll}>
              Remove all events
            </button>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <div className="toolbar-period">
            <h1 aria-live="polite">{periodLabel(view, cursor, list.length)}</h1>
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
            {VIEWS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={view === key} onClick={() => chooseView(key)}>
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
          </p>
        )}

        {view === "list" && <ListView events={list} onOpen={setOpen} />}
        {view === "month" && (
          <MonthView
            events={list}
            cursor={cursor}
            onOpen={setOpen}
            onShowWeek={(day) => {
              setCursor(day);
              chooseView("week");
            }}
          />
        )}
        {view === "week" && <WeekView events={list} cursor={cursor} onOpen={setOpen} />}

        {view !== "list" && list.some((event) => !event.date) && (
          <p className="notice">
            {list.filter((event) => !event.date).length} with no date yet cannot be shown here.{" "}
            <button type="button" className="link" onClick={() => chooseView("list")}>
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
        <EventEditor event={list[open]} onChange={(patch) => changeEvent(open, patch)} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
