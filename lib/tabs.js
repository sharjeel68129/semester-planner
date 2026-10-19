// Messages between open tabs of the planner in the same browser. A link from an email opens a new tab while the
// site may already be open in another; without this, each tab keeps its own copy of the events and the last one to
// save overwrites the other. Sign-in itself is already kept in step by Supabase.
//
// Messages: { type: "claim" }            a tab was opened; the others pause (app/one-tab.js), so one tab is used at a time
//           { type: "saved", userId }   events or settings were saved; other tabs reload them (a safety net for a
//                                       save that was still on its way when the tab was paused)
//           { type: "link", text }      a tab handled a link from an email; others show the same message
//           { type: "ping" } / { type: "pong" }   is another tab open?

/** This tab's id, so a tab ignores its own messages. */
export const TAB_ID = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

let channel;

/** The shared channel, or null where the browser has none (then each tab simply works alone, as before). */
function getChannel() {
  if (channel !== undefined) return channel;
  channel = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("semester-planner") : null;
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

/** Resolves true if another tab of the site answers within `ms`. */
export function anotherTabOpen(ms = 400) {
  const ch = getChannel();
  if (!ch) return Promise.resolve(false);
  return new Promise((resolve) => {
    const stop = listenToOtherTabs((message) => {
      if (message.type !== "pong") return;
      stop();
      resolve(true);
    });
    tellOtherTabs({ type: "ping" });
    setTimeout(() => {
      stop();
      resolve(false);
    }, ms);
  });
}
