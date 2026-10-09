"use client";
import { useEffect, useRef } from "react";
import { needsReview } from "@/lib/review";
import { formatDate, monthGrid, today, weekDays } from "@/lib/dates";

export const TYPE_LABELS = { class: "Class", deadline: "Deadline", quiz: "Quiz", exam: "Exam" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

function groupByDate(events) {
  const days = new Map();
  for (const item of indexed(events)) {
    if (!item.event.date) continue;
    if (!days.has(item.event.date)) days.set(item.event.date, []);
    days.get(item.event.date).push(item);
  }
  for (const items of days.values()) items.sort(byTime);
  return days;
}

/** A small clickable event, used in the month grid and the all-day row. Opens the editor. */
function Chip({ event, index, onOpen, style }) {
  const flagged = needsReview(event);
  const name = `${event.time ? `${event.time} ` : ""}${event.title}`;
  return (
    <button
      type="button"
      className={`chip chip-${event.type}`}
      style={style}
      title={`${name}${event.course ? `, ${event.course}` : ""}`}
      onClick={() => onOpen(index)}
    >
      {flagged && <CheckIcon />}
      <span>{name}</span>
      {flagged && <span className="sr-only"> (needs checking)</span>}
    </button>
  );
}

// ---- Task list by date ----

function ListRow({ event, index, onOpen }) {
  const flagged = needsReview(event);
  return (
    <li>
      <button type="button" className={flagged ? "task task-flagged" : "task"} onClick={() => onOpen(index)}>
        <span className="task-time">{event.time || (event.date ? "All day" : "")}</span>
        <span className="task-body">
          <span className="task-title">{event.title}</span>
          <span className="task-meta">{[TYPE_LABELS[event.type], event.course].filter(Boolean).join(", ")}</span>
        </span>
        {flagged && (
          <span className="task-check">
            <CheckIcon /> Check
          </span>
        )}
      </button>
    </li>
  );
}

export function ListView({ events, onOpen }) {
  const undated = indexed(events).filter(({ event }) => !event.date);
  const days = [...groupByDate(events)].sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="list">
      {undated.length > 0 && (
        <section>
          <h3>No date yet</h3>
          <p className="hint">Open each one and add a date to put it on the calendar.</p>
          <ul>
            {undated.map((item) => (
              <ListRow key={item.index} {...item} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      )}
      {days.map(([date, items]) => (
        <section key={date}>
          <h3>{formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
          <ul>
            {items.map((item) => (
              <ListRow key={item.index} {...item} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---- Month ----

export function MonthView({ events, cursor, onOpen, onShowWeek }) {
  const days = groupByDate(events);
  const month = cursor.slice(0, 7);
  const now = today();
  return (
    <div className="month">
      {WEEKDAYS.map((name) => (
        <div key={name} className="month-weekday">
          {name}
        </div>
      ))}
      {monthGrid(cursor).map((day) => {
        const items = days.get(day) || [];
        const classes = ["month-cell", day.slice(0, 7) !== month && "month-outside", day === now && "is-today"];
        return (
          <div key={day} className={classes.filter(Boolean).join(" ")}>
            <time dateTime={day} aria-label={formatDate(day, { weekday: "long", day: "numeric", month: "long" })}>
              {Number(day.slice(8))}
            </time>
            {items.slice(0, MAX_PER_DAY).map((item) => (
              <Chip key={item.index} {...item} onOpen={onOpen} />
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

export function WeekView({ events, cursor, onOpen }) {
  const scroller = useRef(null);
  const days = groupByDate(events);
  const week = weekDays(cursor);
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
                    <Chip key={item.index} {...item} onOpen={onOpen} />
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
                    key={item.index}
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
export function periodLabel(view, cursor, count) {
  if (view === "month") return formatDate(cursor, { month: "long", year: "numeric" });
  if (view === "week") {
    const week = weekDays(cursor);
    return `${formatDate(week[0], { day: "numeric", month: "short" })} to ${formatDate(week[6], { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return count === 1 ? "1 event" : `${count} events`;
}
