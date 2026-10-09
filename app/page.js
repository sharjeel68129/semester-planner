"use client";
import { useState } from "react";
import { needsReview } from "@/lib/review";

const TYPE_LABELS = { class: "Class", deadline: "Deadline", quiz: "Quiz", exam: "Exam" };

/** "2026-10-30" -> "Fri 30 Oct 2026". Parsed as UTC so the day never shifts with the viewer's timezone. */
function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Turn a server error into something a student can act on. */
function explain(message) {
  if (/\((429|503)\)/.test(message)) {
    return "The AI service is busy right now. Wait a minute, then press the button again.";
  }
  return message || "Something went wrong. Try again.";
}

function EventRow({ event }) {
  const flagged = needsReview(event);
  return (
    <li className={flagged ? "event event-flagged" : "event"}>
      <p className="event-when">
        {event.date ? formatDate(event.date) : "No date yet"}
        {event.time && <span>{event.time}</span>}
      </p>
      <div>
        <p className="event-title">{event.title}</p>
        <p className="event-meta">{[TYPE_LABELS[event.type], event.course].filter(Boolean).join(", ")}</p>
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
      </div>
    </li>
  );
}

export default function Home() {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/extract", { method: "POST", body: new FormData(e.target) });
      const data = await res.json();
      if (!res.ok) return setError(explain(data.error));
      setEvents(data.events);
      setFailed(data.failed || []);
    } catch {
      setError("Could not reach the server. Check your connection, then try again.");
    } finally {
      setLoading(false);
    }
  }

  const toCheck = events ? events.filter((event) => needsReview(event)).length : 0;

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
              <p className="results-summary">
                {events.length === 0
                  ? "No classes, deadlines, quizzes or exams were found in these files. Check they are the right outlines."
                  : toCheck === 0
                    ? "Nothing needs checking."
                    : `${toCheck} to check before you rely on them. They are marked below.`}
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
                  The events below come from your other files. To include the skipped ones, upload all your files
                  again.
                </div>
              )}
              {/* TODO (Review person): make these rows editable; needsReview() rows are already highlighted */}
              {/* TODO (Calendar person): "Download .ics" button using toIcs() */}
              {events.length > 0 && (
                <ol className="events">
                  {events.map((event, i) => (
                    <EventRow key={i} event={event} />
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
