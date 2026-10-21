// `npm test`: runs every script in scripts/dev/checks and reports one line per file. No Gemini calls are made: the
// real key is replaced by a fake one, and the checks that need a model reply stub it. Exits 1 if anything failed.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const checks = path.join(here, "checks");
const loader = pathToFileURL(path.join(here, "loader", "register.mjs")).href;

let failedFiles = 0;
for (const file of fs.readdirSync(checks).filter((name) => name.endsWith(".mjs")).sort()) {
  const run = spawnSync(process.execPath, ["--import", loader, path.join(checks, file)], {
    encoding: "utf8",
    env: { ...process.env, GEMINI_API_KEY: "stub-not-a-real-key" },
  });
  const output = `${run.stdout}${run.stderr}`;
  const passed = (output.match(/^ok\b/gm) || []).length;
  const failed = (output.match(/^FAIL\b/gm) || []).length;
  const ok = run.status === 0 && failed === 0 && passed > 0;
  console.log(`${ok ? "pass" : "FAIL"}  ${file.replace(/\.mjs$/, "").padEnd(16)} ${passed} passed${failed ? `, ${failed} failed` : ""}`);
  if (!ok) {
    failedFiles++;
    console.log(output.split("\n").filter((line) => !/^ok\b/.test(line)).join("\n"));
  }
}
console.log(failedFiles === 0 ? "\nAll checks passed." : `\n${failedFiles} file(s) had failures.`);
process.exit(failedFiles === 0 ? 0 : 1);
