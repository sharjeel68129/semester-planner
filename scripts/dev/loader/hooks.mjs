// Lets Node load the project's extensionless relative imports ("./dates") and treats lib files as ES modules,
// so plain Node scripts can import lib/ the way Next does.
const LIB = new URL("../../../lib/", import.meta.url).href;
const TEST_COPY_LIB = new URL("../../../.accttest/lib/", import.meta.url).href;
// Older versions of lib/ unpacked by scripts/dev/study/run-study.mjs, one folder per version.
const STUDY_VERSIONS = new URL("../../../.study-versions/", import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?js$/.test(specifier)) {
    try {
      return await next(`${specifier}.js`, context);
    } catch {}
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith(".json")) return next(url, { ...context, importAttributes: { type: "json" } });
  if (url.startsWith(LIB) || url.startsWith(TEST_COPY_LIB) || (url.startsWith(STUDY_VERSIONS) && url.endsWith(".js"))) {
    return next(url, { ...context, format: "module" });
  }
  return next(url, context);
}
