// Owner: Review person. Helpers for the review table (the React table lives in app/page.js or a component).

/**
 * Events that need a human look because something about them looks wrong: flagged, or low confidence.
 * Having no date is not a reason on its own; such an event is listed as "no date yet" (see canExport).
 */
export function needsReview(event, threshold = 0.7) {
  return event.ambiguous || event.confidence < threshold;
}

/** Only a dated event that needs no review goes in the calendar file. */
export function canExport(event) {
  return event.date !== null && !needsReview(event);
}

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Two events are the same item if course and title match. Type is left out: the model can relabel a quiz as a deadline. */
const keyOf = (event) => `${squash(event.course)}|${squash(event.title)}`;

const when = (event) => (event.time ? `${event.date} ${event.time}` : event.date);

const addNote = (event, text) => (event.note.includes(text) ? event.note : `${event.note} ${text}`.trim());

/**
 * Merge a re-uploaded outline (mid-semester updates) into the list the student already has, without duplicates.
 * Nothing is dropped and no date the student already has is overwritten: a disagreement is flagged for review.
 * Each old event is matched at most once, so two items with the same name in one outline stay two items.
 * With `partial`, the new events are only some of an outline (events the student put back), so an old event
 * missing from them is not a sign it was cancelled.
 */
export function mergeEvents(oldEvents, newEvents, { partial = false } = {}) {
  const merged = [...oldEvents];
  const matched = new Set();
  const settled = new Set();
  let added = [];

  for (const fresh of newEvents) {
    const i = merged.findIndex((old, index) => !matched.has(index) && keyOf(old) === keyOf(fresh));
    if (i === -1) {
      added.push(fresh);
      continue;
    }
    matched.add(i);
    const old = merged[i];
    if (fresh.choice) settled.add(fresh.choice);

    if (old.date === null) {
      // No date was set, so take the newer reading (date, suggestion, note); keep the student's type and section choice.
      merged[i] = { ...fresh, type: old.type, choice: old.choice };
      continue;
    }
    if (fresh.date === null || (old.date === fresh.date && old.time === fresh.time)) continue; // nothing new: keep the student's version
    merged[i] = {
      ...old,
      ambiguous: true,
      note: addNote(old, `The re-uploaded outline says ${when(fresh)}, not ${when(old)}; check which is right.`),
    };
  }

  // The student already has a section from this group, so they chose it: the other sections do not come back.
  added = added.filter((fresh) => !fresh.choice || !settled.has(fresh.choice));

  // An item missing from a new outline for the same course may have been cancelled or renamed.
  // A weekly class the student expanded into dated classes shares one name, and the new outline has it once:
  // the other occurrences are not missing.
  const freshCourses = new Set(newEvents.map((event) => squash(event.course)).filter(Boolean));
  const freshKeys = new Set(newEvents.map(keyOf));
  // An event with no source quote was typed in by the student (a class time), so no outline can be missing it.
  oldEvents.forEach((old, index) => {
    if (partial || matched.has(index) || freshKeys.has(keyOf(old)) || !freshCourses.has(squash(old.course)) || !old.sourceQuote) return;
    merged[index] = {
      ...old,
      ambiguous: true,
      note: addNote(old, "Not found in the re-uploaded outline; check it has not been cancelled or renamed."),
    };
  });

  return [...merged, ...added];
}

/**
 * Replace a weekly class that has suggested dates with one dated class per date. The student asked for this, so the
 * dates count as accepted. A class that already had a date keeps it, even if it is not one of the suggestions.
 */
export function expandWeekly(events, index) {
  const event = events[index];
  const dates = [...new Set([event.date, ...event.suggestedDates].filter(Boolean))].sort();
  const dated = dates.map((date) => ({ ...event, date, suggestedDates: [] }));
  return [...events.slice(0, index), ...dated, ...events.slice(index + 1)];
}

/**
 * Groups of alternative sections still waiting for the student to pick one:
 * [{ choice, options: [{ title, time, firstDate }] }], one option per section title.
 */
export function openChoices(events) {
  const groups = new Map();
  for (const event of events) {
    if (!event.choice) continue;
    if (!groups.has(event.choice)) groups.set(event.choice, new Map());
    const options = groups.get(event.choice);
    if (!options.has(event.title)) {
      options.set(event.title, { title: event.title, time: event.time, firstDate: event.date || event.suggestedDates[0] || null });
    }
  }
  return [...groups].filter(([, options]) => options.size > 1).map(([choice, options]) => ({ choice, options: [...options.values()] }));
}

/** Keep the chosen section of a group and drop the others. `title` null keeps them all. Either way the question is settled. */
export function chooseSection(events, choice, title) {
  return events
    .filter((event) => event.choice !== choice || title === null || event.title === title)
    .map((event) => (event.choice === choice ? { ...event, choice: "" } : event));
}

/** One name per course however it is written: the subject code if there is one ("AMA1702"), otherwise the name. */
export function courseKey(course) {
  const match = String(course || "").toUpperCase().match(/\b([A-Z]{2,5})[\s-]?(\d{3,4}[A-Z0-9]{0,3})\b/);
  return match ? match[1] + match[2] : squash(course);
}

/**
 * The student accepts every suggested date at once: an event with one suggestion takes it, and a weekly class
 * becomes one dated class per teaching week. Left alone: anything flagged for checking (its suggestion may be
 * the thing that is wrong), and sections still waiting for the student to choose one, so unwanted sections are
 * not spread over the calendar. Returns { events, accepted } where `accepted` counts the events changed.
 */
export function acceptSuggestions(events) {
  const waiting = new Set(openChoices(events).map(({ choice }) => choice));
  const result = [];
  let accepted = 0;
  for (const event of events) {
    const skip = needsReview(event) || (event.choice && waiting.has(event.choice)) || event.suggestedDates.length === 0;
    if (skip) result.push(event);
    else if (event.type === "class" && (event.suggestedDates.length > 1 || event.date)) {
      result.push(...expandWeekly([event], 0));
      accepted++;
    } else if (!event.date) {
      result.push({ ...event, date: event.suggestedDates[0], suggestedDates: [] });
      accepted++;
    } else result.push(event);
  }
  return { events: result, accepted };
}

/**
 * Two files for the same course in one upload, such as PolyU's short subject form and the lecturer's detailed
 * outline, would put the same marks on the calendar twice ("Examination" and "Final Exam"). For each course that
 * more than one file gives a grade breakdown for, the file with the most breakdown rows is kept; the other files'
 * events for that course are left out, except classes, which a breakdown says nothing about. If two files have
 * the same number of rows, neither is preferred and nothing is left out.
 * results: [{ file, events, checks }] per file, checks as from lib/assess.js.
 * Returns { events, checks, leftOut: [{ course, kept, files, events }] }; `leftOut` is shown to the student,
 * who can put the events back, so nothing is dropped silently.
 */
export function preferDetailed(results) {
  const byCourse = new Map();
  for (const { file, checks } of results) {
    for (const check of checks) {
      if (check.total === null || !check.course) continue;
      const key = courseKey(check.course);
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key).push({ file, rows: check.rows.length, course: check.course });
    }
  }
  const dropFrom = new Map(); // course key -> files whose events for it are left out
  const leftOut = [];
  for (const [key, entries] of byCourse) {
    const files = [...new Set(entries.map((entry) => entry.file))];
    if (files.length < 2) continue;
    const most = Math.max(...entries.map((entry) => entry.rows));
    const best = entries.filter((entry) => entry.rows === most);
    if (new Set(best.map((entry) => entry.file)).size > 1) continue;
    dropFrom.set(key, new Set(files.filter((file) => file !== best[0].file)));
    leftOut.push({ course: best[0].course, kept: best[0].file, files: [...dropFrom.get(key)], events: [] });
  }

  const events = [];
  const checks = [];
  for (const { file, events: found, checks: fileChecks } of results) {
    for (const event of found) {
      const key = courseKey(event.course);
      if (event.type !== "class" && dropFrom.get(key)?.has(file)) leftOut.find((item) => courseKey(item.course) === key).events.push(event);
      else events.push(event);
    }
    for (const check of fileChecks) if (!dropFrom.get(courseKey(check.course))?.has(file)) checks.push({ file, ...check });
  }
  return { events, checks, leftOut };
}

/**
 * Courses that have deadlines, quizzes or exams but no class at all, so the student can be asked when they meet.
 * `skip` is the list of course keys the student said have no classes. Returns [{ key, course }].
 */
export function coursesWithoutClass(events, skip = []) {
  const withClass = new Set(events.filter((event) => event.type === "class").map((event) => courseKey(event.course)));
  const found = new Map();
  for (const event of events) {
    const key = courseKey(event.course);
    if (!key || withClass.has(key) || skip.includes(key) || found.has(key)) continue;
    found.set(key, { key, course: event.course });
  }
  return [...found.values()];
}

/** "1-7 and 9-13" for [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13]. */
export function describeNumbers(numbers) {
  const runs = [];
  for (const n of numbers) {
    const last = runs.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  const parts = runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] || "";
}

/**
 * Numbered items with a number missing in the middle: "Exercise 1-7 and 9-13" has no Exercise 8. It may be a
 * mistake in the outline or in the reading, or on purpose (a test that week), so the student is asked; nothing is
 * added by itself. Only a series of three or more with at most two gaps counts; a title like "Lab S01" also ends in
 * a number, so sections are left out. `ignored` holds "<course key>|<name>|<number>" the student said are not missing.
 * Returns [{ key, course, stem, type, numbers, missing }].
 */
export function numberGaps(events, ignored = []) {
  const groups = new Map();
  for (const event of events) {
    if (event.choice) continue;
    const match = String(event.title).trim().match(/^(.*?[A-Za-z.])\s*#?\s*(\d{1,2})$/);
    if (!match) continue;
    const stem = match[1].trim();
    const key = `${courseKey(event.course)}|${squash(stem)}`;
    if (!groups.has(key)) groups.set(key, { key, course: event.course, stem, type: event.type, numbers: new Set() });
    groups.get(key).numbers.add(Number(match[2]));
  }
  const gaps = [];
  for (const group of groups.values()) {
    const numbers = [...group.numbers].sort((a, b) => a - b);
    if (numbers.length < 3) continue;
    const missing = [];
    for (let n = numbers[0] + 1; n < numbers.at(-1); n++) {
      if (!group.numbers.has(n) && !ignored.includes(`${group.key}|${n}`)) missing.push(n);
    }
    const holes = numbers.at(-1) - numbers[0] + 1 - numbers.length;
    if (missing.length === 0 || holes > 2) continue;
    gaps.push({ ...group, numbers, missing });
  }
  return gaps;
}
