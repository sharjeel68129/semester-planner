"use client";
import { useState } from "react";
import { supabase } from "@/lib/account";

/** Sign in or create an account. The page reacts to the session change, so this only reports problems. */
export default function AuthForm() {
  const [creating, setCreating] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const credentials = { email: form.get("email"), password: form.get("password") };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (forgot) {
        const { error: problem } = await supabase().auth.resetPasswordForEmail(credentials.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (problem) setError(problem.message);
        // The same words whether or not the address has an account, so this form cannot be used to find out who has one.
        else setNotice(`If ${credentials.email} has an account, we have emailed it a link to choose a new password.`);
        return;
      }
      const { data, error: problem } = creating
        ? await supabase().auth.signUp(credentials)
        : await supabase().auth.signInWithPassword(credentials);
      if (problem) setError(problem.message);
      // With email confirmation switched on, a new account has no session until the link is clicked.
      else if (creating && !data.session) {
        setNotice("Account created. Open the confirmation link we emailed you, then sign in here.");
        setCreating(false);
      }
    } catch {
      setError("Could not reach the account service. Check your connection, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} aria-busy={busy}>
      <h2>{forgot ? "Forgot your password?" : creating ? "Create your account" : "Sign in"}</h2>
      <p className="hint form-intro">
        {forgot
          ? "Enter your email and we will send you a link to choose a new one."
          : "Your events are saved to your account, so they are still here next time."}
      </p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" name="email" autoComplete="email" required />
      </div>
      {!forgot && (
      <div className="field">
        <label htmlFor="password">Password</label>
        {creating && (
          <span className="hint" id="password-hint">
            At least 8 characters.
          </span>
        )}
        <input
          id="password"
          type="password"
          name="password"
          autoComplete={creating ? "new-password" : "current-password"}
          minLength={creating ? 8 : undefined}
          aria-describedby={creating ? "password-hint" : undefined}
          required
        />
      </div>
      )}
      <button className="button" type="submit" disabled={busy}>
        {forgot ? "Email me a reset link" : creating ? "Create account" : "Sign in"}
      </button>
      <div className="status" aria-live="polite">
        {notice}
      </div>
      {error && (
        <p className="alert" role="alert">
          <strong>{forgot ? "Reset link not sent" : creating ? "Account not created" : "Not signed in"}</strong>
          {error}
        </p>
      )}
      <p className="switch">
        {forgot ? "Remembered it?" : creating ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          className="link"
          onClick={() => {
            setCreating(forgot ? false : !creating);
            setForgot(false);
            setError("");
          }}
        >
          {forgot || creating ? "Sign in" : "Create an account"}
        </button>
      </p>
      {!forgot && !creating && (
        <p className="switch">
          <button
            type="button"
            className="link"
            onClick={() => {
              setForgot(true);
              setError("");
              setNotice("");
            }}
          >
            Forgot password?
          </button>
        </p>
      )}
    </form>
  );
}
