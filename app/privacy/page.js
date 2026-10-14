import Link from "next/link";
import { OPERATOR } from "@/lib/site";
import AuthShell from "../auth-shell";
import ContactLine from "../contact-line";

export const metadata = {
  title: "Privacy",
  description: "What the AI Semester Planner stores about you, what happens to the outlines you upload, and how to delete it all.",
};

// Written from what the code does. It is a plain description by students, not a legal document:
// if the code changes what is stored or where it is sent, change this page in the same commit.
export default function Privacy() {
  return (
    <AuthShell wide>
      <h1>Privacy</h1>
      <p className="hint">Last updated 11 October 2026.</p>
      <p>
        This site is run by {OPERATOR}. It is a course project, not an official PolyU service, and this page is a plain
        description of what it does with your information, written by students and not by a lawyer.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your email address and password.</strong> The password is stored only in scrambled form (a hash); we
          cannot read it.
        </li>
        <li>
          <strong>Your events.</strong> Each class, deadline, quiz and exam on your calendar, including the words quoted
          from your outline, any class times you type in, and any changes you make.
        </li>
        <li>
          <strong>Your settings.</strong> Reminder times, semester, calendar display, and the courses you said have no
          classes.
        </li>
      </ul>

      <h2>What happens to an outline you upload</h2>
      <ul>
        <li>The file is read on our server to get its text. The file itself is not saved.</li>
        <li>
          The text is sent to Google&rsquo;s Gemini AI service, which picks out the events. Google handles that text
          under its own terms, and may keep it or use it to improve its services.
        </li>
        <li>Only the events that come back are saved to your account.</li>
      </ul>
      <p>
        <strong>
          Do not upload an outline that contains personal information about you or anyone else, such as student
          numbers, phone numbers or grades.
        </strong>
      </p>

      <h2>Who else handles your information</h2>
      <ul>
        <li>
          <strong>Supabase</strong> holds accounts, saved events and settings, and sends the confirmation and
          password-reset emails.
        </li>
        <li>
          <strong>Vercel</strong> hosts the site and counts page views. The counting uses no cookies and does not
          identify you.
        </li>
        <li>
          <strong>Google</strong> receives the text of each outline you upload, as described above.
        </li>
      </ul>
      <p>We do not sell your information or show advertising.</p>

      <h2>Cookies</h2>
      <p>
        The site sets cookies only to keep you signed in. Your browser also remembers that you have dismissed the
        cookie notice. There are no advertising or tracking cookies.
      </p>

      <h2>Who can see your events</h2>
      <p>
        Only you, when signed in. The people who run the site can reach the database to keep it working, and so could
        see saved events and email addresses.
      </p>

      <h2>Deleting your information</h2>
      <ul>
        <li>
          To delete everything, sign in, open <Link className="link" href="/settings">Settings</Link> and choose
          &ldquo;Delete account&rdquo;. This removes your account, events and settings at once and cannot be undone.
        </li>
        <li>
          To delete only your events, choose &ldquo;Remove all events&rdquo; on the same page or on the main page.
        </li>
        <li>Text already sent to Google when you uploaded an outline cannot be recalled by us.</li>
      </ul>
      <p>The site may be switched off when the course ends; accounts and events are deleted when that happens.</p>

      <h2>Contact</h2>
      <p>
        <ContactLine />
      </p>
    </AuthShell>
  );
}
