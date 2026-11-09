// Makes .accttest/: a copy of the app that signs in against the local stand-in (mock-supabase.mjs) instead of the
// real Supabase, with fake Google Cloud credentials. Run it again after changing app/ or lib/, then restart its dev server.
//
//   node scripts/dev/test-copy.mjs            copy as it is (uploads would fail: the credentials are fake)
//   node scripts/dev/test-copy.mjs --canned   uploads return fixed results instead (scripts/dev/canned-extract.js)
//
// .accttest/ is in .gitignore. Its .env.local holds test values only, never the real keys.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const copy = path.join(root, ".accttest");

fs.rmSync(copy, { recursive: true, force: true });
fs.mkdirSync(copy);
for (const name of ["app", "lib", "data", "jsconfig.json", "next.config.mjs", "package.json"]) {
  fs.cpSync(path.join(root, name), path.join(copy, name), { recursive: true });
}
fs.writeFileSync(
  path.join(copy, ".env.local"),
  'GOOGLE_CREDENTIALS_JSON={"type":"service_account","client_email":"test@example.test"}\n' +
    "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54399\nNEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key\n",
);
if (process.argv.includes("--canned")) {
  fs.copyFileSync(new URL("./canned-extract.js", import.meta.url), path.join(copy, "lib", "extract.js"));
}
console.log(`Made ${copy}${process.argv.includes("--canned") ? " with canned extraction" : ""}.`);
console.log("Next: node scripts/dev/mock-supabase.mjs   and   npx next dev .accttest -p 3111");
