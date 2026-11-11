import { readFile, extractEvents } from "@/lib/extract";
import { validateUpload, MAX_FILES, MAX_STORED_BYTES } from "@/lib/validate";
import { accountsEnabled, getUser, takeStoredOutline } from "@/lib/account-server";
import { resolveTerm } from "@/lib/polyu-calendar";

export const runtime = "nodejs";
// One outline is given up to 210 s (see lib/extract.js) when the models are busy, so ask the host for longer than its default.
export const maxDuration = 300;

// The Google Cloud credentials live only on the server (process.env.GOOGLE_CREDENTIALS_JSON). Users never see or need them.
export async function POST(request) {
  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    return Response.json({ error: "Server is missing GOOGLE_CREDENTIALS_JSON" }, { status: 500 });
  }
  // Only signed-in students may spend the shared Gemini key. With no account service nobody can be, so refuse.
  if (!accountsEnabled) {
    return Response.json({ error: "Sign-in is not set up on this server." }, { status: 503 });
  }
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Sign in to upload outlines." }, { status: 401 });
  }
  const form = await request.formData();
  // The semester gives the year for dates written without one, and the teaching weeks for "Week 7".
  const term = resolveTerm(form.get("semester"), form.get("weekOne"));
  if (!term) return Response.json({ error: "Choose a semester, or give the Monday of week 1." }, { status: 400 });
  const files = form.getAll("files").filter((f) => typeof f !== "string");
  // A file over the host's request limit arrives as its place in the private storage bucket instead, with its name.
  const stored = form.get("stored");
  if (files.length === 0 && !stored) return Response.json({ error: "No files uploaded" }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `At most ${MAX_FILES} files` }, { status: 400 });

  const loaded = [];
  if (stored) {
    const name = String(form.get("name") || "outline");
    let buffer;
    try {
      buffer = await takeStoredOutline(user, String(stored));
    } catch (err) {
      return Response.json({ error: `${name}: ${err.message}` }, { status: 400 });
    }
    const problem = validateUpload(name, buffer, MAX_STORED_BYTES);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    loaded.push({ name, buffer });
  }
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const problem = validateUpload(file.name, buffer);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    loaded.push({ name: file.name, buffer });
  }

  // One bad file must not discard the events already extracted from the others.
  const events = [];
  const assessmentChecks = [];
  const failed = [];
  for (const { name, buffer } of loaded) {
    try {
      const { text, fromPicture } = await readFile(name, buffer);
      const found = await extractEvents(text, term, { fromPicture, pdf: /\.pdf$/i.test(name) ? buffer : null });
      events.push(...found.events);
      assessmentChecks.push(...found.checks.map((check) => ({ file: name, ...check })));
    } catch (err) {
      failed.push({ file: name, error: String(err.message || err) });
    }
  }
  if (failed.length === loaded.length) {
    return Response.json({ error: failed[0].error, failed }, { status: 500 });
  }
  return Response.json({ events, assessmentChecks, failed });
}
