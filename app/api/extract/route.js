import { readFileText, extractEvents } from "@/lib/extract";
import { validateUpload, MAX_FILES } from "@/lib/validate";

export const runtime = "nodejs";

// The Gemini key lives only on the server (process.env.GEMINI_API_KEY). Users never see or need one.
export async function POST(request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "Server is missing GEMINI_API_KEY" }, { status: 500 });
  }
  const form = await request.formData();
  const start = form.get("start");
  const end = form.get("end");
  const files = form.getAll("files").filter((f) => typeof f !== "string");
  if (files.length === 0) return Response.json({ error: "No files uploaded" }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `At most ${MAX_FILES} files` }, { status: 400 });

  const loaded = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const problem = validateUpload(file.name, buffer);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    loaded.push({ name: file.name, buffer });
  }

  const events = [];
  try {
    for (const { name, buffer } of loaded) {
      const text = await readFileText(name, buffer);
      events.push(...(await extractEvents(text, start, end)));
    }
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
  return Response.json({ events });
}
