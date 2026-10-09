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
