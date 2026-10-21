// SPENDS GEMINI QUOTA (1 request per model). Which models answer right now, and how fast. Optional argument: comma-separated model names.
import { createRequire } from "node:module";
const { GoogleGenerativeAI } = createRequire(new URL("../../../package.json", import.meta.url))("@google/generative-ai");
const models = (process.argv[2] || "gemini-3.6-flash,gemini-3.5-flash,gemini-3.8-flash,gemini-3.7-flash").split(",");
const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
await Promise.all(models.map(async (name) => {
  const started = Date.now();
  try {
    const model = client.getGenerativeModel({ model: name, generationConfig: { temperature: 0, responseMimeType: "application/json" } }, { timeout: 60000 });
    const r = await model.generateContent('Return {"ok": true}');
    const u = r.response.usageMetadata || {};
    console.log(`${name}: answered in ${Date.now() - started} ms (in ${u.promptTokenCount}, out ${u.candidatesTokenCount}, thinking ${u.thoughtsTokenCount ?? 0})`);
  } catch (err) {
    const msg = String(err.message || err);
    console.log(`${name}: FAILED after ${Date.now() - started} ms, status ${err.status ?? "-"}: ${/per\s*day|PerDay/i.test(msg) ? "daily quota" : msg.replace(/^.*?]: /, "").slice(0, 260)}`);
  }
}));
