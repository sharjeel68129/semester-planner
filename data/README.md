# Course assessment dataset

`course-assessments.json` lists, for each PolyU subject we have, how its grade is split. The planner compares an uploaded outline with it and tells the student if they differ. **It only informs: the student's own outline always wins**, because an entry can be out of date.

The dataset is never shown to the AI. Code compares the AI's answer with it afterwards (`lib/reference.js`).

## Two kinds of entry

| `source` | Where it comes from | What it can check |
|---|---|---|
| `"form"` | PolyU's public Subject Description Form, read by `scripts/collect-forms.mjs` | Only the final examination's share against everything else |
| `"outline"` | A real outline for a named semester, typed in by a person | Every row |

Form entries are coarse on purpose. The forms list sub-items without weights in a way that cannot be read reliably, so only the examination row is copied and one row marked `"computed": true` holds the rest.

## Adding an entry by hand from an outline

Copy this, change every value, and add it to the list in `course-assessments.json`:

```json
{
  "code": "COMP1010",
  "aliases": [],
  "title": "Computational Thinking and Problem Solving",
  "rows": [
    { "name": "Quiz 1", "weight": 5, "kind": "coursework" },
    { "name": "Quiz 2", "weight": 5, "kind": "coursework" },
    { "name": "Assignments", "weight": 20, "kind": "coursework" },
    { "name": "Final Examination", "weight": 70, "kind": "exam" }
  ],
  "source": "outline",
  "sourceUrl": null,
  "sourceDate": null,
  "semester": "2026-27-s1",
  "checkedBy": "your name",
  "evidence": "Quiz 1 5% Quiz 2 5% Assignments 20% Final Examination 70%"
}
```

- `rows` must add up to 100. `kind` is `"exam"` for the final examination only; a mid-term or test is `"coursework"`.
- `evidence` is the words copied from the outline. Every row name and every weight (written like `5%`) must appear in it.
- `semester` uses the ids in `lib/polyu-calendar.js`.
- Do not paste anything personal from the outline (names, student numbers, emails).
- An outline entry replaces a form entry for the same code, and the collector never overwrites it.

Then run:

```
npm run check-data
```

It names any entry that breaks a rule. Fix those before committing.

## Collecting forms

```
node scripts/collect-forms.mjs <a folder outside this repository for the PDFs> DSAI COMP
```

Each department lists its forms differently, so a new department needs its own entry in `SOURCES` in the script. Forms that cannot be read with confidence are listed in `forms-not-read.json` with the reason; they are not guessed at. Forms change, so re-collect each academic year.
