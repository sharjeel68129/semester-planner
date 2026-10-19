"use client";
import { useEffect, useRef } from "react";
import { needsReview } from "@/lib/review";
import { formatDate, monthGrid, today, weekDays } from "@/lib/dates";

export const TYPE_LABELS = { class: "Class", deadline: "Deadline", quiz: "Quiz", exam: "Exam" };

const HOUR_PX = 48;
const MAX_PER_DAY = 3;

export function CheckIcon() {
  return (
    <svg className="check-icon" width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 1.5 17 16H1L9 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 7v4M9 13.2v.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Events keep their position in the saved list, because that index is how an edit finds its event. */
const indexed = (events) => events.map((event, index) => ({ event, index }));
const byTime = (a, b) => (a.event.time || "").localeCompare(b.event.time || "");

/**
 * Events by day. With `withSuggested`, an event also appears (marked `suggested`) on each date worked out for it
 * but not yet accepted, so the calendar shows where it will probably fall. The list view leaves these out.
 */
function groupByDate(events, withSuggested = false) {
  const days = new Map();
  const add = (date, item) => {
    if (!days.has(date)) days.set(date, []);
    days.get(date).push(item);
  };
  for (const item of indexed(events)) {
    if (item.event.date) add(item.event.date, item);
    if (!withSuggested) continue;
    for (const date of item.event.suggestedDates) if (date !== item.event.date) add(date, { ...item, suggested: true });
  }
  for (const items of days.values()) items.sort(byTime);
  return days;
}

/** A small clickable event, used in the month grid and the all-day row. Opens the editor. */
function Chip({ event, index, suggested = false, onOpen, style }) {
  const flagged = needsReview(event);
  const name = `${event.time ? `${event.time} ` : ""}${event.title}`;
  return (
    <button
      type="button"
      className={`chip chip-${event.type}${suggested ? " chip-suggested" : ""}`}
      style={style}
      title={`${name}${event.course ? `, ${event.course}` : ""}${suggested ? " (suggested date, not yet accepted)" : ""}`}
      onClick={() => onOpen(index)}
    >
      {flagged && <CheckIcon />}
      <span>{name}</span>
      {flagged && <span className="sr-only"> (needs checking)</span>}
      {suggested && <span className="sr-only"> (suggested date)</span>}
    </button>
  );
}

// ---- Task list by date ----

/** The first sentence of a note, short enough for one line of a row. */
function firstSentence(note) {
  const sentence = String(note || "").split(/(?<=[.!?])\s/)[0].trim();
  return sentence.length > 110 ? `${sentence.slice(0, 107)}...` : sentence;
}

const shortDay = (iso) => formatDate(iso, { weekday: "short", day: "numeric", month: "short" });

/**
 * One event as a compact row: type badge, title, what it is worth and when, one line saying why it needs a look
 * (or what the outline says about when), and on the right a suggested date if there is one.
 */
function ListRow({ event, index, onOpen, showCourse = true }) {
  const flagged = needsReview(event);
  const meta = [showCourse && event.course, event.weight !== null && `${event.weight}%`, event.time].filter(Boolean);
  const why = firstSentence(event.note);
  const suggested = event.suggestedDates;
  return (
    <li>
      <button type="button" className={flagged ? "task task-flagged" : "task"} onClick={() => onOpen(index)}>
        <span className={`chip chip-${event.type} task-type`}>{TYPE_LABELS[event.type]}</span>
        <span className="task-body">
          <span className="task-head">
            <span className="task-title">{event.title}</span>
            {meta.length > 0 && <span className="task-meta">{meta.join(" · ")}</span>}
          </span>
          {flagged && (
            <span className="task-why">
              <CheckIcon /> {why || "The AI was not confident about this one."}
            </span>
          )}
          {!flagged && !event.date && why && <span className="task-note">{why}</span>}
        </span>
        {/* Not a warning: a date was worked out from the week number and waits for the student to accept it. */}
        {!flagged && (!event.date || suggested.length > 1) && suggested.length > 0 && (
          <span className="task-tag">
            {suggested.length > 1 ? `Weekly from ${shortDay(suggested[0])}` : `Suggested ${shortDay(suggested[0])}`}
          </span>
        )}
        {flagged && <span className="sr-only"> (needs checking)</span>}
      </button>
    </li>
  );
}

/** Undated events grouped by course, in the order they were found. */
function byCourse(items) {
  const groups = new Map();
  for (const item of items) {
    const name = item.event.course || "No course given";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }
  return [...groups];
}

export function ListView({ events, onOpen }) {
  const undated = indexed(events).filter(({ event }) => !event.date);
  const days = [...groupByDate(events)].sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="list">
      {undated.length > 0 && (
        <section>
          <h3>No date yet</h3>
          <p className="hint">Open one to add a date or accept the suggested one. Flagged ones need a look first.</p>
          <div className="list-cards">
            {byCourse(undated).map(([course, items]) => (
              <div key={course} className="list-card">
                <h4>
                  {course} <span className="list-count">{items.length}</span>
                </h4>
                <ul>
                  {items.map((item) => (
                    <ListRow key={item.index} {...item} onOpen={onOpen} showCourse={false} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {days.length > 0 && (
        <section>
          <h3>By date</h3>
          <div className="list-cards">
            {days.map(([date, items]) => (
              <div key={date} className={date === today() ? "list-card is-today" : "list-card"}>
                <h4>
                  <time dateTime={date}>{formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</time>
                </h4>
                <ul>
                  {items.map((item) => (
                    <ListRow key={item.index} {...item} onOpen={onOpen} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---- Month ----

export function MonthView({ events, cursor, weekStart, onOpen, onShowWeek }) {
  const days = groupByDate(events, true);
  const grid = monthGrid(cursor, weekStart);
  const month = cursor.slice(0, 7);
  const now = today();
  return (
    <div className="month">
      {grid.slice(0, 7).map((day) => (
        <div key={day} className="month-weekday">
          {formatDate(day, { weekday: "short" })}
        </div>
      ))}
      {grid.map((day) => {
        const items = days.get(day) || [];
        const classes = ["month-cell", day.slice(0, 7) !== month && "month-outside", day === now && "is-today"];
        return (
          <div key={day} className={classes.filter(Boolean).join(" ")}>
            <time dateTime={day} aria-label={formatDate(day, { weekday: "long", day: "numeric", month: "long" })}>
              {Number(day.slice(8))}
            </time>
            {items.slice(0, MAX_PER_DAY).map((item) => (
              <Chip key={`${item.index}${item.suggested ? "s" : ""}`} {...item} onOpen={onOpen} />
            ))}
            {items.length > MAX_PER_DAY && (
              <button type="button" className="month-more" onClick={() => onShowWeek(day)}>
                {items.length - MAX_PER_DAY} more
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Week (time grid) ----

const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
// Same assumption as the .ics export: the Event shape has no end time.
const lengthOf = (event) => (event.type === "deadline" ? 15 : 60);

/**
 * Put overlapping events side by side. Events that overlap form a group; within it each event takes
 * the first column that is free at its start time, and the group shares the day's width.
 */
function layOut(items) {
  const placed = [];
  let group = [];
  let columnEnds = [];
  let groupEnd = -1;
  const closeGroup = () => group.forEach((item) => (item.columns = columnEnds.length));
  for (const item of items) {
    const start = minutesOf(item.event.time);
    // Short events are drawn at least half an hour tall, so reserve that much.
    const end = start + Math.max(lengthOf(item.event), 30);
    if (start >= groupEnd) {
      closeGroup();
      group = [];
      columnEnds = [];
    }
    let column = columnEnds.findIndex((free) => free <= start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = end;
    groupEnd = Math.max(groupEnd, end);
    const next = { ...item, start, column };
    group.push(next);
    placed.push(next);
  }
  closeGroup();
  return placed;
}

export function WeekView({ events, cursor, weekStart, onOpen }) {
  const scroller = useRef(null);
  const days = groupByDate(events, true);
  const week = weekDays(cursor, weekStart);
  const now = today();

  // Open on the working day, not midnight.
  useEffect(() => {
    scroller.current.scrollTop = 8 * HOUR_PX;
  }, []);

  return (
    <div className="week" ref={scroller} tabIndex={0} role="group" aria-label="Week, by hour">
      <div className="week-inner">
        <div className="week-top">
          <div className="week-row">
            <div />
            {week.map((day) => (
              <div key={day} className={day === now ? "week-dayname is-today" : "week-dayname"}>
                <time dateTime={day}>
                  {formatDate(day, { weekday: "short" })} <b>{Number(day.slice(8))}</b>
                </time>
              </div>
            ))}
          </div>
          <div className="week-row week-allday">
            <div className="week-label">All day</div>
            {week.map((day) => (
              <div key={day}>
                {(days.get(day) || [])
                  .filter(({ event }) => !event.time)
                  .map((item) => (
                    <Chip key={`${item.index}${item.suggested ? "s" : ""}`} {...item} onOpen={onOpen} />
                  ))}
              </div>
            ))}
          </div>
        </div>
        <div className="week-row week-grid" style={{ height: 24 * HOUR_PX }}>
          <div>
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="week-label week-hour" style={{ height: HOUR_PX }}>
                {hour > 0 && `${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          {week.map((day) => (
            <div key={day} className="week-day" style={{ backgroundSize: `100% ${HOUR_PX}px` }}>
              {layOut((days.get(day) || []).filter(({ event }) => event.time)).map(({ start, column, columns, ...item }) => {
                const height = Math.max((lengthOf(item.event) / 60) * HOUR_PX, HOUR_PX / 2);
                return (
                  <Chip
                    key={`${item.index}${item.suggested ? "s" : ""}`}
                    {...item}
                    onOpen={onOpen}
                    style={{
                      // A 23:59 deadline is pulled up so it stays inside the day.
                      top: Math.min((start / 60) * HOUR_PX, 24 * HOUR_PX - height),
                      height,
                      left: `${(column / columns) * 100}%`,
                      width: `${100 / columns}%`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The label above the calendar: which month or week is showing. */
export function periodLabel(view, cursor, count, weekStart) {
  if (view === "month") return formatDate(cursor, { month: "long", year: "numeric" });
  if (view === "week") {
    const week = weekDays(cursor, weekStart);
    return `${formatDate(week[0], { day: "numeric", month: "short" })} to ${formatDate(week[6], { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return count === 1 ? "1 event" : `${count} events`;
}
