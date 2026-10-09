"use client";
import { useEffect, useId, useRef, useState } from "react";
import { needsReview, mergeEvents } from "@/lib/review";
import { toIcs } from "@/lib/calendar";
import { EVENT_TYPES } from "@/lib/schema";
import { accountsEnabled, supabase, loadEvents, saveEvents } from "@/lib/account";
import AuthForm from "./auth-form";

const TYPE_LABELS = { class: "Class", deadline: "Deadline", quiz: "Quiz", exam: "Exam" };

/** "2026-10-30" -> "Friday". Parsed as UTC so the day never shifts with the viewer's timezone. */
function weekday(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

/** Turn a server error into something a student can act on. */
function explain(message) {
  if (/\((429|503)\)/.test(message)) {
    return "The AI service is busy right now. Wait a minute, then press the button again.";
  }
  return message || "Something went wrong. Try again.";
}

/** One editable row. Title and course are fixed: they are how a re-uploaded outline finds this event again. */
function EventRow({ event, onChange }) {
  const id = useId();
  const flagged = needsReview(event);
  return (
    <li className={flagged ? "event event-flagged" : "event"}>
      <div className="event-when">
        <label htmlFor={`${id}-date`}>Date</label>
        <input
          id={`${id}-date`}
          type="date"
          value={event.date || ""}
          onChange={(e) => onChange({ date: e.target.value || null })}
        />
        <span className="event-weekday">{event.date ? weekday(event.date) : "No date yet"}</span>
        <label htmlFor={`${id}-time`}>Time</label>
        <input
          id={`${id}-time`}
          type="time"
          value={event.time || ""}
          onChange={(e) => onChange({ time: e.target.value || null })}
        />
      </div>
      <div>
        <p className="event-title">{event.title}</p>
        <p className="event-meta">
          <label htmlFor={`${id}-type`}>Type</label>
          <select id={`${id}-type`} value={event.type} onChange={(e) => onChange({ type: e.target.value })}>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {event.course}
        </p>
        {flagged && (
          <p className="event-check">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M9 1.5 17 16H1L9 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 7v4M9 13.2v.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>
              <strong>Check this.</strong> {event.note || "The AI was not confident about this one."}
            </span>
          </p>
        )}
        {event.sourceQuote && <blockquote className="event-quote">{event.sourceQuote}</blockquote>}
        {flagged && (
          <p className="event-confirm">
            {/* A human has now checked it, so it no longer needs review and can go in the calendar. */}
            <button type="button" disabled={!event.date} onClick={() => onChange({ ambiguous: false, confidence: 1 })}>
              Mark as checked
            </button>
            {!event.date && <span>Add a date first.</span>}
          </p>
        )}
      </div>
    </li>
  );
}

export default function Home() {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);
  const [exportError, setExportError] = useState("");

  // undefined = still checking, null = signed out.
  const [user, setUser] = useState(undefined);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [retry, setRetry] = useState(0);
  const lastSaved = useRef("[]");
  const userId = user?.id;

  useEffect(() => {
    if (!accountsEnabled) return;
    const { data } = supabase().auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Signing in loads that student's events; signing out clears them from the page.
  useEffect(() => {
    setEvents(null);
    setFailed([]);
    setLoaded(false);
    setLoadError("");
    if (!userId) return;
    let stale = false;
    loadEvents()
      .then((saved) => {
        if (stale) return;
        lastSaved.current = JSON.stringify(saved);
        setEvents(saved.length ? saved : null);
        setSaveState("saved");
        setLoaded(true);
      })
      .catch((err) => !stale && setLoadError(String(err.message || err)));
    return () => {
      stale = true;
    };
  }, [userId]);

  // Save shortly after every change. Never before the saved list has loaded, or an empty page would overwrite it.
  useEffect(() => {
    if (!userId || !loaded) return;
    const list = events || [];
    const snapshot = JSON.stringify(list);
    if (snapshot === lastSaved.current) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      saveEvents(userId, list)
        .then(() => {
          lastSaved.current = snapshot;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 500);
    return () => clearTimeout(timer);
  }, [events, userId, loaded, retry]);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/extract", { method: "POST", body: new FormData(e.target) });
      const data = await res.json();
      if (!res.ok) return setError(explain(data.error));
      // A second upload updates the list instead of replacing it, so edits made so far are kept.
      setEvents((current) => mergeEvents(current || [], data.events));
      setFailed(data.failed || []);
    } catch {
      setError("Could not reach the server. Check your connection, then try again.");
    } finally {
      setLoading(false);
    }
  }

  function changeEvent(index, patch) {
    setEvents((current) => current.map((event, i) => (i === index ? { ...event, ...patch } : event)));
  }

  // Only events a human does not still need to check go into the calendar.
  const ready = events ? events.filter((event) => !needsReview(event)) : [];
  const toCheck = events ? events.length - ready.length : 0;

  function removeAll() {
    if (window.confirm("Remove all your events? This cannot be undone.")) setEvents(null);
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

  // What to show instead of the planner while there is no usable account.
  let gate = null;
  if (accountsEnabled && user === undefined) gate = <p className="hint">Checking your account.</p>;
  else if (accountsEnabled && user === null) gate = <AuthForm />;
  else if (loadError) {
    gate = (
      <p className="status-error" role="alert">
        <strong>Your saved events could not be loaded</strong>
        {loadError} Reload the page to try again. Nothing has been changed.
      </p>
    );
  } else if (user && !loaded) gate = <p className="hint">Loading your events.</p>;

  return (
    <div className="page">
      <header className="panel">
        <h1>Every deadline in your course outlines, on one calendar.</h1>
        <p className="panel-lede">
          Upload your outlines and the planner lists each class, deadline, quiz and exam it finds. It never guesses a
          date.
        </p>
        <section className="unclear" aria-labelledby="unclear-heading">
          <h2 id="unclear-heading">When an outline is unclear</h2>
          <dl>
            <div>
              <dt>&ldquo;Week 7&rdquo;</dt>
              <dd>Listed with no date, for you to fill in.</dd>
            </div>
            <div>
              <dt>&ldquo;TBA&rdquo;</dt>
              <dd>Listed with no date, so it is not forgotten.</dd>
            </div>
            <div>
              <dt>&ldquo;30 Oct&rdquo;</dt>
              <dd>Year taken from your semester dates and marked for checking.</dd>
            </div>
          </dl>
        </section>
      </header>

      <main className="work">
        <div className="work-inner">
          {user && (
            <p className="account">
              <span>{user.email}</span>
              <button type="button" className="link" onClick={() => supabase().auth.signOut()}>
                Sign out
              </button>
            </p>
          )}
          {gate || (
            <>
              <form className="form" onSubmit={onSubmit} aria-busy={loading}>
                <h2>Upload your outlines</h2>
                <div className="field">
                  <label htmlFor="files">Course outlines</label>
                  <span className="hint" id="files-hint">
                    PDF, Word or text files. Up to 10 files, 10 MB each.
                  </span>
                  <input
                    id="files"
                    type="file"
                    name="files"
                    accept=".pdf,.docx,.txt"
                    multiple
                    required
                    aria-describedby="files-hint"
                  />
                </div>
                <div className="dates">
                  <div className="field">
                    <label htmlFor="start">Semester starts</label>
                    <input id="start" type="date" name="start" required />
                  </div>
                  <div className="field">
                    <label htmlFor="end">Semester ends</label>
                    <input id="end" type="date" name="end" required />
                  </div>
                </div>
                <button className="submit" type="submit" disabled={loading}>
                  {loading ? "Finding deadlines" : "Find my deadlines"}
                </button>

                <div className="status" aria-live="polite">
                  {loading && (
                    <p className="status-loading">
                      <span className="spinner" aria-hidden="true" />
                      Reading your outlines. This can take up to a minute.
                    </p>
                  )}
                </div>
                {error && (
                  <p className="status-error" role="alert">
                    <strong>Deadlines not found yet</strong>
                    {error}
                  </p>
                )}
              </form>

              {events && (
                <section className="results" aria-labelledby="results-heading">
                  <h2 id="results-heading">{events.length === 1 ? "1 event found" : `${events.length} events found`}</h2>
                  {!accountsEnabled && (
                    <p className="save-state">
                      Accounts are not set up on this server, so these events are lost when you close the page.
                    </p>
                  )}
                  {user && (
                    <div className="save-state" aria-live="polite">
                      {saveState === "saved" && "Saved to your account."}
                      {saveState === "saving" && "Saving."}
                      {saveState === "error" && (
                        <p className="status-error" role="alert">
                          <strong>Your latest changes are not saved</strong>
                          They are still on this page. Check your connection, then{" "}
                          <button type="button" className="link" onClick={() => setRetry((n) => n + 1)}>
                            save again
                          </button>
                          .
                        </p>
                      )}
                    </div>
                  )}
                  <p className="results-summary">
                    {events.length === 0
                      ? "No classes, deadlines, quizzes or exams were found in these files. Check they are the right outlines."
                      : toCheck === 0
                        ? "Nothing needs checking. You can still change any date, time or type below."
                        : `${toCheck} to check. Fix the date if needed, then mark each one as checked.`}
                  </p>
                  {failed.length > 0 && (
                    <div className="status-error results-failed" role="alert">
                      <strong>
                        {failed.length === 1 ? "1 file was skipped" : `${failed.length} files were skipped`}
                      </strong>
                      <ul>
                        {failed.map(({ file, error: why }) => (
                          <li key={file}>
                            {/* readFileText already prefixes its messages with the file name */}
                            <b>{file}:</b> {explain(why.startsWith(`${file}: `) ? why.slice(file.length + 2) : why)}
                          </li>
                        ))}
                      </ul>
                      The events below come from your other files. Upload the skipped files again to add theirs; nothing
                      already listed is lost.
                    </div>
                  )}
                  {events.length > 0 && (
                    <>
                      <ol className="events">
                        {events.map((event, i) => (
                          <EventRow key={i} event={event} onChange={(patch) => changeEvent(i, patch)} />
                        ))}
                      </ol>
                      <div className="export">
                        <button className="submit" type="button" disabled={ready.length === 0} onClick={downloadCalendar}>
                          Download calendar file ({ready.length} {ready.length === 1 ? "event" : "events"})
                        </button>
                        <p className="hint">
                          {toCheck > 0 &&
                            `${toCheck} still to check ${toCheck === 1 ? "is" : "are"} left out until you mark ${toCheck === 1 ? "it" : "them"} as checked. `}
                          Each event reminds you 1 day and 1 hour before. Open the file to add it to your calendar.
                        </p>
                        {exportError && (
                          <p className="status-error" role="alert">
                            <strong>Calendar file not made</strong>
                            {exportError}
                          </p>
                        )}
                        <p className="switch">
                          <button type="button" className="link" onClick={removeAll}>
                            Remove all events
                          </button>
                        </p>
                      </div>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
