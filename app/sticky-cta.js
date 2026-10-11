"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * On a phone, keeps "Create an account" in reach once the buttons in the header (`watch`, a CSS selector)
 * have scrolled out of view. Hidden on wider screens by CSS.
 */
export default function StickyCta({ watch }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.querySelector(watch);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);

  // The cookie notice sits above this bar, so it needs to know when the bar is there.
  useEffect(() => {
    document.documentElement.classList.toggle("has-sticky-cta", show);
    return () => document.documentElement.classList.remove("has-sticky-cta");
  }, [show]);

  if (!show) return null;
  return (
    <div className="sticky-cta">
      <Link className="button button-wide" href="/signup">
        Create an account
      </Link>
    </div>
  );
}
