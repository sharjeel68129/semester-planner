import Link from "next/link";
import SiteFooter from "./site-footer";

/**
 * The plain page around the sign-in, sign-up and reset-password forms, and (with `wide`) the pages of
 * text such as privacy and terms: the name bar, the content, then the footer.
 */
export default function AuthShell({ children, wide = false }) {
  return (
    <div className="auth-page">
      <header className="topbar">
        <Link className="brand" href="/">
          AI Semester Planner
        </Link>
      </header>
      <main className={wide ? "auth-main auth-main-wide prose" : "auth-main"}>{children}</main>
      <SiteFooter />
    </div>
  );
}
