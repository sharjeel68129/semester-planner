import { readFileText, extractEvents } from "@/lib/extract";

export const runtime = "nodejs";

// The Gemini key lives only on the server (process.env.GEMINI_API_KEY). Users never see or need one.
export async function POST(request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "Server is missing GEMINI_API_KEY" }, { status: 500 });
  }
  const form = await request.formData();
  const start = form.get("start");
  const end = form.get("end");
  const events = [];
  try {
    for (const file of form.getAll("files")) {
      const text = await readFileText(file.name, Buffer.from(await file.arrayBuffer()));
      events.push(...(await extractEvents(text, start, end)));
    }
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
  return Response.json({ events });
}
