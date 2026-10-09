// Date helpers for the calendar views. Days are ISO "YYYY-MM-DD" strings handled in UTC,
// so a day never shifts with the viewer's timezone. Weeks start on Monday.

const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (date) => date.toISOString().slice(0, 10);

/** Today's date where the student is. */
export function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso, days) {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** The first day of the month `months` away from this day's month. */
export function addMonths(iso, months) {
  const date = toDate(iso);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIso(date);
}

export function startOfWeek(iso) {
  return addDays(iso, -((toDate(iso).getUTCDay() + 6) % 7));
}

/** The seven days, Monday to Sunday, of the week containing this day. */
export function weekDays(iso) {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Every day shown on a month page: whole weeks, so it includes the edges of the neighbouring months. */
export function monthGrid(iso) {
  const first = addMonths(iso, 0);
  const last = addDays(addMonths(iso, 1), -1);
  const days = [];
  for (let day = startOfWeek(first); day <= last || days.length % 7 !== 0; day = addDays(day, 1)) days.push(day);
  return days;
}

export function formatDate(iso, options) {
  return toDate(iso).toLocaleDateString("en-GB", { timeZone: "UTC", ...options });
}

/** The day to open the calendar on: the next dated event, or the latest one if all are past, or today. */
export function focusDate(events) {
  const dates = events.map((event) => event.date).filter(Boolean).sort();
  return dates.find((date) => date >= today()) || dates.at(-1) || today();
}
