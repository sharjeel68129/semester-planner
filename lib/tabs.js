// Messages between open tabs of the planner in the same browser. A link from an email opens a new tab while the
// site may already be open in another; without this, each tab keeps its own copy of the events and the last one to
// save overwrites the other. Sign-in itself is already kept in step by Supabase.
//
// Messages: { type: "claim" }            a tab was opened; the others pause (app/one-tab.js), so one tab is used at a time
//           { type: "saved", userId }   events or settings were saved; other tabs reload them (a safety net for a
//                                       save that was still on its way when the tab was paused)
//           { type: "link", text }      a tab handled a link from an email; others show the same message
//           { type: "paused" }           a tab paused because another opened; only then is the student told so.
//                                       A tab still running an older version of the site never sends it.

/** This tab's id, so a tab ignores its own messages. */
export const TAB_ID = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

let channel;
let pausedSeen = false;

/** The shared channel, or null where the browser has none (then each tab simply works alone, as before). */
function getChannel() {
  if (channel !== undefined) return channel;
  channel = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("semester-planner") : null;
  // Listening from the moment the channel exists, so an answer that arrives early is not missed.
  channel?.addEventListener("message", (event) => {
    if (event.data?.type === "paused" && event.data.from !== TAB_ID) pausedSeen = true;
  });
  return channel;
}

/** Tell the other tabs something. */
export function tellOtherTabs(message) {
  getChannel()?.postMessage({ ...message, from: TAB_ID });
}

/** Listen to the other tabs. Returns a function that stops listening. */
export function listenToOtherTabs(handler) {
  const ch = getChannel();
  if (!ch) return () => {};
  const onMessage = (event) => {
    if (event.data && event.data.from !== TAB_ID) handler(event.data);
  };
  ch.addEventListener("message", onMessage);
  return () => ch.removeEventListener("message", onMessage);
}

/** True once another tab has confirmed it paused because this one opened (app/one-tab.js). */
export function anotherTabPaused() {
  getChannel();
  return pausedSeen;
}
