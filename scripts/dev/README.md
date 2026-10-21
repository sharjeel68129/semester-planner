# Developer checks and local testing

Nothing here is part of the website. It is how changes were checked during development.

## Logic checks (no Gemini, no accounts)

```
npm test
```

Runs every file in `checks/` and prints one line per file. The real Gemini key is replaced with a fake one, and checks
that need a model reply stub it, so this never uses quota. `loader/` lets plain Node import `lib/` the way Next does.

| File | What it checks |
|---|---|
| `checks/core.mjs` | PolyU calendar, suggested dates, the 100% check, review and merge helpers |
| `checks/weekly-classes.mjs` | a weekly class the model dates only once still gets every teaching week |
| `checks/planner.mjs` | accept-all, same course in two files, the class-time question, settings, merging |
| `checks/reference.mjs` | course dataset rules and the comparison with PolyU's forms |
| `checks/uploads.mjs` | pictures and scanned PDFs, week ranges, file checks, error messages |
| `checks/gaps.mjs` | numbered items with a gap (Exercise 8), saved grade breakdowns |

## Checking screens without the real Supabase

The planner needs a signed-in account. To try it locally without touching the real accounts:

1. `node scripts/dev/mock-supabase.mjs` starts an in-memory stand-in for Supabase on port 54399 (forgets everything when stopped).
2. `node scripts/dev/test-copy.mjs` makes `.accttest/`, a copy of the app pointed at the stand-in with a fake Gemini key.
   Add `--canned` to make uploads return fixed results (`canned-extract.js`): an upload whose text contains `FORM` or
   `OUTLINE` gives AMA1702's short form or detailed outline; anything else gives COMP1010.
3. `npx next dev .accttest -p 3111` runs that copy at http://localhost:3111.
4. `node scripts/dev/seed-mock.mjs` creates the test account (`planner.tester@example.test`, password `mock-pass-1234`,
   both test values for the stand-in only) with events like a real AMA1702 + COMP1010 upload. Then sign in at
   http://localhost:3111/login. Run it again to reset the account's events and settings.

Re-run `test-copy.mjs` after changing `app/` or `lib/`. Delete `.accttest/` when done (it is in `.gitignore`).

## Live checks (spend Gemini quota)

These call the real Gemini with the key in `.env.local`. The free tier allows about 20 requests per model per day,
shared with the live site, so run them sparingly and never right before a demo.

```
node --env-file=.env.local --import ./scripts/dev/loader/register.mjs scripts/dev/live/outlines.mjs
```

| File | Requests |
|---|---|
| `live/probe-models.mjs` | 1 tiny request per model: which models answer right now, and how fast |
| `live/outlines.mjs` | 4 made-up outlines through extraction (up to 2 requests each) |
| `live/reference-outlines.mjs` | 2 made-up COMP1010 outlines, to see the dataset comparison |
| `live/picture-outline.mjs <png>` | 2 (copy the text out, then extract); make a picture with `live/make-picture.mjs <png>` (no Gemini) |
