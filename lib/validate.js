// Server-side upload check: extension allowlist + magic bytes + size cap. Don't trust the browser's `accept`.
// 4 MB: hosts such as Vercel refuse request bodies over about 4.5 MB before our code runs.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 10;

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

const CHECKS = {
  pdf: (buf) => startsWith(buf, [0x25, 0x50, 0x44, 0x46]),
  docx: (buf) => startsWith(buf, [0x50, 0x4b, 0x03, 0x04]),
  txt: (buf) => !buf.subarray(0, 4096).includes(0),
  png: (buf) => startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (buf) => startsWith(buf, [0xff, 0xd8, 0xff]),
  jpeg: (buf) => startsWith(buf, [0xff, 0xd8, 0xff]),
  webp: (buf) => startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString("ascii") === "WEBP",
};

/** Returns an error string, or null if the file is acceptable. */
export function validateUpload(filename, buffer) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!CHECKS[ext]) return `${filename}: only .pdf, .docx, .txt and image files (.png, .jpg, .webp) are allowed`;
  if (buffer.length === 0) return `${filename}: file is empty`;
  if (buffer.length > MAX_FILE_BYTES) return `${filename}: larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`;
  if (!CHECKS[ext](buffer)) return `${filename}: contents do not match a real .${ext} file`;
  return null;
}
