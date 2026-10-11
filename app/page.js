"use client";
import Link from "next/link";
import { supabase } from "@/lib/account";
import Landing from "./landing";
import Planner from "./planner";
import { usePlanner } from "./use-planner";

/** Decides which screen to show: the landing page when signed out, the planner when signed in. */
export default function Home() {
  const { user, events, setEvents, settings, loaded, loadError, saveState, retrySave } = usePlanner();

  // No way into the planner without an account: signed out (or still checking) shows only the landing page.
  // Its buttons lead to /login and /signup, which also explain when no account service is set up.
  if (!user) return <Landing />;

  const account = (
    <>
      <span>{user.email}</span>
      <Link className="link" href="/settings">
        Settings
      </Link>
      <button type="button" className="link" onClick={() => supabase().auth.signOut()}>
        Sign out
      </button>
    </>
  );

  if (!loaded) {
    return (
      <div className="app">
        <header className="topbar">
          <span className="brand">AI Semester Planner</span>
          <div className="topbar-account">{account}</div>
        </header>
        <main className="main main-alone">
          {loadError ? (
            <p className="alert" role="alert">
              <strong>Your saved events could not be loaded</strong>
              {loadError} Reload the page to try again. Nothing has been changed.
            </p>
          ) : (
            <p className="hint">Loading your events.</p>
          )}
        </main>
      </div>
    );
  }

  const saveLine = (
    <div className="save-state" aria-live="polite">
      {saveState === "saved" && "Saved to your account."}
      {saveState === "saving" && "Saving."}
      {saveState === "error" && (
        <p className="alert" role="alert">
          <strong>Your latest changes are not saved</strong>
          They are still on this page. Check your connection, then{" "}
          <button type="button" className="link" onClick={retrySave}>
            save again
          </button>
          .
        </p>
      )}
    </div>
  );

  return <Planner events={events} setEvents={setEvents} settings={settings} account={account} saveLine={saveLine} />;
}
