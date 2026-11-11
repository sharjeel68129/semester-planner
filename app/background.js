"use client";
// Lets an upload run while the student works in another tab: the tab title shows progress (like a timer site's
// countdown), and a desktop notification says when the results are ready or something went wrong.
// Everything here is optional: a browser that blocks notifications still gets the title and the on-page message.

const BASE_TITLE = "AI Semester Planner";

/** Ask once, while the student is pressing the button (browsers only allow the question after a click). */
export function askToNotify() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
  } catch {
    // Some browsers throw instead of asking; the title and page message still work.
  }
}

/** Show progress in the tab title, e.g. "(2/6) Reading… | AI Semester Planner". Empty text restores the title. */
export function titleProgress(text) {
  if (typeof document === "undefined") return;
  document.title = text ? `${text} | ${BASE_TITLE}` : BASE_TITLE;
}

/** A desktop notification, only when the tab is not being looked at (the page itself already shows the result). */
export function notify(title, body) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (typeof document !== "undefined" && document.visibilityState === "visible") return;
    const note = new Notification(title, { body, icon: "/icon.svg", tag: "planner-upload" });
    note.onclick = () => {
      window.focus();
      note.close();
    };
  } catch {
    // Notifications are a convenience; never let one break the upload.
  }
}
