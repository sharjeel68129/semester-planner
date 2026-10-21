// TEST COPY ONLY (copied over .accttest/lib/extract.js by test-copy.mjs --canned): fixed results instead of Gemini,
// so uploads can be tried on screen. The upload's text picks the result:
//   contains "FORM"     AMA1702's short subject form (two coarse rows), to try "Two files describe AMA1702"
//   contains "OUTLINE"  AMA1702's detailed outline (four rows, suggested dates, no class), to try the class-time question
//   anything else       COMP1010 with a weekly lecture and one quiz, with a breakdown that is missing an event
import { makeEvent } from "./schema";
import { suggestForWeek, suggestWeekly } from "./suggest";

export async function readFileText(filename, buffer) {
  return buffer.toString("utf8");
}

const e = (p) => makeEvent({ confidence: 0.9, sourceQuote: p.title, ...p });

export async function extractEvents(text, term) {
  if (text.includes("FORM")) {
    return {
      events: [e({ title: "Tests/assignments", course: "AMA1702", type: "deadline" }), e({ title: "Examination", course: "AMA1702", type: "exam" })],
      checks: [{ course: "AMA1702", total: 100, complete: true, rows: [{ name: "Tests/assignments", weight: 40, events: 1 }, { name: "Examination", weight: 60, events: 1 }], reference: null }],
    };
  }
  if (text.includes("OUTLINE")) {
    return {
      events: [
        e({ title: "Assignment 1", course: "AMA1702", type: "deadline", suggestedDates: suggestForWeek(4, "Fri", term, []).dates }),
        e({ title: "Quiz", course: "AMA1702", type: "quiz", suggestedDates: suggestForWeek(5, "Tue", term, []).dates }),
        e({ title: "Test", course: "AMA1702", type: "quiz", time: "18:30", suggestedDates: suggestForWeek(9, "Thu", term, []).dates }),
        e({ title: "Final Exam", course: "AMA1702", type: "exam", note: "Exam period" }),
      ],
      checks: [
        {
          course: "AMA1702",
          total: 100,
          complete: true,
          rows: [
            { name: "2 Assignments", weight: 10, events: 1 },
            { name: "12 weekly exercises", weight: 10, events: 1 },
            { name: "1 Test", weight: 20, events: 1 },
            { name: "Final Exam", weight: 60, events: 1 },
          ],
          reference: null,
        },
      ],
    };
  }
  return {
    events: [
      e({ title: "Lecture", course: "COMP1010", type: "class", time: "16:30", suggestedDates: suggestWeekly("Mon", term).dates }),
      e({ title: "Quiz 1", course: "COMP1010", type: "quiz", suggestedDates: suggestForWeek(5, "Wed", term, []).dates }),
    ],
    checks: [{ course: "COMP1010", total: 100, complete: false, rows: [{ name: "Quiz 1", weight: 30, events: 1 }, { name: "Examination", weight: 70, events: 0 }], reference: null }],
  };
}
