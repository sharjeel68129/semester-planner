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

  // No way into the planner without an account, so a server with no account service shows only this.
  if (!accountsEnabled) {
    return (
      <Landing>
        <div className="form">
          <h2>Sign-in is not set up yet</h2>
          <p className="hint form-intro">
            This server has no account service, so the planner cannot be opened. If you run this site, add the Supabase
            values listed in .env.example and restart it.
          </p>
        </div>
      </Landing>
    );
  }
  if (!user) {
    return <Landing>{user === undefined ? <p className="hint">Checking your account.</p> : <AuthForm />}</Landing>;
  }

  const account = (
    <>
      <span>{user.email}</span>
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
          <button type="button" className="link" onClick={() => setRetry((n) => n + 1)}>
            save again
          </button>
          .
        </p>
      )}
    </div>
  );

  return <Planner events={events} setEvents={setEvents} account={account} saveLine={saveLine} />;
}
