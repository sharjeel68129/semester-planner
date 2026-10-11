import Link from "next/link";
import AuthShell from "./auth-shell";

export const metadata = { title: "Page not found" };

/** Shown for any address the site does not have. */
export default function NotFound() {
  return (
    <AuthShell>
      <div className="form">
        <h2>This page does not exist</h2>
        <p className="hint form-intro">The address may be mistyped, or the page may have moved.</p>
        <p>
          <Link className="link" href="/">
            Go to the home page
          </Link>
        </p>
        <p className="switch">
          <Link className="link" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
