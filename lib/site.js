// Facts about the site itself, shown on the public pages and in search and share previews.

export const SITE_NAME = "AI Semester Planner";
export const SITE_DESCRIPTION =
  "Upload your course outlines and get every class, deadline, quiz and exam on one calendar, with reminders. It never guesses a date.";

// Who runs the site, as named on the privacy, terms and contact pages.
export const OPERATOR = "DSAI1202 Group 3, a student project at The Hong Kong Polytechnic University";

// The address people can write to. Shown publicly. Empty until the team chooses one: the pages then say so plainly.
export const CONTACT_EMAIL = "";

export const REPO_URL = "https://github.com/sharjeel68129/semester-planner";

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL (no "https://") at build time; anywhere else this is a local run.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";
