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

export async function readFile(filename, buffer) {
  return { text: buffer.toString("utf8"), fromPicture: false };
}

const e = (p) => makeEvent({ confidence: 0.9, sourceQuote: p.title, ...p });

export async function extractEvents(text, term) {
  // The week-to-date flags as they appear on screen (lib/weeks.js), for LEI1102-like and MM1041-like items.
  if (text.includes("FLAGS")) {
    return {
      events: [
        e({ title: "Digital Poster", course: "LEI1102", type: "deadline", weight: 20, flags: ["NEEDS_CLASS_TIME"], note: "Due 24 hours before the Week 6 class. This depends on your class time, which is not in the files." }),
        e({ title: "Group Project", course: "MM1041", type: "deadline", weight: 30, flags: ["APPROXIMATE_DATE"], note: "Week 12. Only the week is given, not the day." }),
        e({ title: "Essay Version 1", course: "MM1041", type: "deadline", time: "23:59", suggestedDates: ["2026-10-25"], flags: ["ASSUMED_TIME"], note: "Day before the Week 9 class." }),
        e({ title: "Exam", course: "MM1041", type: "exam", weight: 40, flags: ["DATE_TBA"], endDate: "2026-12-18", note: "The exam period is 3 Dec to 18 Dec 2026." }),
        e({ title: "Week 8 class", course: "MM1041", type: "class", date: "2026-10-19", time: "14:30", status: "cancelled", flags: ["CANCELLED_HOLIDAY"], note: "Cancelled: Day following Chung Yeung Festival is a public holiday, so there are no classes that day." }),
        e({ title: "Weekly Class", course: "ENG4001", type: "class", date: "2025-09-03", time: "12:30", suggestedDates: ["2026-09-03"], flags: ["YEAR_SUSPECT"], note: "The year looks wrong for this semester; the outline probably means 2026-09-03." }),
      ],
      checks: [],
    };
  }
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
