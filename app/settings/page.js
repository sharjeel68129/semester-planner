"use client";
import { useState } from "react";
import Link from "next/link";
import { accountsEnabled, supabase, deleteAccount, maskEmail } from "@/lib/account";
import { REMINDER_OPTIONS, VIEW_OPTIONS } from "@/lib/settings";
import { TERMS, resolveTerm } from "@/lib/polyu-calendar";
import AuthShell from "../auth-shell";
import { usePlanner } from "../use-planner";

const MIN_PASSWORD = 8;

/** One account action with its own result line, so a failure is shown next to the button that caused it. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  async function run(action) {
    setBusy(true);
    setDone("");
    setError("");
    try {
      setDone((await action()) || "");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }
  const result = (
    <>
      <div className="status" aria-live="polite">
        {done}
      </div>
      {error && (
        <p className="alert" role="alert">
          <strong>Not done</strong>
          {error}
        </p>
      )}
    </>
  );
  return { busy, run, result };
}

/** Supabase reports problems in the reply, not by throwing; this turns one into a thrown error. */
function check({ error }) {
  if (error) throw new Error(error.message);
}

function ChangeEmail({ email }) {
  const { busy, run, result } = useAction();
  function onSubmit(e) {
    e.preventDefault();
    const next = new FormData(e.target).get("email");
    run(async () => {
      check(await supabase().auth.updateUser({ email: next }, { emailRedirectTo: window.location.origin }));
      return `We emailed a confirmation link to ${next}. Your address stays ${maskEmail(email)} until you open it.`;
    });
  }
  return (
    <form onSubmit={onSubmit} aria-busy={busy}>
      <h3>Email</h3>
      <p className="hint">You sign in with {maskEmail(email)}.</p>
      <div className="field">
        <label htmlFor="new-email">New email address</label>
        <input id="new-email" type="email" name="email" autoComplete="email" required />
      </div>
      <button className="button button-quiet" type="submit" disabled={busy}>
        Change email
      </button>
      {result}
    </form>
  );
}

function ChangePassword() {
  const { busy, run, result } = useAction();
  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const password = form.get("password");
    run(async () => {
      if (password !== form.get("again")) throw new Error("The two passwords are not the same.");
      check(await supabase().auth.updateUser({ password }));
      e.target.reset();
      return "Password changed.";
    });
  }
  return (
    <form onSubmit={onSubmit} aria-busy={busy}>
      <h3>Password</h3>
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <span className="hint" id="new-password-hint">
          At least {MIN_PASSWORD} characters.
        </span>
        <input id="new-password" type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD} aria-describedby="new-password-hint" required />
      </div>
      <div className="field">
        <label htmlFor="new-password-again">New password again</label>
        <input id="new-password-again" type="password" name="again" autoComplete="new-password" minLength={MIN_PASSWORD} required />
      </div>
      <button className="button button-quiet" type="submit" disabled={busy}>
        Change password
      </button>
      {result}
    </form>
  );
}

function DeleteAccount() {
  const { busy, run, result } = useAction();
  function onSubmit(e) {
    e.preventDefault();
    const password = new FormData(e.target).get("password");
    if (!window.confirm("Delete your account and all your saved events? This cannot be undone.")) return;
    run(async () => {
      // The database checks the password itself, so a signed-in browser alone is not enough to delete the account.
      if (!(await deleteAccount(password))) throw new Error("That password is not right. Nothing was deleted.");
      // The account is gone, so only this browser's copy of the session is left to clear.
      await supabase().auth.signOut({ scope: "local" });
      window.location.assign("/");
    });
  }
  return (
    <form className="danger" onSubmit={onSubmit} aria-busy={busy}>
      <h3>Delete account</h3>
      <p className="hint">This permanently removes your account and every saved event. It cannot be undone.</p>
      <div className="field">
        <label htmlFor="delete-password">Your password</label>
        <input id="delete-password" type="password" name="password" autoComplete="current-password" required />
      </div>
      <button className="button" type="submit" disabled={busy}>
        Delete my account
      </button>
      {result}
    </form>
  );
}

export default function SettingsPage() {
  const { user, events, setEvents, settings, updateSettings, settingsState, settingsAvailable, loaded, loadError, saveState } = usePlanner();

  if (!accountsEnabled || !user) {
    return (
      <AuthShell>
        {user === undefined && accountsEnabled ? (
          <p className="hint">Checking your account.</p>
        ) : (
          <div className="form">
            <h2>Settings</h2>
            <p className="hint form-intro">Sign in to see your settings.</p>
            <Link className="link" href="/login">
              Sign in
            </Link>
          </div>
        )}
      </AuthShell>
    );
  }

  const count = (events || []).length;
  const term = resolveTerm(settings.semester, settings.weekOneMonday);
  const toggleReminder = (minutes) =>
    updateSettings({ reminders: settings.reminders.includes(minutes) ? settings.reminders.filter((m) => m !== minutes) : [...settings.reminders, minutes] });

  function removeAll() {
    if (!window.confirm("Remove all your events? This cannot be undone.")) return;
    setEvents(null);
    // The grade breakdowns and skipped-number answers came with those events' outlines.
    updateSettings({ breakdowns: {}, ignoredGaps: [] });
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">AI Semester Planner</span>
        <div className="topbar-account">
          <span>{maskEmail(user.email)}</span>
          <Link className="link" href="/">
            Back to calendar
          </Link>
          <button type="button" className="link" onClick={() => supabase().auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="main main-alone settings">
        <h1>Settings</h1>
        {!loaded ? (
          loadError ? (
            <p className="alert" role="alert">
              <strong>Your settings could not be loaded</strong>
              {loadError} Reload the page to try again. Nothing has been changed.
            </p>
          ) : (
            <p className="hint">Loading your settings.</p>
          )
        ) : (
          <>
            <div className="save-state" aria-live="polite">
              {settingsState === "saved" && "Changes are saved to your account as you make them."}
              {settingsState === "saving" && "Saving."}
            </div>
            {settingsState === "error" && (
              <p className="alert" role="alert">
                <strong>Your last change was not saved</strong>
                It applies until you leave this page.{" "}
                {settingsAvailable
                  ? "Check your connection and change it again."
                  : "This site's database has no place for settings yet: whoever runs it needs to run supabase/schema.sql again."}
              </p>
            )}

            <section aria-labelledby="reminders-heading">
              <h2 id="reminders-heading">Reminders</h2>
              <p className="hint">
                Added to every event in the calendar file you download. A file you already added to your calendar keeps
                its old reminders.
              </p>
              <fieldset className="ticks">
                <legend className="sr-only">Remind me</legend>
                {REMINDER_OPTIONS.map(([minutes, label]) => (
                  <label key={minutes}>
                    <input type="checkbox" checked={settings.reminders.includes(minutes)} onChange={() => toggleReminder(minutes)} />
                    {label}
                  </label>
                ))}
              </fieldset>
              {settings.reminders.length === 0 && <p className="hint">None chosen: the calendar file will have no reminders.</p>}
            </section>

            <section aria-labelledby="semester-heading" id="semester">
              <h2 id="semester-heading">Semester</h2>
              <p className="hint">
                The PolyU teaching weeks used to suggest a date for items like &ldquo;Week 7, Tue&rdquo; and for weekly
                classes. It applies to outlines you upload from now on.
              </p>
              <div className="field">
                <label htmlFor="semester-choice">Semester</label>
                <select id="semester-choice" value={settings.semester || ""} onChange={(e) => updateSettings({ semester: e.target.value || null })}>
                  <option value="">Whichever is running now</option>
                  {TERMS.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </div>
              {settings.semester === "other" && (
                <div className="field">
                  <label htmlFor="week-one">Monday of week 1</label>
                  <span className="hint" id="week-one-hint">
                    13 teaching weeks are counted from here. Breaks and holidays are not known.
                    {term && ` Using ${term.label}.`}
                  </span>
                  <input
                    id="week-one"
                    type="date"
                    value={settings.weekOneMonday || ""}
                    onChange={(e) => updateSettings({ weekOneMonday: e.target.value || null })}
                    aria-describedby="week-one-hint"
                  />
                </div>
              )}
            </section>

            <section aria-labelledby="display-heading">
              <h2 id="display-heading">Calendar display</h2>
              <div className="field">
                <label htmlFor="default-view">Open the calendar in</label>
                <select id="default-view" value={settings.defaultView} onChange={(e) => updateSettings({ defaultView: e.target.value })}>
                  {VIEW_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="week-start">Weeks start on</label>
                <span className="hint" id="week-start-hint">
                  Changes the first column of the calendar only. Teaching weeks still run Monday to Sunday.
                </span>
                <select id="week-start" value={settings.weekStart} onChange={(e) => updateSettings({ weekStart: e.target.value })} aria-describedby="week-start-hint">
                  <option value="mon">Monday</option>
                  <option value="sun">Sunday</option>
                </select>
              </div>
            </section>

            <section aria-labelledby="account-heading">
              <h2 id="account-heading">Account</h2>
              <ChangeEmail email={user.email} />
              <ChangePassword />
              <div>
                <h3>Saved events</h3>
                <p className="hint">
                  {count === 0 ? "You have no saved events." : `You have ${count} saved ${count === 1 ? "event" : "events"}.`}
                  {saveState === "error" && " The last change could not be saved; check your connection."}
                </p>
                <button className="button button-quiet" type="button" disabled={count === 0} onClick={removeAll}>
                  Remove all events
                </button>
              </div>
              <DeleteAccount />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
