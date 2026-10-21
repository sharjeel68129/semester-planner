// A test account on the local stand-in (mock-supabase.mjs) with events like a real AMA1702 + COMP1010 upload. Test values only.
const base = "http://localhost:54399";
const email = "planner.tester@example.test";
const password = "mock-pass-1234";
await fetch(`${base}/__set`, { method: "POST", body: JSON.stringify({ confirm: false }) });
let s = await (await fetch(`${base}/auth/v1/signup`, { method: "POST", body: JSON.stringify({ email, password }) })).json();
if (!s.access_token) s = await (await fetch(`${base}/auth/v1/token?grant_type=password`, { method: "POST", body: JSON.stringify({ email, password }) })).json();
const ev = (p) => ({ course: "AMA1702", type: "quiz", date: null, time: null, confidence: 0.9, sourceQuote: p.title, ambiguous: false, note: "", suggestedDates: [], choice: "", weight: null, ...p });
const weeks = (start, n, step = 7) => Array.from({ length: n }, (_, i) => new Date(Date.parse(start) + i * step * 864e5).toISOString().slice(0, 10));
const events = [
  ...[1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13].map((n) => ev({ title: `Exercise ${n}`, type: "deadline", note: `Week ${n}.` })),
  ...weeks("2026-08-31", 13).map((date) => ev({ title: "Tutorial TUT004", type: "class", time: "15:30", date })),
  ...weeks("2026-09-02", 13).map((date) => ev({ title: "Lectures", type: "class", time: "08:30", date })),
  ev({ title: "Midterm Test", type: "exam", time: "09:30", date: "2026-10-25" }),
  ev({ title: "Tests/assignments", type: "deadline", weight: 40, ambiguous: true, note: "The outline lists this as a heading; check whether it is one item." }),
  ev({ title: "Examination", type: "exam", weight: 60, note: "The exam period is 3 Dec to 18 Dec 2026." }),
  ev({ title: "Lecture", type: "class", time: "08:30", ambiguous: true, note: "Part of the source quote was not found in the outline; check this event is real." }),
  ev({ title: "Tutorial", type: "class", time: "12:30", note: "Thu 12:30-13:20. 11 weekly classes suggested.", suggestedDates: ["2026-09-10", "2026-09-17", "2026-09-24"] }),
  ...[1, 2, 3, 4].map((n) => ev({ title: `Ex. ${n}`, weight: 2.5, note: `Week ${n + 1}, in tutorial. Suggested date Thu.`, suggestedDates: [`2026-09-${String(3 + 7 * n).padStart(2, "0")}`] })),
  ev({ title: "Test 1", weight: 15, time: "08:30", date: "2026-10-05" }),
  ev({ title: "Assignment 1", course: "COMP1010", type: "deadline", weight: 10, time: "23:59", date: "2026-10-05" }),
  ev({ title: "Test 2", weight: 15, time: "08:30", date: "2026-11-09" }),
  ev({ title: "Quiz 1", course: "COMP1010", weight: 5, date: "2026-10-14", time: "10:30" }),
  ev({ title: "Group project report", course: "COMP1010", type: "deadline", weight: 15, note: "Due in week 12; the outline gives no day." }),
];
const res = await fetch(`${base}/rest/v1/planners`, { method: "POST", headers: { authorization: `Bearer ${s.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ user_id: s.user.id, events, settings: { defaultView: "month", breakdowns: {
  AMA1702: { course: "AMA1702", total: 100, rows: [{ name: "Weekly exercises", weight: 10 }, { name: "Assignment", weight: 10 }, { name: "Midterm Test", weight: 20 }, { name: "Final Examination", weight: 60 }], reference: { matches: false, message: "PolyU's subject form (undated) lists the examination at 50%. This outline's final examination is 60%. Outlines can differ from the form; check which is current.", sourceUrl: "https://www.polyu.edu.hk/ama/" } },
  COMP1010: { course: "COMP1010", total: 90, rows: [{ name: "Quiz 1", weight: 5 }, { name: "Group project report", weight: 15 }, { name: "Examination", weight: 70 }], reference: null } } } }) });
console.log("seeded", res.status, events.length);
