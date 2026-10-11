"use client";
import { useState } from "react";
import Link from "next/link";
import { accountsEnabled, supabase } from "@/lib/account";
import AuthShell from "../auth-shell";

const MIN_PASSWORD = 8;

/**
 * Where the "reset your password" email leads. The link carries a one-time code (token_hash), so it works
 * on a different device from the one that asked for it.
 */
export default function ResetPassword() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const password = form.get("password");
    setError("");
    if (password !== form.get("again")) return setError("The two passwords are not the same.");
    setBusy(true);
    try {
      // The code is only spent here, on submit: mail scanners that open links early must not use it up.
      const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
      if (tokenHash) {
        const { error: problem } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        // A second press after a failed password change finds the code already used but the session in place.
        if (problem && !(await supabase().auth.getSession()).data.session) {
          throw new Error("This reset link has expired or was already used. Ask for a new one from the sign-in page.");
        }
      } else if (!(await supabase().auth.getSession()).data.session) {
        throw new Error("Open this page from the link in the reset email.");
      }
      const { error: problem } = await supabase().auth.updateUser({ password });
      if (problem) throw new Error(problem.message);
      setDone(true);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  if (!accountsEnabled) {
    return (
      <AuthShell>
        <p className="hint">Sign-in is not set up on this server.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      {done ? (
        <div className="form">
          <h2>Password changed</h2>
          <p className="hint form-intro">You are signed in with your new password.</p>
          <Link className="link" href="/">
            Open the planner
          </Link>
        </div>
      ) : (
        <form className="form" onSubmit={onSubmit} aria-busy={busy}>
          <h2>Choose a new password</h2>
          <div className="field">
            <label htmlFor="password">New password</label>
            <span className="hint" id="password-hint">
              At least {MIN_PASSWORD} characters.
            </span>
            <input id="password" type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD} aria-describedby="password-hint" required />
          </div>
          <div className="field">
            <label htmlFor="again">New password again</label>
            <input id="again" type="password" name="again" autoComplete="new-password" minLength={MIN_PASSWORD} required />
          </div>
          <button className="button" type="submit" disabled={busy}>
            Change password
          </button>
          {error && (
            <p className="alert" role="alert">
              <strong>Password not changed</strong>
              {error}
            </p>
          )}
          <p className="switch">
            <Link className="link" href="/login">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
