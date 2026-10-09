"use client";
import { useEffect, useRef, useState } from "react";
import { accountsEnabled, supabase, loadEvents, saveEvents } from "@/lib/account";
import AuthForm from "./auth-form";
import Landing from "./landing";
import Planner from "./planner";

/** Decides which screen to show (landing or planner) and keeps the signed-in student's events loaded and saved. */
export default function Home() {
  const [events, setEvents] = useState(null);
  // undefined = still checking, null = signed out.
  const [user, setUser] = useState(undefined);
  // Without Supabase configured there is no login; the visitor can still open the planner, unsaved.
  const [guest, setGuest] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [retry, setRetry] = useState(0);
  const lastSaved = useRef("[]");
  const userId = user?.id;

  useEffect(() => {
    if (!accountsEnabled) return;
    const { data } = supabase().auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Signing in loads that student's events; signing out clears them from the page.
  useEffect(() => {
    setEvents(null);
    setLoaded(false);
    setLoadError("");
    if (!userId) return;
    let stale = false;
    loadEvents()
      .then((saved) => {
        if (stale) return;
        lastSaved.current = JSON.stringify(saved);
        setEvents(saved.length ? saved : null);
        setSaveState("saved");
        setLoaded(true);
      })
      .catch((err) => !stale && setLoadError(String(err.message || err)));
    return () => {
      stale = true;
    };
  }, [userId]);

  // Save shortly after every change. Never before the saved list has loaded, or an empty page would overwrite it.
  useEffect(() => {
    if (!userId || !loaded) return;
    const list = events || [];
    const snapshot = JSON.stringify(list);
    if (snapshot === lastSaved.current) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      saveEvents(userId, list)
        .then(() => {
          lastSaved.current = snapshot;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 500);
    return () => clearTimeout(timer);
  }, [events, userId, loaded, retry]);

  if (!accountsEnabled && !guest) {
    return (
      <Landing>
        <div className="form">
          <h2>Open the planner</h2>
          <p className="hint form-intro">
            Accounts are not set up on this server, so there is no sign-in and your events are lost when you close the
            page.
          </p>
          <button type="button" className="button" onClick={() => setGuest(true)}>
            Open the planner
          </button>
        </div>
      </Landing>
    );
  }
  if (accountsEnabled && !user) {
    return <Landing>{user === undefined ? <p className="hint">Checking your account.</p> : <AuthForm />}</Landing>;
  }

  const account = user ? (
    <>
      <span>{user.email}</span>
      <button type="button" className="link" onClick={() => supabase().auth.signOut()}>
        Sign out
      </button>
    </>
  ) : (
    <button type="button" className="link" onClick={() => setGuest(false)}>
      Back to the start
    </button>
  );

  if (user && !loaded) {
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

  const saveLine = user ? (
    <div className="save-state" aria-live="polite">
      {saveState === "saved" && "Saved to your account."}
      {saveState === "saving" && "Saving."}
      {saveState === "error" && (
        <p className="alert" role="alert">
          <strong>Your latest changes are not saved</strong>
          They are still on this page. Check your connection, then{" "}
          <button type="button" className="link" onClick={() => setRetry((n) => n + 1)}>
            save again
          </button>
          .
        </p>
      )}
    </div>
  ) : (
    <p className="save-state">Not saved: accounts are not set up on this server.</p>
  );

  return <Planner events={events} setEvents={setEvents} account={account} saveLine={saveLine} />;
}
