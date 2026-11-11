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
 *   note: string,               // why it is ambiguous / extra detail
 *   suggestedDates: string[],   // ISO dates worked out by code from a week number; never used until the student accepts one
 *   choice: string,             // names an either/or group (e.g. "COMP1010 Lab"); "" for everything else
 *   weight: number | null,      // percent of the course grade, only if the outline states it for this one item
 *   flags: string[],            // codes from lib/weeks.js FLAGS, e.g. "NEEDS_CLASS_TIME"; each is shown next to the event
 *   endDate: string | null,     // last day of a span ("sometime in Week 12", the exam period); the span starts at the suggestion
 *   status: "" | "cancelled"    // "cancelled": a session that falls on a public holiday; shown greyed, never exported
 * }
 * Approved 11 Nov 2026 (V2, week-to-date spec). Events saved before then get the defaults below.
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
    suggestedDates: [],
    choice: "",
    weight: null,
    flags: [],
    endDate: null,
    status: "",
    ...partial,
  };
}
