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

## 2026-10-09: one file per request, sign-in required, 4 MB limit

**Tool:** Claude Code (Opus 5.5). Branch `feature/stubs`, not committed.

**What I asked**

"make it a file at a time", "i saw that i can access planner without signing up. fix that", "limit file size to 4 MB".

**What changed**

- The page now sends each outline in its own request and shows "Reading 2 of 3: name". Events from all files are merged once at the end, so two outlines for one course are not treated as an old and a new version. A file that fails is listed on its own.
- The "Open the planner" button for servers with no account service is gone. Without the Supabase values the site shows only the landing page and a "Sign-in is not set up yet" note, and `/api/extract` answers 503. **This means the app cannot be used locally until Supabase is set up.**
- Files over 4 MB are refused, in the browser before upload and again on the server (`lib/validate.js`).

**What the AI got wrong**

- The earlier design let anyone into the planner when accounts were not configured. It had described this as a decision for the team; I had not agreed to it.

**How it was checked**

- Three files through the real app with live Gemini calls (before sign-in was made compulsory): three separate requests, the broken PDF skipped alone, events from the other two shown.
- With the fake Supabase: signed out shows no planner and no way in; create account opens it; a 5 MB file was skipped without being sent, and the server also refused it with "larger than 4 MB"; sign out returns to the landing page.

**Not checked**

- Real Supabase, and the deployed site.

## 2026-10-11: stage 1 of the extraction rework (100% check, date suggestions, model chain)

**Tool:** Claude Code (Opus 5.5). Branch `feature/suggested-dates`, not committed.

**What I asked**

After a real COMP1010 outline came back as 13 events, all undated and all flagged: go back to planning. Then, in order: suggest dates but let me confirm them; build the PolyU calendar in (13 teaching weeks, Monday to Sunday); use `gemini-3.8-flash` with Gemini-only fallbacks; and "make it so gemini checks assessments and completes the 100% instead of flagging everything".

**What changed**

- **The Event shape changed (contract change, approved in the plan).** Three optional fields: `suggestedDates`, `choice` (not used until stage 2) and `weight`. Old saved events load unchanged.
- **100% check.** Gemini copies the outline's grade breakdown; code adds it up (`lib/assess.js`). If it is not 100 or a row has no event, Gemini is asked once more, then the gap is shown to the student. Nothing is invented to reach 100.
- **Flagging rule.** A missing date no longer flags an event. Flags are for things that look wrong. Undated events show as "No date yet" and stay out of the calendar file until they have a date.
- **Date suggestions.** For "Week 7, Tue" the model copies the week and weekday; `lib/suggest.js` works out the date from `lib/polyu-calendar.js` (2026/27 only, typed in by hand). The date is a button in the editor and only becomes the event's date when pressed.
- **Model chain.** `GEMINI_MODELS` replaces `GEMINI_MODEL`: 3.8, 3.7, 3.6, 3.5 flash in order.
- The upload form asks for a semester, not two dates. `/api/extract` now returns `assessmentChecks` as well.

**What the AI got wrong**

- **No time limit on a model call.** The first live run hung for over six minutes with no output. Added a 40 second limit per model.
- **The chain as planned was too slow.** With the limit in place, one outline still took about four and a half minutes on a bad day (3.8 and 3.7 timed out twice each before 3.5 answered). The plan said a busy model "comes back in about a second"; that was true on 9 Oct and false today. Added an overall limit per outline (150 s for the first answer, 210 s in all), and a model that fails is skipped for five minutes.
- **"Lab participation 10%" was typed as a class**, and my check refused to let a class cover a breakdown row, so a correct result was reported as incomplete. Removed that restriction and told the model to emit such a row as an undated deadline.
- **A network error ("fetch failed") failed the whole file** without trying the next model. It now moves on.
- Notes from the model and from the code ran together without a full stop.
- Accepting a suggested date does **not** clear an unrelated flag, which differs from the plan ("marks the event checked"). An event flagged for another reason still needs "Mark as checked".

**How it was checked**

- 34 checks on the pure code: the three terms' week dates, week 13 against the calendar's "teaching ends", suggestions across the Lunar New Year break, missing weekday, an outline date that disagrees with the calendar, the 100% arithmetic, and re-upload merging.
- Four made-up outlines through the real Gemini call:
  - breakdown with "Continuous Assessment 40%" and "Examination 60%" headings: 100%, no heading events, four suggestions, nothing flagged (answered once by 3.8, once by 3.6);
  - an item only in the breakdown (participation): 100% after the fix above;
  - a breakdown adding to 90: reported as 90, nothing invented, second look made;
  - no breakdown, written dates: dates kept, "no grade breakdown" reported.
- Screens looked at in the browser through a temporary page with sample events and a canned server reply (since deleted): "Date suggested" and "No date yet" labels, the "Use Tue, 22 Sept 2026" button, the download count going from 1 to 2 after accepting, the three kinds of 100% line, the "Other" semester field. `next build` passes.

**Not checked**

- **The real COMP1010 outline.** Every result above is from outlines I wrote myself, which are far tidier than a real one.
- The signed-in path end to end (sign in, upload, real Gemini, save). The screens were checked without signing in.
- The model that answers varied between runs (3.8, 3.7, 3.6, 3.5), and one of them missed a weekday another caught. Scores from different runs are not comparable unless the log line naming the model is recorded.
- Whether Vercel allows the 300 second limit the route now asks for on our plan.
- `score` on a hand-labelled truth file: still not done.
- The calendar dates in `lib/polyu-calendar.js` have not been checked by a second person against the PDF.

## 2026-10-11: stage 2 (weekly classes, choosing a section, removing an event)

**Tool:** Claude Code (Opus 5.5). Branch `feature/suggested-dates`, on top of stage 1 (`09c5577`), not committed.

**What I asked**

"approve. commit and start stage 2".

**What changed**

- **Weekly classes.** A class like "Lab S02 Thu 12:30" gets every Thursday in the teaching weeks as suggested dates, with holidays left out and named in the note. "Add 12 weekly classes" in the editor turns the one undated event into 12 dated ones.
- **Sections.** Gemini gives alternative sections of one class a shared `choice` label. A box above the calendar asks which one is yours; the others are removed. "Keep them all" is there for a student in none or several.
- **Remove this event** in the editor, behind a confirmation.
- Re-uploading an outline does not bring back the sections you did not choose, and does not flag the expanded weekly classes as "not found".

**What the AI got wrong**

- My first version cleared the section label when a weekly class was expanded. Expanding before choosing would have left the other sections with no question to answer. Caught by a check I wrote before running it; the label is now kept until the student chooses.
- Without a change to `mergeEvents`, a re-upload would have re-added the dropped sections and flagged 11 of 12 expanded classes as missing. Found by reasoning through the merge, then covered with checks.

**How it was checked**

- 47 checks on the pure code (13 new): Monday classes in Semester 1 skip 19 Oct, Semester 2 Mondays skip the Lunar New Year week and two holidays, expanding, choosing, "keep them all", and re-upload after choosing.
- The made-up COMP1010 outline through real Gemini (answered by `gemini-3.7-flash`): two lectures labelled "COMP1010 Lecture", three labs labelled "COMP1010 Lab", 12 or 13 weekly dates each, assessments unchanged at 100%.
- In the browser through a temporary page (since deleted): both choice boxes; choosing Lab S02 removed S01 and S03; "Add 12 weekly classes" made 12 dated rows and the download count went from 1 to 13; removing one class made it 12.

**Known limits**

- **A removed event comes back if the same outline is uploaded again.** The app does not remember removals. The confirmation says so.
- Removing all sections of a group and re-uploading brings them all back and asks again.
- Each expanded class carries the same note about the whole series.
- Make-up classes and one-off room or time changes are not known.
- Only the list of no-class days I typed from the calendar is skipped; it has not been checked by a second person.
- Still not run on a real outline, and still not checked signed in end to end.

## 2026-10-11: stage 3 (settings page, forgot password, email change, account deletion)

**Tool:** Claude Code (Opus 5.5). Branch `feature/settings`, on top of stage 2 (`42a32ef`), not committed.

**What I asked**

"make the settings page" (all four groups, saved with the account), then "add email change and forgot password and account deletion", then "deletion of account must ask for password".

**What changed**

- `/settings`: reminders (six tick boxes), semester, default view, week starting Monday or Sunday, change email, change password, remove all events, delete account.
- Settings are saved in a new `settings` column, separately from events.
- "Forgot password?" on the sign-in form, and a `/reset-password` page for the emailed link.
- Deleting an account needs the password, and **the database checks it**, not only the page (`delete_my_account` in `supabase/schema.sql`).
- The upload form shows the semester from Settings with a "Change" link. "Remove all events" moved to Settings. The chosen view is no longer remembered per browser; the default is a setting.

**What the AI got wrong**

- The settings page was first squeezed into the 21rem sidebar column, because the page layout is a two-column grid. Seen in a screenshot and fixed.
- The first design of the reset page would have used the one-time code as soon as the page opened. Email scanners open links before the person does, which would spend the code. It is now only used when the form is submitted.
- If the live database does not have the new column, the first version would have failed to load anyone's events. It now falls back to loading events alone and says settings cannot be saved.

**How it was checked**

Against a small stand-in for Supabase that I wrote and ran locally, in the browser:

- changed every setting, reloaded, all kept; the planner opened in Week view starting Sunday with the new reminders and semester shown;
- password change with mismatched entries refused; with matching entries accepted; the old password then refused at sign-in;
- email change shows "confirmation link sent" and keeps the old address;
- forgot password: link requested, code not used on page load, new password set, code spent;
- delete with a wrong password: "Nothing was deleted", account still there; with the right password: account and saved row gone, back at the landing page, sign-in refused;
- a database without the settings column: planner loads, changing a setting reports it could not be saved.

**Not checked: everything about real Supabase**

- **The stand-in behaves the way I believe Supabase does. It proves the screens, not the service.**
- **The `delete_my_account` SQL has never been run.** It assumes Supabase keeps passwords as bcrypt hashes that `extensions.crypt()` can check. If that is wrong, the likely failure is that the right password is refused, not that an account is deleted without one. The first live test must try a wrong password first.
- Real emails (reset and email change), the reset email template change, and redirect URLs.
- Supabase's built-in email sender allows only a few emails an hour.
- Whether saving settings on a real database leaves events untouched (it relies on an upsert updating only the columns sent).

## 2026-10-11: sign-in and sign-up on their own pages

**Tool:** Claude Code (Opus 5.5). Branch `feature/login-page`, not committed.

**What I asked**

"change the landing page. sign up or login buttons redirects to sign up login page".

**What changed**

- The landing page has no form now. "Create an account" goes to `/signup` and "Sign in" goes to `/login`, in the header and again at the bottom.
- `/login` and `/signup` are plain pages with the form. "Forgot password?" is on `/login`. Once signed in, either page sends you to the planner.
- The reset-password page and the signed-out settings page use the same plain layout.
- Landing page wording for "Week 7" updated: it now gets a suggested date.

**How it was checked**

- In the browser, signed out: the landing page has no form and four links with the right addresses; `/login` and `/signup` show the right form and link to each other; `/settings` asks you to sign in; `/reset-password` shows its form. `next build` passes.

**Not checked**

- **Signing in or creating an account on the new pages**, and the redirect to the planner afterwards. That needs a real account, which the AI does not enter.
- The email-confirmation link after sign-up, which returns to the home page.

## 2026-10-11: the "20 things that make a site real" checklist

**Tool:** Claude Code (Opus 5.5). Branch `feature/site-basics`, not committed.

**What I asked**

I sent a screenshot of a 20-item checklist for finished websites and chose: build everything on it, use Vercel Analytics, and I will give a contact email. Mid-way I asked "no operator name needed?".

**What changed**

- Custom 404 page; a title and description for every page; share image; favicon and phone icon; `robots.txt`; `sitemap.xml`.
- Privacy, Terms and Contact pages, and a footer linking to them from every public page. They name the operator as "DSAI1202 Group 3, a student project at The Hong Kong Polytechnic University" and say it is not an official PolyU service.
- A "Check your email" screen after sign-up; a line under the sign-up button agreeing to the Terms and Privacy pages.
- A cookie notice; a sign-up bar that sticks to the bottom of the landing page on phones.
- Vercel Analytics (one new package, `@vercel/analytics`).

**What the AI said that is worth keeping**

- Of the 20 items, 4 were already done and 1 (alt text) had nothing to apply to because the site has no images. It recommended skipping 6 as marketing-site habits; I chose to build them anyway.
- **The cookie banner is a notice, not a consent form.** The site sets no tracking cookies, so there is nothing to consent to and the banner adds no legal protection.
- The privacy and terms pages describe what the code does. They were written by an AI and students, not a lawyer.

**What the AI got wrong**

- It left out who operates the site until I asked. A privacy page that does not say who holds the data is missing its most basic fact.
- The cookie notice was 129px tall on a phone at first (the button wrapped under the text). Fixed to sit beside it.

**How it was checked**

- `next build` lists all the new routes. Fetched each page for its title and description, a made-up address for the 404 (status 404), `robots.txt`, `sitemap.xml`, the share image (PNG, 1200 by 630) and both icons.
- In the browser: the share image looked at; cookie notice appears, "OK" hides it and it stays hidden after reload.
- At phone width (375px): landing page, sign-up, the "Check your email" screen and the planner looked at, none overflow; the sign-up bar appears only after the header buttons scroll away, and the cookie notice sits above it.
- "Check your email" was reached through a local stand-in for Supabase with email confirmation on.

**Not checked / open**

- **No contact email yet.** The pages show "[Contact email to be added before this site is shared.]". Not to be pushed as final until it is filled in (`lib/site.js`).
- **Item 20 of the checklist** was cut off in the screenshot; unknown.
- **Whether Google keeps outline text sent on the free Gemini tier.** The privacy page says Google "may keep it or use it to improve its services". Someone should confirm this against Google's current terms.
- How the share image looks when the link is pasted into a chat app, and whether analytics counts arrive: both need the live site, and analytics must be switched on in Vercel.
- The Month view on a phone fits, but seven 50px columns leave little room for event names. Not changed.
- On short pages the cookie notice covers the footer links until it is dismissed.

## 2026-10-12: Gemini models reordered for speed; Groq ruled out

**Tool:** Claude Code (Opus 5.5). Branch `fix/model-order`, not committed.

**What I asked**

"why is the process so slow. give me other faster alternatives", then "lets do groq", then "do the reorder".

**What happened**

- Groq cannot be used from here: its website and API both answer "Access denied. Please check your network settings." from my network (Hong Kong). The AI tested this before writing any code. OpenRouter and Mistral were reachable; not pursued.
- The model order is now 3.6, 3.5, 3.8, 3.7 flash (was newest first), because 3.8 and 3.7 often hung for the full 40 second limit.

**How it was checked**

- One made-up outline through real Gemini with the new order: 3.6 answered "busy" after 16 seconds, then 3.5 answered in 15 seconds. About 31 seconds in all, against 100 seconds or more with the old order the day before.

**Not checked**

- One run on one day. Which model is busy changes, so this order may stop being the best one.
- Accuracy now comes mostly from 3.6 and 3.5, not 3.8. No outline has been scored on any of them.
