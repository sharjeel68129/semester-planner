"use client";
import { useEffect, useState } from "react";
import { accountsEnabled, maskEmail, supabase } from "@/lib/account";
import { anotherTabOpen, listenToOtherTabs, tellOtherTabs } from "@/lib/tabs";

// The reset page needs its one-time code in the address until the new password is submitted, so it is left alone.
const LEAVE_ALONE = ["/reset-password"];

/** What a link from an email brought with it, from the query or the hash (Supabase uses both). */
function readLink() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (name) => query.get(name) || hash.get(name) || "";
  return { code: get("code"), message: get("message"), error: get("error_description") || get("error") };
}

/** Supabase's own words, made into something a student can act on. */
function describe({ message, error }) {
  if (error) return `This link did not work (${error.replace(/\+/g, " ")}). Each link works once and expires; ask for a new one.`;
  if (/other email/i.test(message)) {
    return "Half done: now open the link sent to your other email address. Your email changes once both links are opened.";
  }
  return message.replace(/\+/g, " ");
}

/**
 * Every page has this. When the page was opened from a link in an email (confirm sign-up, change email), it says
 * what happened, tidies the link out of the address bar, and tells any other open tab, which shows the same
 * message. It also answers other tabs asking whether one is open.
 */
export default function LinkLanding() {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!accountsEnabled) return;
    const stop = listenToOtherTabs((message) => {
      if (message.type === "ping") tellOtherTabs({ type: "pong" });
      if (message.type === "link") setText(`From your other tab: ${message.text}`);
    });

    const path = window.location.pathname;
    const link = readLink();
    if (LEAVE_ALONE.includes(path) || !(link.code || link.message || link.error)) return stop;

    (async () => {
      let result = describe(link);
      if (link.code) {
        // Supabase's client exchanges the code by itself as it starts; wait for it before reading the result.
        // Opened in a different browser from the one that asked, the code cannot be used here; the address is
        // still confirmed by Supabase before it sends the browser back, so signing in works.
        // Supabase skips a code this browser did not ask for, and the tab may already be signed in from before, so
        // "signed in" proves nothing about the link. Say only what the account looks like now, read fresh from
        // Supabase; refreshing also updates the email shown in any other open tab.
        await supabase().auth.initialize();
        const { data } = await supabase().auth.getSession();
        if (data.session) {
          await supabase().auth.refreshSession();
          const { data: fresh } = await supabase().auth.getUser();
          const user = fresh.user || data.session.user;
          const waiting = user.new_email ? ` ${maskEmail(user.new_email)} still needs confirming from the link sent to it.` : "";
          result = `Link opened. You are signed in as ${maskEmail(user.email)}.${waiting}`;
        } else {
          result = "Link opened. If it confirmed an email address, that part is done; sign in as usual.";
        }
      }
      // Without the code or message in the address, a reload does not try to use the link again.
      window.history.replaceState(null, "", path);
      tellOtherTabs({ type: "link", text: result });
      const other = await anotherTabOpen();
      setText(other ? `${result} Your other tab shows this too, so you can close this one.` : result);
    })();
    return stop;
  }, []);

  if (!text) return null;
  return (
    <div className="link-landing" role="status">
      <p>{text}</p>
      <button type="button" className="link" onClick={() => setText("")}>
        Close
      </button>
    </div>
  );
}
