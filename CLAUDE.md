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
Next.js 14 (App Router), plain JavaScript, `@/` alias to repo root. Libraries: `@google/generative-ai`, `pdf-parse`, `mammoth`, `ics`.

## Module map
| File | Job | Status |
|---|---|---|
| `lib/schema.js` | `Event` shape + `makeEvent` | done |
| `lib/validate.js` | upload check: extension, magic bytes, size/count caps | done |
| `app/api/extract/route.js` | holds the API key, validates, extracts per file | done (no follow-up flow yet) |
| `lib/extract.js` | `readFileText`, `extractEvents` | **stub** |
| `lib/calendar.js` | `toIcs(events, remindMinutes)` | **stub** |
| `lib/review.js` | `needsReview` done, `mergeEvents` | **stub** |
| `lib/evaluate.js` | `score(predicted, truth)` | **stub** |
| `app/page.js` | upload form, review table, download button | table and download are TODO |

## Product rules (do not violate)
1. **Never invent dates.** If a date is unclear ("Week 7", "TBA", no year, "see Canvas"), set `date: null` or `ambiguous: true` with a `note`. A flagged event is better than a confident wrong one.
2. **Every event carries `sourceQuote`**: the exact outline text that justifies it, so the reviewer can check it.
3. **Inputs are messy.** Files are only `.pdf`, `.docx` or `.txt`, but the content inside may be badly formatted, out of order, or partly missing. Parse defensively; do not assume tables or clean headings.
4. **Ask for more context when information is incomplete.** If the outline does not contain the full course picture (for example no assessment dates, no weekly schedule, no semester dates, unclear weighting, or a mentioned item with no date), the API must not guess to fill the gap. It returns what it found plus a list of specific follow-up questions, and the UI re-prompts the user to supply that context, then re-runs extraction with it. Prefer asking over assuming.
5. **Mid-semester changes.** Re-uploads and tentative schedules must merge without duplicates (`mergeEvents`), keeping user edits.
6. **A human confirms.** Anything `needsReview()` flags must be highlighted and editable before export or reminders. Never silently drop an event.

## Planned features (not built; agree design before coding)
- **Accounts and storage:** users log in and their events are saved in a database, so re-uploads can merge with saved events. Choose the auth and DB approach in plan mode first; do not add one unprompted.
- **Email reminders:** needs saved events, the user's email, a scheduled job and an email service. Until built, reminders are `.ics` alarms (default 1440 and 60 minutes before).
- **Follow-up questions flow (rule 4):** needs an agreed response shape, for example `{ events, missingInfo: [{ question, why }] }`, and a request field to send the user's answers back. This changes the API contract, so propose it before implementing.

## Conventions
- **Event shape is a contract.** Changing `lib/schema.js` changes every module and the API; propose the change and wait for approval before editing.
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
