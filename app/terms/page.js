import Link from "next/link";
import { OPERATOR } from "@/lib/site";
import AuthShell from "../auth-shell";
import ContactLine from "../contact-line";

export const metadata = {
  title: "Terms",
  description: "The terms for using the AI Semester Planner: a student project whose dates you must check against your own outlines.",
};

// A plain statement by students of what to expect, not a legal document.
export default function Terms() {
  return (
    <AuthShell wide>
      <h1>Terms</h1>
      <p className="hint">Last updated 11 October 2026.</p>
      <p>
        This site is run by {OPERATOR}. It is a course project, not an official PolyU service. These terms are written
        by students in plain words; they are not a legal document. By creating an account you agree to them.
      </p>

      <h2>Check every date yourself</h2>
      <p>
        <strong>
          An AI reads your outlines, and it can miss an event, misread one, or give a wrong date or time. Check every
          event against your course outline before you rely on it.
        </strong>
      </p>
      <ul>
        <li>A suggested date is worked out from a week number and is only a suggestion until you accept it.</li>
        <li>The built-in teaching weeks are for PolyU in 2026/27 and do not know about make-up classes or changes.</li>
        <li>When the planner says your assessments add up to 100%, it means each graded part was found, not that every item or date is right.</li>
        <li>Your lecturer&rsquo;s announcements and the official outline always come first.</li>
      </ul>
      <p>We are not responsible for a missed deadline, class or exam.</p>

      <h2>No guarantee</h2>
      <p>
        The site is offered as it is, free of charge. It may be slow, unavailable, or changed without notice, and it may
        be switched off when the course ends. Download your calendar file if you want to keep your events.
      </p>

      <h2>Using it fairly</h2>
      <ul>
        <li>Upload only course outlines you are allowed to use.</li>
        <li>Do not upload files containing personal information about you or others.</li>
        <li>Do not try to break the site, get into other people&rsquo;s accounts, or use it to run up costs.</li>
      </ul>
      <p>We may remove an account that is used against these terms.</p>

      <h2>Your information</h2>
      <p>
        See the <Link className="link" href="/privacy">privacy page</Link> for what is stored and how to delete it.
      </p>

      <h2>Contact</h2>
      <p>
        <ContactLine />
      </p>
    </AuthShell>
  );
}
