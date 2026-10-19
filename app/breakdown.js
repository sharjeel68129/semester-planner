"use client";

const percent = (n) => `${Math.round(n * 100) / 100}%`;

/** What the 100% check found, in a few words. Rule 7: nothing is invented to fill a gap, so a gap is said plainly. */
function status(total) {
  if (total === null) return "No grade breakdown was found in the outline.";
  if (total === 100) return "";
  if (total < 100) return `Only ${percent(total)} was found: ${percent(100 - total)} is missing. Check the outline's assessment section.`;
  return `The parts add up to ${percent(total)}, over 100%: something may be counted twice.`;
}

/**
 * Each course's grade breakdown as read from its outline, largest part first: one bar per part, its length the
 * part's share of the course mark. Every value is written next to its bar, so the bars need no key.
 * `breakdowns` is settings.breakdowns; `checks` are the 100% checks from the upload just made (lib/assess.js),
 * used only to say which parts have no event yet.
 */
export default function Breakdown({ breakdowns, checks }) {
  const courses = Object.entries(breakdowns);
  if (courses.length === 0) return null;
  return (
    <section className="sidebar-section" aria-labelledby="breakdown-title">
      <h2 id="breakdown-title">Grade breakdown</h2>
      {courses.map(([key, { course, total, rows, reference }]) => {
        const fresh = checks.find((check) => check.course === course);
        const noEvent = (fresh?.rows || []).filter((row) => row.events === 0).map((row) => `${row.name} (${percent(row.weight)})`);
        const ranked = [...rows].sort((a, b) => b.weight - a.weight);
        const problem = status(total);
        return (
          <div key={key} className={problem ? "breakdown breakdown-gap" : "breakdown"}>
            <h3>
              <span>{course || key}</span>
              <span className="breakdown-total">{total === null ? "" : total === 100 ? "100%" : `${percent(total)} found`}</span>
            </h3>
            {ranked.length > 0 && (
              <ul className="breakdown-rows">
                {ranked.map((row, i) => (
                  <li key={`${row.name}-${i}`} title={`${row.name}: ${percent(row.weight)} of the course mark`}>
                    <span className="breakdown-name">{row.name}</span>
                    <span className="breakdown-value">{percent(row.weight)}</span>
                    <span className="breakdown-track" aria-hidden="true">
                      <span className="breakdown-bar" style={{ width: `${Math.min(row.weight, 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {problem && <p className="breakdown-note">{problem}</p>}
            {noEvent.length > 0 && <p className="breakdown-note">No event was found for {noEvent.join(", ")}.</p>}
            {/* A comparison with PolyU's published split for the course. Information only: the outline wins. */}
            {reference && (
              <p className="breakdown-reference">
                {reference.message}
                {reference.sourceUrl && (
                  <>
                    {" "}
                    <a className="link" href={reference.sourceUrl} target="_blank" rel="noreferrer">
                      Open the form
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
