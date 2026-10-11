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
  const added = [];

  for (const fresh of newEvents) {
    const i = merged.findIndex((old, index) => !matched.has(index) && keyOf(old) === keyOf(fresh));
    if (i === -1) {
      added.push(fresh);
      continue;
    }
    matched.add(i);
    const old = merged[i];

    if (old.date === null) {
      merged[i] = { ...fresh, type: old.type }; // no date was set, so take the newer reading (date, suggestion, note); keep the student's type
      continue;
    }
    if (fresh.date === null || (old.date === fresh.date && old.time === fresh.time)) continue; // nothing new: keep the student's version
    merged[i] = {
      ...old,
      ambiguous: true,
      note: addNote(old, `The re-uploaded outline says ${when(fresh)}, not ${when(old)}; check which is right.`),
    };
  }

  // An item missing from a new outline for the same course may have been cancelled or renamed.
  const freshCourses = new Set(newEvents.map((event) => squash(event.course)).filter(Boolean));
  oldEvents.forEach((old, index) => {
    if (matched.has(index) || !freshCourses.has(squash(old.course))) return;
    merged[index] = {
      ...old,
      ambiguous: true,
      note: addNote(old, "Not found in the re-uploaded outline; check it has not been cancelled or renamed."),
    };
  });

  return [...merged, ...added];
}
