// PolyU Academic Calendar 2026/27 (updated 2 Sep 2026), copied by hand from WEEK_TO_DATE_SPEC.
// Data only: a new academic year is a change here, not in the code (lib/weeks.js). PolyU marks 2027 holidays as tentative.
// "evening" holidays cancel only sessions starting at eveningStartsAt or later.
const calendar = {
  academicYear: "2026/27",
  timezone: "Asia/Hong_Kong",
  eveningStartsAt: "18:00",
  semesters: {
    S1: { teachingWeek1Monday: "2026-08-31", teachingWeeks: 13, teachingEnds: "2026-11-28", skippedCalendarWeeks: [], addDrop: ["2026-08-31", "2026-09-12"], revisionDays: ["2026-11-30", "2026-12-02"], examPeriod: ["2026-12-03", "2026-12-18"] },
    S2: { teachingWeek1Monday: "2027-01-11", teachingWeeks: 13, teachingEnds: "2027-04-17", skippedCalendarWeeks: [["2027-02-08", "2027-02-14"]], addDrop: ["2027-01-11", "2027-01-23"], revisionDays: ["2027-04-19", "2027-04-21"], examPeriod: ["2027-04-22", "2027-05-08"] },
    SUMMER: { teachingWeek1Monday: "2027-05-24", teachingWeeks: 7, teachingEnds: "2027-07-10", skippedCalendarWeeks: [], addDrop: ["2027-05-24", "2027-05-29"], revisionDays: [], examPeriod: ["2027-07-12", "2027-07-17"] },
  },
  noClassDays: [
    { date: "2026-09-25", scope: "evening", name: "Chinese Mid-Autumn Festival" },
    { date: "2026-09-26", scope: "all", name: "Day following Mid-Autumn Festival" },
    { date: "2026-10-01", scope: "all", name: "National Day" },
    { date: "2026-10-10", scope: "all", name: "PolyU Undergraduate Info Day" },
    { date: "2026-10-19", scope: "all", name: "Day following Chung Yeung Festival" },
    { date: "2026-12-22", scope: "evening", name: "Winter Solstice" },
    { date: "2026-12-24", scope: "evening", name: "Christmas Eve" },
    { date: "2026-12-25", scope: "all", name: "Christmas Day" },
    { date: "2026-12-26", scope: "all", name: "First weekday after Christmas Day" },
    { date: "2026-12-31", scope: "evening", name: "New Year Eve" },
    { date: "2027-01-01", scope: "all", name: "First day of January" },
    { date: "2027-02-05", scope: "evening", name: "Lunar New Year Eve" },
    { range: ["2027-02-06", "2027-02-14"], scope: "all", name: "Lunar New Year Break" },
    { date: "2027-03-26", scope: "all", name: "Good Friday" },
    { date: "2027-03-27", scope: "all", name: "Day following Good Friday" },
    { date: "2027-03-29", scope: "all", name: "Easter Monday" },
    { date: "2027-04-05", scope: "all", name: "Ching Ming Festival" },
    { date: "2027-05-01", scope: "all", name: "Labour Day" },
    { date: "2027-05-13", scope: "all", name: "Birthday of the Buddha" },
    { date: "2027-06-09", scope: "all", name: "Tuen Ng Festival" },
    { date: "2027-07-01", scope: "all", name: "HKSAR Establishment Day" },
  ],
};
export default calendar;
