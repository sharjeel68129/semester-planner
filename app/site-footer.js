import Link from "next/link";
import { OPERATOR } from "@/lib/site";

/** The line at the bottom of every public page: who runs the site and where its small print is. */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>{OPERATOR}. Not an official PolyU service.</p>
      <nav aria-label="About this site">
        <Link className="link" href="/privacy">
          Privacy
        </Link>
        <Link className="link" href="/terms">
          Terms
        </Link>
        <Link className="link" href="/contact">
          Contact
        </Link>
      </nav>
    </footer>
  );
}
