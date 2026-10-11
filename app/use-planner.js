"use client";
import { useEffect, useRef, useState } from "react";
import { accountsEnabled, supabase, loadPlanner, saveEvents, saveSettings } from "@/lib/account";
import { makeSettings } from "@/lib/settings";

/**
 * Who is signed in, with their events and settings kept loaded and saved. Shared by the planner and settings pages.
 * `user` is undefined while still checking and null when signed out.
 */
export function usePlanner() {
  const [events, setEvents] = useState(null);
  const [settings, setSettings] = useState(makeSettings);
  const [settingsAvailable, setSettingsAvailable] = useState(true);
  const [settingsState, setSettingsState] = useState("saved");
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

  // Signing in loads that student's events and settings; signing out clears them from the page.
  useEffect(() => {
    setEvents(null);
    setSettings(makeSettings());
    setLoaded(false);
    setLoadError("");
    if (!userId) return;
    let stale = false;
    loadPlanner()
      .then((saved) => {
        if (stale) return;
        lastSaved.current = JSON.stringify(saved.events);
        setEvents(saved.events.length ? saved.events : null);
        setSettings(saved.settings);
        setSettingsAvailable(saved.settingsAvailable);
        setSaveState("saved");
        setSettingsState("saved");
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

  /** Change some settings. They apply on this page at once, and are saved to the account. */
  async function updateSettings(patch) {
    const next = makeSettings({ ...settings, ...patch });
    setSettings(next);
    setSettingsState("saving");
    try {
      await saveSettings(userId, next);
      setSettingsState("saved");
    } catch {
      setSettingsState("error");
    }
  }

  return {
    user,
    events,
    setEvents,
    settings,
    updateSettings,
    settingsState,
    settingsAvailable,
    loaded,
    loadError,
    saveState,
    retrySave: () => setRetry((n) => n + 1),
  };
}
