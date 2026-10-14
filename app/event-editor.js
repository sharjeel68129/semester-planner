"use client";
import { useEffect, useId, useRef } from "react";
import { needsReview } from "@/lib/review";
import { EVENT_TYPES } from "@/lib/schema";
import { formatDate } from "@/lib/dates";
import { CheckIcon, TYPE_LABELS } from "./views";

/**
 * The pop-up for one event: fix its date, time or type, and mark it as checked.
 * Title and course are fixed, because they are how a re-uploaded outline finds this event again.
 */
export default function EventEditor({ event, onChange, onExpand, onRemove, onClose }) {
  const id = useId();
  const dialog = useRef(null);
  const flagged = needsReview(event);

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      // A click on the dimmed area around the box lands on the dialog element itself.
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <div className="editor-box">
        <h2 id={`${id}-title`}>{event.title}</h2>
        {(event.course || event.weight !== null) && (
          <p className="hint">{[event.course, event.weight !== null && `${event.weight}% of the grade`].filter(Boolean).join(", ")}</p>
        )}

        {flagged && (
          <p className="editor-check">
            <CheckIcon />
            <span>
              <strong>Check this.</strong> {event.note || "The AI was not confident about this one."}
            </span>
          </p>
        )}
        {!flagged && !event.date && (
          <p className="editor-info">
            <strong>No date yet.</strong> {event.note || "The outline gives no date for this."}
          </p>
        )}
        {/* Worked out by code from a week number, so it only becomes the date when the student presses it. */}
        {!event.date && event.suggestedDates.length === 1 && (
          <p className="editor-suggest">
            <button type="button" className="button" onClick={() => onChange({ date: event.suggestedDates[0] })}>
              Use {formatDate(event.suggestedDates[0], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </button>
            <span className="hint">Check it against your outline first.</span>
          </p>
        )}
        {event.suggestedDates.length > 1 && (
          <p className="editor-suggest">
            <button type="button" className="button" onClick={onExpand}>
              Add {event.suggestedDates.length} weekly classes
            </button>
            <span className="hint">
              {formatDate(event.suggestedDates[0], { weekday: "long" })}s, {formatDate(event.suggestedDates[0], { day: "numeric", month: "short" })} to{" "}
              {formatDate(event.suggestedDates.at(-1), { day: "numeric", month: "short", year: "numeric" })}. You can remove single classes afterwards.
            </span>
          </p>
        )}
        {event.sourceQuote && (
          <>
            <p className="editor-label">From your outline</p>
            <blockquote className="quote">{event.sourceQuote}</blockquote>
          </>
        )}

        <div className="editor-fields">
          <div className="field">
            <label htmlFor={`${id}-date`}>Date</label>
            <input
              id={`${id}-date`}
              type="date"
              value={event.date || ""}
              onChange={(e) => onChange({ date: e.target.value || null })}
            />
            <span className="hint">{event.date ? formatDate(event.date, { weekday: "long" }) : "No date yet"}</span>
          </div>
          <div className="field">
            <label htmlFor={`${id}-time`}>Time</label>
            <input
              id={`${id}-time`}
              type="time"
              value={event.time || ""}
              onChange={(e) => onChange({ time: e.target.value || null })}
            />
            <span className="hint">Leave empty for all day</span>
          </div>
          <div className="field">
            <label htmlFor={`${id}-type`}>Type</label>
            <select id={`${id}-type`} value={event.type} onChange={(e) => onChange({ type: e.target.value })}>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="editor-actions">
          {flagged && (
            // A human has now checked it, so it no longer needs review and can go in the calendar file.
            <button
              type="button"
              className="button"
              disabled={!event.date}
              onClick={() => onChange({ ambiguous: false, confidence: 1 })}
            >
              Mark as checked
            </button>
          )}
          <button type="button" className="button button-quiet" onClick={() => dialog.current.close()}>
            Close
          </button>
          <button type="button" className="link" onClick={onRemove}>
            Remove this event
          </button>
          {flagged && !event.date && <span className="hint">Add a date before marking it as checked.</span>}
          {!flagged && (
            <span className="hint">
              {event.date ? "This event will be in your calendar file." : "Add a date to put it in your calendar file."}
            </span>
          )}
        </div>
      </div>
    </dialog>
  );
}
