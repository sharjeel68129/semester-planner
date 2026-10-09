// Owner: Evaluation person. Score extraction against hand-labelled truth in data/samples.

const words = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9]+/g) || []);

/** Share of words two titles have in common (0 to 1), so "Assignment 1" still matches "Assignment 1: Essay". */
function titleOverlap(a, b) {
  const x = words(a);
  const y = words(b);
  const shared = [...x].filter((w) => y.has(w)).length;
  const total = new Set([...x, ...y]).size;
  return total === 0 ? 0 : shared / total;
}

/** Only a clash counts: a truth file or an outline that leaves the course out still matches. */
const sameCourse = (a, b) => !a.course || !b.course || titleOverlap(a.course, b.course) > 0;

/**
 * Compare extracted events with a hand-labelled truth list. Returns { precision, recall, missed, wrong }.
 *
 * A predicted event is paired with the truth event whose title it shares most words with (at least half),
 * each used once. The pair is correct only if date and time are identical, where null must equal null:
 * guessing a date for a "TBA" item is as wrong as getting a real date wrong.
 *
 * precision = correct / predicted, recall = correct / truth (1 when there is nothing to find or nothing claimed).
 * missed = truth events with no predicted partner. wrong = predicted events that are invented or have the wrong date/time.
 */
export function score(predicted, truth, minOverlap = 0.5) {
  const pairs = [];
  truth.forEach((t, ti) =>
    predicted.forEach((p, pi) => {
      const overlap = titleOverlap(p.title, t.title);
      if (overlap >= minOverlap && sameCourse(p, t)) pairs.push({ ti, pi, overlap });
    })
  );
  // Best title matches first; an exact date agreement breaks ties so a duplicate does not steal the pairing.
  const agrees = ({ ti, pi }) => predicted[pi].date === truth[ti].date && predicted[pi].time === truth[ti].time;
  pairs.sort((a, b) => b.overlap - a.overlap || agrees(b) - agrees(a));

  const truthUsed = new Set();
  const predictedUsed = new Set();
  let correct = 0;
  const wrong = [];
  for (const pair of pairs) {
    if (truthUsed.has(pair.ti) || predictedUsed.has(pair.pi)) continue;
    truthUsed.add(pair.ti);
    predictedUsed.add(pair.pi);
    if (agrees(pair)) correct++;
    else wrong.push(predicted[pair.pi]);
  }
  predicted.forEach((p, pi) => {
    if (!predictedUsed.has(pi)) wrong.push(p);
  });

  return {
    precision: predicted.length === 0 ? 1 : correct / predicted.length,
    recall: truth.length === 0 ? 1 : correct / truth.length,
    missed: truth.filter((_, ti) => !truthUsed.has(ti)),
    wrong,
  };
}
