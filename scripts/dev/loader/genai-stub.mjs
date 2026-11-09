// Stand-in for @google/genai during `npm test` (hooks.mjs swaps it in when PLANNER_GENAI_STUB is set). The real SDK
// signs in to Google Cloud before every call, which a check cannot fake, so this turns each call into one fetch
// that the checks' own fetch stub answers, in the shape of a Gemini REST reply. No request leaves the machine.
export const Type = { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER", INTEGER: "INTEGER", BOOLEAN: "BOOLEAN" };

/** Every client made, with its options, so a check can see how lib/extract.js set it up. */
export const made = [];
globalThis.__genaiClients = made;

export class GoogleGenAI {
  constructor(options) {
    made.push(options);
    this.models = {
      generateContent: async ({ model, contents, config = {} }) => {
        const { systemInstruction, httpOptions, ...generationConfig } = config;
        const parts = (Array.isArray(contents) ? contents : [contents]).map((part) => (typeof part === "string" ? { text: part } : part));
        const body = {
          contents: [{ role: "user", parts }],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig,
          timeout: httpOptions?.timeout,
        };
        const res = await fetch(`https://stub.invalid/models/${model}:generateContent`, { method: "POST", body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw Object.assign(new Error(JSON.stringify(data)), { name: "ApiError", status: res.status });
        return { text: data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") };
      },
    };
  }
}
