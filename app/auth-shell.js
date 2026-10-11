import Link from "next/link";

/** The plain page around the sign-in, sign-up and reset-password forms: the name bar, then the form. */
export default function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <header className="topbar">
        <Link className="brand" href="/">
          AI Semester Planner
        </Link>
      </header>
      <main className="auth-main">{children}</main>
    </div>
  );
}
