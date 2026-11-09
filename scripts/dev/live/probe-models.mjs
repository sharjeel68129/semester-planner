// SPENDS VERTEX AI REQUESTS (1 per model). Which models answer right now, and how fast. Optional argument: comma-separated model names.
// Signs in the way lib/extract.js does: the service account in GOOGLE_CREDENTIALS_JSON, project and location below.
import { createRequire } from "node:module";
const { GoogleGenAI } = createRequire(new URL("../../../package.json", import.meta.url))("@google/genai");
const models = (process.argv[2] || "gemini-3.8-flash").split(",");
let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || "");
} catch {
  console.log("GOOGLE_CREDENTIALS_JSON is missing or not valid JSON (run with --env-file=.env.local).");
  process.exit(1);
}
const client = new GoogleGenAI({ vertexai: true, project: "project-c9b51bf9-6bb8-4e61-b2b", location: "global", googleAuthOptions: { credentials } });
await Promise.all(models.map(async (name) => {
  const started = Date.now();
  try {
    const r = await client.models.generateContent({ model: name, contents: 'Return {"ok": true}', config: { temperature: 0, responseMimeType: "application/json", httpOptions: { timeout: 60000 } } });
    const u = r.usageMetadata || {};
    console.log(`${name}: answered in ${Date.now() - started} ms: ${r.text} (in ${u.promptTokenCount}, out ${u.candidatesTokenCount}, thinking ${u.thoughtsTokenCount ?? 0})`);
  } catch (err) {
    console.log(`${name}: FAILED after ${Date.now() - started} ms, status ${err.status ?? "-"}: ${String(err.message || err).slice(0, 260)}`);
  }
}));
