// Owner: Extraction person. Turn outline text into Event[].
import { makeEvent } from "./schema";

/** TODO: .pdf -> pdf-parse, .docx -> mammoth, .txt -> buffer.toString(). Returns plain text. */
export async function readFileText(filename, buffer) {
  throw new Error("not implemented");
}

/**
 * TODO: call Gemini (key is process.env.GEMINI_API_KEY, server side only) with a prompt,
 * parse JSON into Event[]. Mark ambiguous=true for "Week 7", "TBA", missing year, etc.
 * Never invent dates.
 */
export async function extractEvents(text, semesterStart, semesterEnd) {
  throw new Error("not implemented");
}
