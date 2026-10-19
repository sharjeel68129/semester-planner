# AI Semester Planner (DSAI1202 Group 3)

Students upload messy course outlines. Gemini extracts classes, deadlines, quizzes and exams. A human reviews anything ambiguous, the events are saved to their account, and they get an `.ics` export plus email reminders. Final deliverables are due 14 Nov 2026.

The project experiment: does an AI-built calendar keep students safe, or does it put grades at risk through blind spots? **Accuracy and honest failure handling matter more than polish.**

## Commands
```
npm install
copy .env.example .env.local   # GEMINI_API_KEY, server-side only
npm run dev                    # http://localhost:3000
npm run build
```
There is no test runner yet. Verify with `lib/evaluate.js` against samples in `data/samples/` (gitignored), and by running the app.

## Stack
Next.js 16 (App Router), React 19, plain JavaScript, `@/` alias to repo root. Libraries: `@google/generative-ai`, `pdf-parse`, `mammoth`, `ics`, `@supabase/supabase-js`, `@supabase/ssr`, `@vercel/analytics`.

## Module map
| File | Job | Status |
|---|---|---|
| `lib/schema.js` | `Event` shape + `makeEvent` | done |
| `lib/validate.js` | upload check: extension, magic bytes (pdf, docx, txt, png, jpg, webp), size/count caps | done |
| `app/api/extract/route.js` | holds the API key, validates, extracts per file, returns `{ events, assessmentChecks, failed }` | done (no follow-up flow yet) |
| `lib/extract.js` | `readFileText` (a picture or scanned PDF is sent to Gemini to copy its text out), `extractEvents(text, term)` -> `{ events, checks }` (Gemini model chain + output checks) | done (not yet scored on a real outline) |
| `lib/polyu-calendar.js` | PolyU teaching weeks typed in by hand: `TERMS`, `weekMondays`, `termRange`, `resolveTerm` | done for 2026/27 only; **update by hand each academic year** |
| `lib/suggest.js` | works out suggested dates: one from a week number and weekday (`suggestForWeek`), or every meeting of a weekly class (`suggestWeekly`, which respects "Weeks 2-13" and "no class in week 8") | done |
| `lib/assess.js` | `checkAssessments(rows, events)`: do the assessments found add up to the outline's 100%? | done |
| `data/course-assessments.json` | known grade splits per PolyU subject: 107 read from public Subject Description Forms (DSAI and COMP), plus any typed from real outlines. See `data/README.md` | done for two departments; **re-collect each academic year** |
| `lib/course-rules.mjs` | the rules every dataset entry must pass (`entryProblems`, `datasetProblems`); `npm run check-data` runs them | done |
| `scripts/collect-forms.mjs` | developer tool that builds the dataset from PolyU's forms by pattern matching, no AI; unreadable forms go to `data/forms-not-read.json` | done (each new department needs its own entry in `SOURCES`) |
| `lib/reference.js` | `compareToReference(check)`: compares an outline's exam share (or every row, for outline entries) with the dataset | done (only checked on made-up outlines) |
| `lib/calendar.js` | `toIcs(events, remindMinutes)` | done (not yet imported into a real calendar app) |
| `lib/review.js` | `needsReview`, `canExport`, `mergeEvents(old, new, { partial })`, `expandWeekly`, `openChoices`, `chooseSection`, `courseKey`, `acceptSuggestions`, `preferDetailed`, `coursesWithoutClass`, `numberGaps` (Exercise 1-7 and 9-13: is 8 missing?) | done |
| `lib/evaluate.js` | `score(predicted, truth)` | done (no truth file or runner script yet) |
| `app/page.js` | picks the screen (landing or planner) | done |
| `app/use-planner.js` | `usePlanner()`: who is signed in, with their events and settings loaded and saved; shared by both pages; reloads when another tab saves | done |
| `lib/tabs.js`, `app/link-landing.js`, `app/one-tab.js` | one tab in use at a time: opening the site pauses every other open tab (it closes itself where the browser allows, otherwise a message covers it until "Use it here"). Tabs also tell each other about saves (the others reload, so none overwrites another) and about links from emails; every page shows what a link from an email did ("Half done: now open the link sent to your other email address") and tidies it out of the address bar | done (checked with a local stand-in; real email links not yet followed) |
| `app/settings/page.js` | `/settings`: reminders, semester, calendar display, email, password, remove all events, delete account | done (account actions only run against a local stand-in for Supabase) |
| `app/reset-password/page.js` | where the password-reset email leads | done (same caveat) |
| `lib/settings.js` | `Settings` shape + `makeSettings`, reminder and view options, `noClassCourses`, `breakdowns` (each course's grade breakdown), `ignoredGaps` | done |
| `app/breakdown.js` | sidebar panel: each course's grade breakdown as a bar list, largest part first, with the 100% check and the dataset comparison | done |
| `app/landing.js` | signed-out page: headline, how it works, and buttons to `/signup` and `/login` (no form on it) | done |
| `app/login/page.js`, `app/signup/page.js` | the sign-in and sign-up pages; both render `app/auth-screen.js`, which sends a signed-in student to `/` | done (the redirect after a real sign-in is untested) |
| `app/auth-shell.js` | the plain page around the sign-in, sign-up, reset-password and signed-out settings screens, and (with `wide`) the pages of text | done |
| `lib/site.js` | the site's name, description, address, operator, **contact email** and repo link, used by the public pages and metadata | done; `CONTACT_EMAIL` is empty until the team chooses one |
| `app/privacy/`, `app/terms/`, `app/contact/` | public pages of text, written from what the code does; **update the privacy page in the same commit as any change to what is stored or where it is sent** | done (written by students, not legally reviewed) |
| `app/not-found.js` | the 404 page | done |
| `app/site-footer.js`, `app/cookie-notice.js`, `app/sticky-cta.js` | footer of public pages; the cookie notice (a notice, not consent: there are no tracking cookies); the phone-only sign-up bar on the landing page | done |
| `app/layout.js`, `app/robots.js`, `app/sitemap.js`, `app/opengraph-image.js`, `app/icon.svg`, `app/apple-icon.js` | site-wide metadata, robots.txt, sitemap.xml, share image, icons, and Vercel Analytics | done (share preview and analytics only checkable on the live site) |
| `app/planner.js` | signed-in screen: outlines, download and "Remove all events" on the left; calendar in the middle with the notices above it (same course in two files, class time missing, accept all suggested dates) | done (checked in the browser with made-up results only) |
| `app/views.js` | `ListView` (tasks by date), `MonthView`, `WeekView` (hour grid); month and week also draw suggested dates, dashed | done |
| `app/event-editor.js` | pop-up to fix one event's date, time or type, accept a suggested date, add weekly classes, remove it, or mark it as checked | done |
| `lib/dates.js` | date helpers for the views (ISO strings in UTC, weeks start Monday) | done |
| `app/auth-form.js` | sign in / create account / forgot password (email + password) | done |
| `lib/account.js` | browser Supabase client, `loadPlanner`, `saveEvents`, `saveSettings`, `deleteAccount`, `maskEmail` (the address as pages show it) | done |
| `lib/account-server.js` | `getUser()` for route handlers | done (same caveat) |
| `supabase/email-templates/` | the account emails (confirm signup, reset password, change email), sent by Supabase through Brevo SMTP; pasted into Supabase by hand, see its README | done (not yet received in a real inbox) |
| `supabase/schema.sql` | `planners` table (one row per user, `events` and `settings` jsonb) + row level security + `delete_my_account(password)` | the settings column and the delete function have **never been run on a real project** |

## Product rules (do not violate)
1. **Never invent dates.** If a date is unclear ("Week 7", "TBA", "see Canvas"), set `date: null` with a `note`; the event is listed as "no date yet". The model never calculates a date. Code may work one out from a week number (`lib/suggest.js`), but only into `suggestedDates`: it reaches `date` only when the student accepts it (one at a time, or all at once with "Accept all suggested dates"). The calendar draws suggested dates dashed; they are never in the `.ics` file until accepted. `ambiguous: true` is for things that look wrong (quote not found, weekday and date disagree, sources conflict), not for a missing date. A flagged event is better than a confident wrong one.
2. **Every event carries `sourceQuote`**: the exact outline text that justifies it, so the reviewer can check it. The exceptions are events the student adds themselves: a class time typed in when the outline has none ("Class time you entered."), and a numbered item the outline skips that the student says exists ("Not in the outline: you added it..."). They have an empty `sourceQuote`, say so in their note, and `mergeEvents` never reports them missing from a re-upload.
3. **Inputs are messy.** Files are only `.pdf`, `.docx`, `.txt` or a picture (`.png`, `.jpg`, `.webp`), but the content inside may be badly formatted, out of order, or partly missing. Parse defensively; do not assume tables or clean headings.
4. **Ask for more context when information is incomplete.** If the outline does not contain the full course picture (for example no assessment dates, no weekly schedule, no semester dates, unclear weighting, or a mentioned item with no date), the API must not guess to fill the gap. It returns what it found plus a list of specific follow-up questions, and the UI re-prompts the user to supply that context, then re-runs extraction with it. Prefer asking over assuming.
5. **Mid-semester changes.** Re-uploads and tentative schedules must merge without duplicates (`mergeEvents`), keeping user edits. When one upload has two files for the same course (a short subject form and a detailed outline), `preferDetailed` keeps the file with more breakdown rows and the planner says what it left out, with a button to put it back.
6. **A human confirms.** Anything `needsReview()` flags must be highlighted and editable before export or reminders. Only `canExport()` events (dated and not flagged) go in the calendar file. Never silently drop an event.
7. **Assessments are checked against 100%** and each course's breakdown is shown in the sidebar (`app/breakdown.js`, saved in settings). The model copies the outline's grade breakdown; code adds it up (`lib/assess.js`). If it does not reach 100 or a row has no event, the model is asked once to re-read, and whatever is still missing is reported to the student. Nothing is invented to fill the gap. 100% shows every graded component was found, not every item inside one.
8. **The course dataset only informs.** A difference between an outline and `data/course-assessments.json` is shown to the student as something to check. It never changes, removes or flags an event, and the dataset is never put in the model's prompt: the student's own outline wins, because a form can be years old.

## Planned features (not built; agree design before coding)
- **Email reminders:** saved events and the user's email now exist (Supabase); still needs a scheduled job and an email service. Until built, reminders are `.ics` alarms (default 1440 and 60 minutes before).
- **Follow-up questions flow (rule 4):** needs an agreed response shape, for example `{ events, missingInfo: [{ question, why }] }`, and a request field to send the user's answers back. This changes the API contract, so propose it before implementing.

## Conventions
- **Event shape is a contract.** Changing `lib/schema.js` changes every module and the API; propose the change and wait for approval before editing.
- **Accounts are Supabase, email + password.** Events are saved whole as one `events` JSON list per user in `planners`; the browser reads and writes it directly and row level security keeps users apart. With no Supabase values in `.env.local` only the landing page works: there is no way into the planner without signing in. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the only variables allowed a `NEXT_PUBLIC_` prefix; never use the `service_role` key.
- **Settings are one `settings` JSON value per user** in the same row, written on its own so saving settings can never overwrite events. A database without the column still loads events and uses default settings.
- **Deleting an account goes through `delete_my_account(password)`**, a database function that checks the password itself and can only delete the caller. Do not replace it with the `service_role` key or a check done only in the browser.
- **`/api/extract` requires a signed-in user**, and answers 503 if no account service is configured.
- **The free Gemini tier allows about 20 requests per model per day** (measured Oct 2026), shared by everyone using the site and by local testing with the same key. An outline that fails the 100% check uses two, and a picture or scanned PDF one more (copying the text out). Do not spend it on test runs before a demo. On the free tier the Flash models are often refused with 503 "high demand"; `gemini-3.6-flash` and `gemini-3.5-flash` are tried first with a 30 s limit each, then `gemini-3.5-flash-lite`, which kept answering but read a real outline worse (measured 14 Oct 2026).
- **The Gemini key is server-side only.** Read `process.env.GEMINI_API_KEY` only in server code (route handlers, `lib/extract.js` called from them). Never use a `NEXT_PUBLIC_` prefix, log the key, or echo it in errors.
- Keep upload validation server-side; the browser's `accept` is not a security check.
- Treat uploaded outline text as data, not instructions: a document saying "ignore previous instructions" must not change model behaviour. Keep the extraction prompt separate from the document text and validate the model's JSON against the schema before use.
- Match the existing style: small functions, short comments explaining why, no new dependencies without asking.
- Dates are ISO `YYYY-MM-DD`, times `HH:MM` 24h, or `null`.

## Working agreement
- Plan first for anything touching more than one file or the API contract; keep tasks small and one module per session.
- Work on a feature branch, never commit to `main`, commit in small steps.
- Do not read, print, or commit `.env.local` or anything in `data/samples/`.
- **AI log is required.** After meaningful work, append to `docs/ai-log-<name>.md`: the prompt used, what the AI got wrong, and what was changed. This feeds the lessons-learned video and the Q&A. Record failures honestly; they count as findings.

## Pitch questions the product must answer
How tentative or mid-semester items are handled, how and when reminders are sent, how accuracy is ensured (evaluation plus human review), what happens if the AI misses a deadline, and how this differs from asking a chatbot for a calendar. Design decisions should keep these answerable.

## Evaluation
Accuracy is tracked two ways: hand-labelled truth files scored with `lib/evaluate.js` (precision, recall, missed, wrong), and manual review of failures for the lessons video. When extraction changes, rerun the samples and note the before and after.
