# Accuracy study runner

Not part of the website. For the DSAI1202 accuracy study (100 + 100 course outlines, scored by hand by the group;
the full method is in the group's study guideline). `run-study.mjs` runs each course's files through the same code
the website uses and writes down what the website would have shown. It scores nothing.

## Folders (all in `study/`, which is in `.gitignore`: outlines and results never go to GitHub)

```
study/
  set-A/C001/<all of that course's files>
  set-A/C004/...
  set-B/C002/...
  results/          the runner writes here
```

One folder per course, named by its permanent Course ID from the scoring workbook (C001 to C200; the random split decides whether it goes in set-A or set-B). Every file a student would upload for that
course goes in its folder: a subject form, an outline, a schedule, an assessment brief, as many as there are. The
runner reads each one and puts them together the way the planner does when they are uploaded together
(`preferDetailed`, then `mergeEvents`). The website takes at most 10 files in one upload, so keep a course to 10.

## Rounds

| Round | Files | Website version |
|---|---|---|
| R1 | set A | `baseline-2026-10-27` (the live site on 27 Oct 2026) |
| R2 | set A | the fixed version's tag |
| R3 | set B | `baseline-2026-10-27` |
| R4 | set B | the fixed version's tag |

```
node --env-file=.env.local --import ./scripts/dev/loader/register.mjs scripts/dev/study/run-study.mjs --round R1 --version baseline-2026-10-27 --in study/set-A --out study/results
```

Every round uses the same `--model` (default `gemini-3.5-flash-lite`). Only scored rounds use a git tag; `--version working`
is for trying things out. A semester 2 course goes in its own run with `--term 2026-27-s2` (same `--round`, same `--out`).

## Output

- `results/R1-events.csv`: one row per event the website would show. Paste into the workbook's "Website Output" sheet.
- `results/R1-runs.csv`: one row per course run: ok, partial (a file failed), failed (nothing read), or retry.

Running the same command again carries on where it stopped. A course Gemini was too busy for, or out of quota for,
is recorded as `retry` with no events and is run again next time: a busy model says nothing about accuracy. A course
whose files cannot be read is `failed`, which is a real result (every item in its answer key is Missed).

The older version's `lib/` is unpacked into `.study-versions/<tag>/` (also ignored by git) and run from there.
