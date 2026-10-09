// Owner: Review person. Helpers for the review table (the React table lives in app/page.js or a component).

/** Events that need a human look: ambiguous, no date, or low confidence. */
export function needsReview(event, threshold = 0.7) {
  return event.ambiguous || event.date === null || event.confidence < threshold;
}

/** TODO: merge a re-uploaded outline (mid-semester updates) without duplicates. */
export function mergeEvents(oldEvents, newEvents) {
  return [...oldEvents, ...newEvents];
}
