import Link from "next/link";

/** The two ways in. They lead to their own pages (/signup and /login); the landing page has no form. */
function WaysIn({ className }) {
  return (
    <div className={className}>
      <Link className="hero-cta" href="/signup">
        Create an account
      </Link>
      <Link className="hero-cta hero-cta-quiet" href="/login">
        Sign in
      </Link>
    </div>
  );
}

/** The signed-out page: what the planner does, and buttons to the sign-up and sign-in pages. */
export default function Landing() {
  return (
    <div className="landing">
      <header className="hero">
        <div className="hero-inner">
          <p className="brand">AI Semester Planner</p>
          <div className="hero-columns">
            <div>
              <h1>Every deadline in your course outlines, on one calendar.</h1>
              <p className="hero-lede">
                Upload your outlines and the planner lists each class, deadline, quiz and exam it finds. It never
                guesses a date.
              </p>
              <WaysIn className="ways-in" />
            </div>
            <section className="unclear" aria-labelledby="unclear-heading">
              <h2 id="unclear-heading">When an outline is unclear</h2>
              <dl>
                <div>
                  <dt>&ldquo;Week 7&rdquo;</dt>
                  <dd>Listed with a suggested date, for you to accept or change.</dd>
                </div>
                <div>
                  <dt>&ldquo;TBA&rdquo;</dt>
                  <dd>Listed with no date, so it is not forgotten.</dd>
                </div>
                <div>
                  <dt>&ldquo;30 Oct&rdquo;</dt>
                  <dd>Year taken from your semester dates and marked for checking.</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </header>

      <main>
        <section className="steps" aria-labelledby="steps-heading">
          <h2 id="steps-heading">How it works</h2>
          <ol>
            <li>
              <h3>Upload your outlines</h3>
              <p>PDF, Word or text files, one per course or all at once.</p>
            </li>
            <li>
              <h3>Check what is unclear</h3>
              <p>Anything the AI was unsure of is marked, with the words from your outline beside it.</p>
            </li>
            <li>
              <h3>Use your calendar</h3>
              <p>See it by day, week or month here, or download it with reminders for your own calendar.</p>
            </li>
          </ol>
        </section>

        <section className="account-section closing" aria-labelledby="closing-heading">
          <h2 id="closing-heading">Start with one outline</h2>
          <p className="hint">Your events are saved to your account, so they are still here next time.</p>
          <WaysIn className="ways-in ways-in-light" />
        </section>
      </main>
    </div>
  );
}
