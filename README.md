# AI Semester Planner (DSAI1202 Group 3)

Upload course outlines -> AI extracts classes/deadlines/quizzes -> human reviews flagged dates -> export .ics with reminders.
Built with Next.js (JavaScript). The Gemini API key is stored once on the server, so users of the site never need their own.

## Run locally
```
npm install
copy .env.example .env.local     # then put the shared Gemini key in .env.local (ask the leader)
npm run dev                      # http://localhost:3000
```

## Files
| File | Job |
|---|---|
| `lib/schema.js` | shared `Event` shape (don't change without telling the leader) |
| `lib/extract.js` | read PDF/DOCX/TXT + Gemini prompt -> `Event[]` |
| `lib/calendar.js` | `.ics` export with reminders |
| `lib/review.js` | flag ambiguous events, merge re-uploads |
| `lib/evaluate.js` | score extraction against hand-labelled dates |
| `app/page.js` | the web page |
| `app/api/extract/route.js` | server endpoint that holds the API key |

## Working in git (summary)
1. `git pull`, then `git checkout -b my-feature` (a branch is your own copy of the work)
2. Edit your file, then `git add .`, `git commit -m "what I did"`, `git push -u origin my-feature`
3. On GitHub click "Compare & pull request". A pull request (PR) asks the leader to review and merge your branch into `main`.

You don't need Claude Code: paste your file + `lib/schema.js` + the TODO into ChatGPT/Gemini and ask it to implement the function.

## AI log (everyone, required)
Keep `docs/ai-log-<name>.md`: prompt used, what the AI got wrong, what you changed. This feeds the lessons video and the Q&A.
