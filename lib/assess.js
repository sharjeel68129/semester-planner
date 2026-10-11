// Completeness check: do the assessments found add up to the outline's own 100%?
// The model copies the grade breakdown; the adding up and matching is done here.

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The extracted events a breakdown row covers: named by the row, and of the same course. */
export function coveredBy(row, events) {
  const key = squash(row.course);
  const titles = new Set(row.eventTitles.map(squash));
  return events.filter(
    (event) => titles.has(squash(event.title)) && (!key || !event.course || squash(event.course) === key),
  );
}

/**
 * rows: [{ course, name, weight, eventTitles }] copied from the outline's grade breakdown.
 * Returns one result per course: { course, total, complete, rows: [{ name, weight, events }] }, where `events`
 * is how many extracted events that row covers. `complete` means the rows add up to 100 and each has an event.
 * It shows every graded component was found, not every item inside one, and says nothing about dates.
 */
export function checkAssessments(rows, events) {
  const courses = new Map();
  for (const row of rows) {
    const key = squash(row.course);
    if (!courses.has(key)) courses.set(key, { course: row.course, rows: [] });
    courses.get(key).rows.push({ name: row.name, weight: row.weight, events: coveredBy(row, events).length });
  }
  return [...courses.values()].map(({ course, rows: found }) => {
    // Rounded so 33.3 + 33.3 + 33.4 is not thrown off by floating point.
    const total = Math.round(found.reduce((sum, row) => sum + row.weight, 0) * 100) / 100;
    return { course, total, complete: total === 100 && found.every((row) => row.events > 0), rows: found };
  });
}

/** How many things are wrong across all courses; used to tell whether a second attempt did better. */
export function problemCount(checks) {
  return checks.reduce((n, check) => n + (check.total === 100 ? 0 : 1) + check.rows.filter((row) => row.events === 0).length, 0);
}

/** The problems in plain words, for the follow-up request to the model. */
export function describeProblems(checks) {
  const lines = [];
  for (const check of checks) {
    const name = check.course || "The course";
    if (check.total !== 100) lines.push(`${name}: the assessment rows add up to ${check.total}, not 100.`);
    for (const row of check.rows) {
      if (row.events === 0) lines.push(`${name}: the row "${row.name}" (${row.weight}) has no matching event.`);
    }
  }
  return lines;
}
