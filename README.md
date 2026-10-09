# AI Semester Planner (DSAI1202 Group 3)

Upload course outlines -> AI extracts classes/deadlines/quizzes -> human reviews flagged dates -> export .ics with reminders.
Built with Next.js (JavaScript). The Gemini API key is stored once on the server, so users of the site never need their own.

## Run locally
```
npm install
copy .env.example .env.local     # then put the shared Gemini key in .env.local (ask the leader)
npm run dev                      # http://localhost:3000
```

### Accounts (optional locally)
Without Supabase values in `.env.local` the app runs with no login and saves nothing. To turn accounts on, follow the three steps in `.env.example` (create a Supabase project, run `supabase/schema.sql`, paste two values), then restart `npm run dev`.

## Files
| File | Job |
|---|---|
| `lib/schema.js` | shared `Event` shape (don't change without telling the leader) |
| `lib/extract.js` | read PDF/DOCX/TXT + Gemini prompt -> `Event[]` |
| `lib/calendar.js` | `.ics` export with reminders |
| `lib/review.js` | flag ambiguous events, merge re-uploads |
| `lib/evaluate.js` | score extraction against hand-labelled dates |
| `lib/account.js`, `lib/account-server.js` | login and saved events (Supabase) |
| `supabase/schema.sql` | the database table and its access rules |
| `app/page.js`, `app/auth-form.js` | the web page and the sign-in form |
| `app/api/extract/route.js` | server endpoint that holds the API key |

## Working in git (summary)
1. `git pull`, then `git checkout -b my-feature` (a branch is your own copy of the work)
2. Edit your file, then `git add .`, `git commit -m "what I did"`, `git push -u origin my-feature`
3. On GitHub click "Compare & pull request". A pull request (PR) asks the leader to review and merge your branch into `main`.

You don't need Claude Code: paste your file + `lib/schema.js` + the TODO into ChatGPT/Gemini and ask it to implement the function.

## AI log (everyone, required)
Keep `docs/ai-log-<name>.md`: prompt used, what the AI got wrong, what you changed. This feeds the lessons video and the Q&A.
