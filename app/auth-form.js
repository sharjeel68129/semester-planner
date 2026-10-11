"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/account";

/**
 * Sign in (/login) or create an account (/signup); `creating` says which. "Forgot password?" is a third state of
 * the sign-in form. The page reacts to the session change, so this only reports problems.
 */
export default function AuthForm({ creating = false }) {
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The address a confirmation link was sent to; set once an account is created but not yet confirmed.
  const [sentTo, setSentTo] = useState("");

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
      else if (creating && !data.session) setSentTo(credentials.email);
    } catch {
      setError("Could not reach the account service. Check your connection, then try again.");
    } finally {
      setBusy(false);
    }
  }

  // The page after signing up. It stays on /signup so the email address is never put in a web address.
  if (sentTo) {
    return (
      <div className="form" role="status">
        <h2>Check your email</h2>
        <p className="form-intro">
          Thank you for signing up. We sent a confirmation link to <strong>{sentTo}</strong>.
        </p>
        <ol className="next-steps">
          <li>Open the email and press the link. It can take a minute to arrive; look in spam if it does not.</li>
          <li>Open the link in this browser, and your planner opens.</li>
          <li>Then upload your first course outline.</li>
        </ol>
        <p className="switch">
          Already confirmed?{" "}
          <Link className="link" href="/login">
            Sign in
          </Link>
        </p>
        <p className="switch">
          <button type="button" className="link" onClick={() => setSentTo("")}>
            Use a different email
          </button>
        </p>
      </div>
    );
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
      {creating && (
        <p className="hint agree">
          By creating an account you agree to the{" "}
          <Link className="link" href="/terms">
            Terms
          </Link>{" "}
          and{" "}
          <Link className="link" href="/privacy">
            Privacy
          </Link>{" "}
          pages.
        </p>
      )}
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
        {forgot ? (
          <button
            type="button"
            className="link"
            onClick={() => {
              setForgot(false);
              setError("");
              setNotice("");
            }}
          >
            Sign in
          </button>
        ) : (
          <Link className="link" href={creating ? "/login" : "/signup"}>
            {creating ? "Sign in" : "Create an account"}
          </Link>
        )}
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
