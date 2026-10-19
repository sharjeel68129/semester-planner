"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  acceptSuggestions,
  canExport,
  chooseSection,
  courseKey,
  describeNumbers,
  coursesWithoutClass,
  expandWeekly,
  mergeEvents,
  needsReview,
  numberGaps,
  openChoices,
  preferDetailed,
} from "@/lib/review";
import { makeEvent } from "@/lib/schema";
import { suggestWeekly } from "@/lib/suggest";
import { toIcs } from "@/lib/calendar";
import { MAX_FILE_BYTES, MAX_FILES } from "@/lib/validate";
import { addDays, addMonths, focusDate, formatDate, today } from "@/lib/dates";
import { TERMS, resolveTerm, termRange } from "@/lib/polyu-calendar";
import { VIEW_OPTIONS, describeReminders } from "@/lib/settings";
import { CheckIcon, ListView, MonthView, WeekView, TYPE_LABELS, periodLabel } from "./views";
import EventEditor from "./event-editor";
import Breakdown from "./breakdown";

const MAX_MB = MAX_FILE_BYTES / 1024 / 1024;

/** Turn a server error into something a student can act on. */
function explain(message) {
  if (/daily limit/.test(message)) {
    return "The AI service's free daily limit has been used up. It resets within a day; try again tomorrow.";
  }
  if (/\((429|503)\)/.test(message)) {
    return "The AI service is busy right now. Wait a minute, then press the button again.";
  }
  return message || "Something went wrong. Try again.";
}

const WEEKDAY_OPTIONS = [
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
];

/** Asks when a course meets, for a course whose outline gave no class time. `onAdd` returns false if it could not add one. */
function ClassTimePrompt({ course, onAdd, onSkip }) {
  const [problem, setProblem] = useState("");
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    if (!onAdd(course, form.get("weekday"), form.get("time"))) {
      setProblem("The teaching weeks are not known: choose your semester in Settings first.");
    }
  }
  return (
    <form className="choice" onSubmit={submit} aria-label={`Class time for ${course}`}>
      <p>
        <strong>When is {course}&rsquo;s class?</strong> None was found in its outline; it will be added to every
        teaching week.
      </p>
      <div className="choice-options class-time">
        <label>
          Day{" "}
          <select name="weekday" required defaultValue="">
            <option value="" disabled>
              Choose
            </option>
            {WEEKDAY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Starts <input type="time" name="time" required />
        </label>
        <button type="submit" className="button">
          Add weekly class
        </button>
        <button type="button" className="link" onClick={onSkip}>
          It has no classes
        </button>
      </div>
      {problem && (
        <p className="alert" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}

/**
 * The signed-in screen: outlines go in on the left, the calendar is in the middle.
 * `events` is the saved list (null when empty); `settings` is from lib/settings.js; `account` is the bar's right-hand side.
 */
export default function Planner({ events, setEvents, settings, updateSettings, account, saveLine }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);
  const [progress, setProgress] = useState("");
  const [exportError, setExportError] = useState("");
  const [checks, setChecks] = useState([]);
  // Events left out because another file in the same upload describes the course in more detail; can be put back.
  const [leftOut, setLeftOut] = useState([]);
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
  // What one press of "Accept all suggested dates" would change, so the button only shows when it does something.
  const acceptable = acceptSuggestions(list).accepted;
  const noDateAtAll = list.filter((event) => !event.date && event.suggestedDates.length === 0 && !needsReview(event)).length;
  const missingClasses = coursesWithoutClass(list, settings.noClassCourses);
  const gaps = numberGaps(list, settings.ignoredGaps);
  // The calendar shows dated events and suggested dates; only events with neither are missing from it.
  const unshown = list.filter((event) => !event.date && event.suggestedDates.length === 0).length;

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
    const results = [];
    const skipped = [];
    let stopped = false;
    setLoading(true);
    setError("");
    setFailed([]);
    setChecks([]);
    setLeftOut([]);
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
        if (res.ok) results.push({ file: file.name, events: data.events, checks: data.assessmentChecks || [] });
        else if (res.status === 413) skipped.push({ file: file.name, error: "too large for this server to accept" });
        else skipped.push({ file: file.name, error: data.error || `the server could not process it (${res.status})` });
      } catch {
        skipped.push({ file: file.name, error: "could not reach the server; check your connection" });
      }
    }
    // A short subject form and a detailed outline for the same course would list the same marks twice.
    const { events: found, checks: checked, leftOut: duplicates } = preferDetailed(results);
    // Merged in one go, so two outlines for the same course are not mistaken for an old and a new version.
    if (found.length > 0) setEvents((current) => mergeEvents(current || [], found));
    else if (skipped.length === 0 && !stopped) {
      setError("No classes, deadlines, quizzes or exams were found. Check these are the right outlines.");
    }
    setFailed(skipped);
    setChecks(checked);
    setLeftOut(duplicates.filter((item) => item.events.length > 0));
    // Each course's breakdown is kept with the account, so it is still shown after a reload. A file with no
    // breakdown does not wipe one read earlier from another file for the same course.
    const read = {};
    for (const check of checked) {
      const key = courseKey(check.course || check.file);
      if (check.total === null && settings.breakdowns[key]?.rows.length) continue;
      read[key] = {
        course: check.course || check.file,
        total: check.total,
        rows: check.rows.map(({ name, weight }) => ({ name, weight })),
        reference: check.reference || null,
      };
    }
    if (Object.keys(read).length > 0) updateSettings({ breakdowns: { ...settings.breakdowns, ...read } });
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

  // A fresh start before uploading again: a re-upload merges into what is saved, so mistakes from an earlier
  // reading would otherwise stay. The same action is in Settings.
  function removeAll() {
    if (!window.confirm(`Remove all ${list.length} events? This cannot be undone.`)) return;
    setOpen(null);
    setChecks([]);
    setFailed([]);
    setEvents(null);
    updateSettings({ breakdowns: {}, ignoredGaps: [] });
  }

  function acceptAll() {
    setOpen(null);
    setEvents((current) => acceptSuggestions(current).events);
  }

  /** Put back the events left out for a course because another file described it in more detail. */
  function putBack(item) {
    setEvents((current) => mergeEvents(current || [], item.events, { partial: true }));
    setLeftOut((current) => current.filter((other) => other !== item));
  }

  /** A class time the student typed in: one dated class in each teaching week. They gave it, so it needs no accepting. */
  function addClassTime(course, weekday, time) {
    const { dates } = suggestWeekly(weekday, term);
    if (dates.length === 0) return false;
    const added = dates.map((date) =>
      makeEvent({ title: `${course} class`, course, type: "class", date, time: time || null, note: "Class time you entered." }),
    );
    setEvents((current) => [...(current || []), ...added]);
    return true;
  }

  /** The student says a numbered item the outline skips does exist: added with no date, for them to fill in. */
  function addMissing(gap, number) {
    const note = `Not in the outline: you added it because the outline lists ${gap.stem} ${describeNumbers(gap.numbers)}.`;
    setEvents((current) => [...(current || []), makeEvent({ title: `${gap.stem} ${number}`, course: gap.course, type: gap.type, note })]);
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
              PDF, Word, text or image (PNG, JPG, WebP). Up to {MAX_FILES} files, {MAX_MB} MB each.
            </span>
            <input id="files" type="file" name="files" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" multiple required aria-describedby="files-hint" />
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

        <Breakdown breakdowns={settings.breakdowns} checks={checks} />

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

        {list.length > 0 && (
          <section className="sidebar-section">
            <h2>Start again</h2>
            <button className="button button-quiet button-wide" type="button" disabled={loading} onClick={removeAll}>
              Remove all events
            </button>
            <p className="hint">Clears the calendar, for example before uploading your outlines again.</p>
          </section>
        )}

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
            {noDateAtAll > 0 &&
              ` ${noDateAtAll} with no date at all: open ${noDateAtAll === 1 ? "it" : "each one"} in the list to add a date.`}
          </p>
        )}

        {leftOut.map((item) => (
          <div key={item.course} className="choice" role="status">
            <p>
              <strong>Two files describe {item.course}.</strong> The more detailed one, {item.kept}, was used, so the same marks
              are not listed twice. Left out from {item.files.join(", ")}: {item.events.map((event) => event.title).join(", ")}.
            </p>
            <div className="choice-options">
              <button type="button" className="button button-quiet" onClick={() => putBack(item)}>
                Put them back
              </button>
            </div>
          </div>
        ))}

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

        {gaps.map((gap) => (
          <div key={gap.key} className="choice" role="group" aria-label={`${gap.stem} missing from ${gap.course}`}>
            <p>
              <strong>
                {gap.course ? `${gap.course}: ` : ""}
                {gap.missing.map((n) => `${gap.stem} ${n}`).join(" and ")} {gap.missing.length === 1 ? "is" : "are"} not in the
                outline.
              </strong>{" "}
              It lists {gap.stem} {describeNumbers(gap.numbers)}. It may be skipped on purpose, for example in a test week.
            </p>
            <div className="choice-options">
              {gap.missing.map((n) => (
                <button key={n} type="button" className="button button-quiet" onClick={() => addMissing(gap, n)}>
                  Add {gap.stem} {n}
                </button>
              ))}
              <button
                type="button"
                className="link"
                onClick={() => updateSettings({ ignoredGaps: [...settings.ignoredGaps, ...gap.missing.map((n) => `${gap.key}|${n}`)] })}
              >
                {gap.missing.length === 1 ? "It isn't missing" : "They aren't missing"}
              </button>
            </div>
          </div>
        ))}

        {missingClasses.map(({ key, course }) => (
          <ClassTimePrompt
            key={key}
            course={course}
            onAdd={addClassTime}
            onSkip={() => updateSettings({ noClassCourses: [...settings.noClassCourses, key] })}
          />
        ))}

        {acceptable > 0 && (
          <div className="choice">
            <p>
              <strong>
                {acceptable} {acceptable === 1 ? "event has a suggested date" : "events have suggested dates"}
              </strong>
, worked out from the week numbers in your outline (dashed on the calendar). Check them, then accept them to put
              them in the calendar file.
            </p>
            <div className="choice-options">
              <button type="button" className="button" onClick={acceptAll}>
                Accept all suggested dates
              </button>
            </div>
          </div>
        )}

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

        {view !== "list" && unshown > 0 && (
          <p className="notice">
            {unshown} with no date yet cannot be shown here.{" "}
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
            <span className="chip chip-class chip-suggested legend-swatch">Suggested</span>
          </li>
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
