"use client";
import { useEffect, useRef, useState } from "react";
import { listenToOtherTabs, tellOtherTabs } from "@/lib/tabs";

/**
 * Only one tab of the planner is in use at a time, and the newest one wins: opening the site in a tab (for example
 * from a link in an email) pauses every other open tab. A paused tab tries to close itself; browsers only allow
 * that for a tab with no history of its own, so otherwise it is covered by a message that blocks the page until
 * the student chooses "Use it here", which reloads it with fresh data and pauses the other tab in turn.
 * Every page has this.
 */
export default function OneTab() {
  const [paused, setPaused] = useState(false);
  const dialog = useRef(null);

  useEffect(() => {
    const stop = listenToOtherTabs((message) => {
      if (message.type !== "claim") return;
      setPaused(true);
      window.close(); // does nothing where the browser does not allow it
    });
    tellOtherTabs({ type: "claim" });
    return stop;
  }, []);

  // A modal dialog makes the rest of the page unreachable by mouse and keyboard while paused.
  useEffect(() => {
    if (paused && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [paused]);

  if (!paused) return null;
  return (
    <dialog
      ref={dialog}
      className="editor one-tab"
      aria-labelledby="one-tab-title"
      // Escape must not uncover a page that is out of date. Newer browsers can close the dialog anyway, so it reopens.
      onCancel={(e) => e.preventDefault()}
      onClose={() => dialog.current?.showModal()}
    >
      <div className="editor-box">
        <h2 id="one-tab-title">The planner is open in another tab</h2>
        <p>
          To keep your changes from overwriting each other, only one tab can be used at a time. This one has been
          paused. You can close it.
        </p>
        <p className="one-tab-actions">
          <button type="button" className="button" onClick={() => window.location.reload()}>
            Use it here
          </button>
        </p>
      </div>
    </dialog>
  );
}
