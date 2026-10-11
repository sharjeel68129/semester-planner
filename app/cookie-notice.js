"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "cookie-notice-ok";

/**
 * Tells a first-time visitor what the site stores in their browser. It is a notice, not a consent form:
 * the only cookies are the ones that keep a student signed in, so there is nothing to refuse.
 */
export default function CookieNotice() {
  // Hidden until the browser has been asked, so the server and the first paint agree.
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true); // storage blocked: show it, and "OK" then lasts until the page is left
    }
  }, []);

  if (!show) return null;
  return (
    <aside className="cookie-notice" aria-label="Cookies">
      <p>
        This site only uses cookies that keep you signed in. It counts page views without cookies.{" "}
        <Link className="link" href="/privacy">
          Privacy
        </Link>
      </p>
      <button
        type="button"
        className="button"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
        }}
      >
        OK
      </button>
    </aside>
  );
}
