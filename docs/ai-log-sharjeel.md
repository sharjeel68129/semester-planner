# AI log: Sharjeel

## 2026-10-09: first version of `lib/extract.js`

**Tool:** Claude Code (Opus 5.5). Branch `feature/extraction`.

**What I asked**

I pasted the team's setup checklist and said "do what u can do in order". The relevant step was:
"build the part that reads the file and asks Gemini for the events (lib/extract.js)".

**What it built**

- `readFileText`: `.pdf` via pdf-parse, `.docx` via mammoth, `.txt` as UTF-8. Throws a clear error for a file with no readable text (scanned PDF) or one that cannot be parsed.
- `extractEvents`: sends the rules as a system instruction and the outline as separate user content, asks for JSON, then checks every item before it becomes an `Event`: unknown type, impossible date, date outside the semester, missing date, or a `sourceQuote` that is not word-for-word in the outline all set `ambiguous: true` with a note. Nothing is dropped and no date is corrected.

**What the AI got wrong, and what was changed**

1. **Wrong model name.** It defaulted to `gemini-2.5-flash`, which returned 404 ("no longer available to new users"). Fixed by listing the models our key can use and pinning `gemini-3.8-flash`, overridable with `GEMINI_MODEL`.
2. **No handling of Gemini overload.** The first version made one request. Gemini returned 503 "high demand" on roughly half the test calls. Added two short retries for 503/429. It still fails sometimes after the retries, so the UI needs a "try again" message.
3. **Raw parser errors shown to the user.** A broken PDF produced `bad XRef entry`. Changed to "`<file>`: could not be read (it may be corrupt or password-protected)"; the real error goes to the server log.
4. **Its first error handler hid the reason for failures** (only "Gemini request failed (404)"), which made problem 1 slower to diagnose. Added a server-side log line.

**How it was checked**

Only with made-up test files (one each of `.txt`, `.pdf`, `.docx`), uploaded to `/api/extract` on the dev server. **Not yet checked against a real course outline.**

- 13 of 13 planted items came back with the right type and date or the right flag: "Week 7", "TBA", "during exam period" gave `date: null` and flagged; "30 Oct" with no year gave 2026-10-30 and flagged "year assumed"; weekly lectures gave one flagged class event with no date.
- A line planted in the outline telling the AI to add a fake "Free pizza" event was ignored.

**Open problems / findings**

- Slow: successful calls took 15 to 35 seconds.
- Recurring classes come back as one undated, flagged event. They are not expanded into weekly dates, because that would mean calculating dates the outline does not state (holidays, cancelled weeks). The team needs to decide how classes reach the calendar.
- A hand-built PDF with a broken index parsed fine in plain Node but failed inside Next.js. A normal PDF printed from a browser worked. Slightly damaged real PDFs may be rejected.
- Rule 4 in CLAUDE.md (follow-up questions when information is missing) is not implemented; it changes the API contract and needs agreeing first.

## 2026-10-09: Gemini errors diagnosed, maroon and white page design

**Tool:** Claude Code (Opus 5.5), with the `frontend-design` and `ui-ux-pro-max` skills.

**What I asked**

1. "Review the code base. Tell me why gemini gives me an error."
2. "use /frontend-design and /ui-ux-pro-max to make a maroon and white background design"

**What it found (errors)**

- The key and model name were fine. Calling the API directly, `gemini-3.8-flash` returned 503 "high demand" on 2 of 4 calls, then 4 of 6 (three 503, one 429). In the same run `gemini-3.5-flash` answered 6 of 6. Small sample from one moment.
- Switched with `GEMINI_MODEL=gemini-3.5-flash` in `.env.local` (no code change). **Accuracy on the new model is not yet re-checked.**
- Fixed later the same day, on request ("fix the retry and the one failed file issue"):
  - `withRetry` now waits 2s, 5s, 10s, 20s (five attempts, about 37s of waiting) instead of 2s, 5s. **Not seen working against a real 503**; none occurred during the check. A busy spell now means a wait of up to a minute or more per file before the error shows.
  - `route.js` catches errors per file. The response is now `{ events, failed: [{ file, error }] }`; it is a 500 only when every file fails. **This adds a field to the API response**, so the team should know. The page lists skipped files above the results.
  - Checked by uploading one good `.txt` with one broken `.pdf`: 200, two events, the PDF listed in `failed`. The broken PDF alone: 500 with the same message as before.

**What it built (design)**

- `app/globals.css` (new), `app/layout.js`, `app/page.js`. Maroon panel beside a white work area (stacked on phones), Crimson Pro and Atkinson Hyperlegible through `next/font` (no new dependency).
- The raw JSON dump is replaced by a read-only event list. Rows that `needsReview()` flags get a maroon bar, a "Check this" line with the note, and the source quote. The editable table and `.ics` button are still TODO for their owners.
- 503/429 now show "The AI service is busy right now. Wait a minute, then press the button again." instead of "Gemini request failed (503)".

**What the AI got wrong, and what was changed**

- The `ui-ux-pro-max` dataset recommended a blue and green palette and a marketing-page layout with a product video. Both were ignored: the brief was maroon and white, and this is a tool page, not a landing page. Only its font pairing and flat style were used.

**How it was checked**

In the browser at desktop and 375px widths, with the API response faked (three made-up events), so no Gemini call was made. No horizontal scroll, no console errors. **The loading and error states were not viewed, and it was not checked with a real upload.**

**Still to do (me)**

- Put a real outline in `data/samples/`, hand-write the truth list, upload it, and record misses and wrong dates here.

## 2026-10-09: first real outline (DSAI1202 LEC01), and three fixes

**What I did**

Uploaded `LEC01-compressed.pdf` (semester 19 Aug 2026 to 20 Jan 2027). It returned 14 events. I pasted the output to Claude Code and asked what was wrong, then told it to "make these three" fixes.

**What the AI got wrong on the real outline**

1. **The four graded items had no date.** "Week 7 SAT 11:59pm" (two items), "Week 5 – 13" and "Week 13, lecture time" all came back `date: null`. No date was invented, but the outline does tie weeks to dates elsewhere ("Week 6, Tue (Oct 06)"), and the first prompt banned using that.
2. **All 14 events were flagged**, so the flag told a reviewer nothing. The eight IC visits were flagged only because the year was assumed, even though the stated weekdays match 2026.
3. **False alarm on the two lectures:** "Source quote was not found word-for-word". The model had joined separate table cells into one quote, so the exact-match check failed on a real event.
4. **Both sections and both groups were listed** (LEC007/LEC008, Group A/B). A student attends two of the eight visits. Not fixed; needs a section/group choice in the product.
5. **Weightings add up to 95%** (4 + 6 + 25 + 60). Either an item worth 5% was missed or the outline does not total 100. Still to check against my truth list.

**What was changed**

- **Suggested dates:** when the outline itself gives a week-to-date anchor, the date stays `null` and flagged, but the note says e.g. `Likely 2026-10-17 (Sat), worked out from "Week 7, Wed (Oct 14)"`. The suggestion is the model's arithmetic, so it stays a note for the human, not a date.
- **Quote check** now matches line by line, so a quote stitched from table cells passes if every line is in the outline.
- **Weekday check** (done in code, not by the model): the model reports the weekday the outline states and whether it assumed the year. If the weekday matches the date, the event is not flagged for the year. If it does not match, the event is flagged ("Outline says Thu but 2026-10-14 is a Wed"). An assumed year with no weekday is still flagged.

**How it was checked**

A made-up outline copying the real one's layout: 9 of 9 events behaved as intended, including a planted wrong weekday that was caught. **The real PDF has not been re-run yet**; before and after numbers to add here.

**Still open**

- "Week 13, lecture time" got no suggested date, because the outline does not write a weekday next to it.
- A mistake made by the AI during this session: it ran `npm run build` while `npm run dev` was running, which broke the dev server until it was restarted.

## 2026-10-09: stubs completed (calendar, merge, scoring, review rows)

**Tool:** Claude Code (Opus 5.5). Branch `feature/stubs`, not committed.

**What I asked**

"complete all stubs. but before that. commit this to main on github"

**What it did first**

Committed the design and failed-file work on `feature/extraction`, fast-forwarded `main` to it and pushed. This put the three earlier `feature/extraction` commits on `main` too, and goes against the "never commit to main" working agreement; it was done because I asked for it directly.

**What it built**

- `lib/calendar.js` `toIcs`: skips undated events, one alarm per reminder value, times written as wall-clock time. No time in the outline gives an all-day entry. The id comes from course and title, so exporting again after a date change reuses the same entry.
- `lib/review.js` `mergeEvents`: matches a re-upload to existing events by course and title. Same date: nothing changes. Outline still undated: the student's date is kept. Outline now has a date: it fills the gap. Dates disagree: the old date is kept and the event is flagged with both in the note. An item missing from a new outline for the same course is kept and flagged.
- `lib/evaluate.js` `score`: pairs events by shared title words (at least half), correct only when date and time are identical, null included. Returns precision, recall, missed, wrong.
- `app/page.js`: each row has editable date, time and type, and flagged rows have "Mark as checked". The download button exports only events that no longer need review and says how many are left out.

**Decisions the team should know about (made by the AI, not agreed)**

- Title and course cannot be edited, because they are how a re-upload finds the same event.
- "Mark as checked" sets `ambiguous: false` and `confidence: 1`; there is no separate "confirmed" field, so the Event shape is unchanged.
- Events still needing review are left out of the `.ics` file, not exported with a warning.
- The Event shape has no end time, so timed events are assumed to last 1 hour and deadlines are a 15-minute block starting at the due time.
- All-day events get their reminders counted back from midnight, so "1 hour before" fires at 23:00 the previous day.

**What the AI got wrong, and what was changed**

- The first `toIcs` gave deadlines a zero-length duration, and the `ics` package wrote that as `DURATION:PT`, which is invalid. Caught by printing the file in a test; changed to 15 minutes.

**How it was checked**

- 26 checks in a throwaway Node script with made-up events (not kept in the repo; there is no test runner).
- In the browser with the API faked: marked an event as checked, the download count went from 1 to 2 and the file contained those 2 events; typed a date into an undated quiz; a faked second upload flagged a moved midterm with both dates and kept the typed date.

**Not checked / still open**

- The `.ics` file has not been imported into Google Calendar, Outlook or Apple Calendar, so reminders and the "same entry is updated" behaviour are unconfirmed.
- `score` has not been run on a real outline: there is no truth file and no script that runs extraction and scoring together.
- Events are held in the page only and are lost on reload (accounts and storage are not built).
- If the AI words a title differently on a re-upload ("Assignment 1" then "Assignment 1: Essay"), the merge shows both and flags the old one.

## 2026-10-09: accounts and storage

**Tool:** Claude Code (Opus 5.5). Branch `feature/stubs`, not committed.

**What I asked**

"build accounts and storage". It asked two questions first; I chose Supabase and email + password.

**What it built**

- `supabase/schema.sql`: a `planners` table with one row per user holding the whole `Event[]` as JSON, and row level security so a user can only read and write their own row.
- `lib/account.js`, `lib/account-server.js`, `app/auth-form.js`: sign in, create account, sign out, load and save events.
- `app/page.js`: signed-out visitors see the sign-in form. Signing in loads saved events; every change saves half a second later and shows "Saved to your account." A failed save says so and offers "save again". Added "Remove all events".
- `/api/extract` returns 401 unless signed in, so only account holders can spend the shared Gemini key.
- New dependencies: `@supabase/supabase-js`, `@supabase/ssr`.

**Decisions the team should know about (made by the AI, not agreed)**

- Events are stored as one JSON list per user, not one database row per event. A save replaces the list in one step. The email-reminder job will have to unpack the list to find events by date.
- With no Supabase values in `.env.local` the app still runs, with no login and nothing saved. This keeps teammates without the keys working, but a deployment that forgets the values is open to anyone.
- Two tabs open on the same account: the last one to save wins.
- A change made in the last half second before closing the tab may not be saved.

**What the AI got wrong, and what was changed**

- Its first test setup (a copy of the app on another drive, linked to the project's packages) would not compile. It moved the copy inside the project folder and deleted it afterwards.

**How it was checked**

There is no Supabase project yet, so it was checked against a small fake of Supabase written for the test, running on this machine, with made-up accounts:

- Wrong password shows "Invalid login credentials". Creating an account signs in.
- An upload (extraction faked) was saved; "Mark as checked" was saved; a reload brought the events back.
- With saves made to fail, the page said the changes were not saved and the stored copy stayed unchanged; "save again" then saved them.
- A second account saw no events; signing back into the first showed its events.
- `/api/extract` answered 401 signed out and got past the check signed in.

**Not checked / still open**

- **Nothing has run against real Supabase.** `schema.sql` has never been executed, so the security rules are untested; the fake did not enforce them the way Postgres does.
- Email confirmation, password reset and "forgot password" are not built. If confirmation is on in Supabase, a new user must click the emailed link before signing in.
- `npm install` reported 5 known vulnerabilities in the dependency tree (1 critical); not looked into.

## 2026-10-09: dependency vulnerabilities

**Tool:** Claude Code (Opus 5.5). Branch `feature/stubs`.

**What I asked**

"fix vulnerabilities. commit."

**What it did**

- `npm audit` listed 5 problems: Next.js (critical, many advisories, including remote code execution on Windows-hosted servers), PostCSS inside Next (high), and `sprintf-js` reached through `mammoth` (3 moderate).
- Every Next.js version below 16.4.0 was affected, so it upgraded Next 14 to 16.4.0 and React 18 to 19. That cleared the critical and high ones.
- Two code changes were needed: `cookies()` must now be awaited (`lib/account-server.js`), and `experimental.serverComponentsExternalPackages` is now `serverExternalPackages` (`next.config.mjs`).

**Not fixed**

- The 3 moderate `sprintf-js` findings remain. npm's only offered fix is downgrading `mammoth` to a version from years ago. `sprintf-js` is used by `argparse`, which only mammoth's command-line tool uses; our code calls mammoth as a library, so that path is not reached. This is the AI's reading of the package, not a security review.

**How it was checked**

- `next build` succeeded. The built app was run on a spare port: the page loaded, and uploading one good `.txt` with one broken `.pdf` returned two events plus the PDF in `failed` (a real Gemini call, and proof that PDF parsing still loads under Next 16).
- **Not re-checked after the upgrade:** the sign-in and saving flow, the editable rows, and `npm run dev`.

**Side effects**

- The upgrade stopped the running dev server; it needs `npm run dev` again.
- Next 16 created an `AGENTS.md` file telling AI coding tools to read Next's bundled docs. Left uncommitted for the team to decide.

## 2026-10-09: landing page, calendar views, remaining vulnerabilities

**Tool:** Claude Code (Opus 5.5). Branch `feature/stubs`. Not committed until I approve.

**What I asked**

"make it as a landing page with the headline and stuff. then the login and sign up below it. after login, take them to a place where the left sidebar is for input of info, the middle is a calendar that can be toggled into task list by date, calendar monthly format, or a outlook-calendar weekly style. fix the vulnerabilities. show me the output. when i approve, commit"

**What it built**

- Signed out: a landing page (headline, "When an outline is unclear", "How it works"), with sign in / create account below it.
- Signed in: a top bar, a left sidebar (upload form, calendar file download, save status) and the calendar in the middle with a List / Month / Week switch. Week is an hour grid with an all-day row; overlapping events sit side by side.
- Selecting an event in any view opens a pop-up to change its date, time or type and mark it as checked. This replaced the long list of editable rows.
- Events with no date cannot be drawn on a calendar, so Month and Week say how many there are and link to the list, where they are grouped under "No date yet".
- `npm audit` now reports 0 problems. The last three came from `sprintf-js`, used only by `argparse` inside mammoth's command-line tool; `package.json` now overrides mammoth's `argparse` to version 2, which does not use it.

**Decisions the team should know about (made by the AI, not agreed)**

- With no Supabase values, the landing page shows "Open the planner" instead of the sign-in form, and nothing is saved.
- The chosen view (List / Month / Week) is remembered in the browser, per device.
- The `argparse` override would break mammoth's command-line tool. We do not use it; the library call we do use was re-tested on a `.docx`.
- A recurring class ("Lectures Mon 10:00") is still one undated event, so it does not appear on the Month or Week view.

**How it was checked**

- With the fake Supabase from before and a made-up set of 12 events: landing page, create account, upload (extraction faked), Month view with a "2 more" day, Week view with overlapping and all-day events, List view grouped by date, the pop-up (mark as checked raised the download count from 8 to 9; adding a date to an undated quiz moved it into the calendar), and the save after each.
- No sideways page scroll at phone width in any view.

**Not checked**

- Nothing has run against real Supabase yet.
- No real outline was uploaded through the new screens.
- The Month view at phone width was only checked for overflow, not looked at; seven columns on a phone will be cramped.
- Keyboard-only use and a screen reader were not tried.
