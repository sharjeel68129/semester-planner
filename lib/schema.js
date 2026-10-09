/**
 * Shared contract. Every module reads/writes Event objects. Do not change without telling the leader.
 *
 * Event = {
 *   title: string,
 *   course: string,
 *   type: "class" | "deadline" | "quiz" | "exam",
 *   date: string | null,        // ISO "YYYY-MM-DD", null if unknown
 *   time: string | null,        // "HH:MM" 24h, null if unknown
 *   confidence: number,         // 0-1, model's own estimate
 *   sourceQuote: string,        // exact text from the outline that justifies this event
 *   ambiguous: boolean,         // true -> needs human review
 *   note: string                // why it is ambiguous / extra detail
 * }
 */
export const EVENT_TYPES = ["class", "deadline", "quiz", "exam"];

export function makeEvent(partial) {
  return {
    title: "",
    course: "",
    type: "deadline",
    date: null,
    time: null,
    confidence: 1,
    sourceQuote: "",
    ambiguous: false,
    note: "",
    ...partial,
  };
}
