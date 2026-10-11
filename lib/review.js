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
 */
export function mergeEvents(oldEvents, newEvents) {
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
  oldEvents.forEach((old, index) => {
    if (matched.has(index) || freshKeys.has(keyOf(old)) || !freshCourses.has(squash(old.course))) return;
    merged[index] = {
      ...old,
      ambiguous: true,
      note: addNote(old, "Not found in the re-uploaded outline; check it has not been cancelled or renamed."),
    };
  });

  return [...merged, ...added];
}

/** Replace a weekly class that has suggested dates with one dated class per date. The student asked for this, so the dates count as accepted. */
export function expandWeekly(events, index) {
  const event = events[index];
  const dated = event.suggestedDates.map((date) => ({ ...event, date, suggestedDates: [] }));
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
