// Server-side upload check: extension allowlist + magic bytes + size cap. Don't trust the browser's `accept`.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 10;

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

const CHECKS = {
  pdf: (buf) => startsWith(buf, [0x25, 0x50, 0x44, 0x46]), // %PDF
  docx: (buf) => startsWith(buf, [0x50, 0x4b, 0x03, 0x04]), // zip container
  txt: (buf) => !buf.subarray(0, 4096).includes(0), // no NUL bytes => plain text
};

/** Returns an error string, or null if the file is acceptable. */
export function validateUpload(filename, buffer) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!CHECKS[ext]) return `${filename}: only .pdf, .docx and .txt files are allowed`;
  if (buffer.length === 0) return `${filename}: file is empty`;
  if (buffer.length > MAX_FILE_BYTES) return `${filename}: larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`;
  if (!CHECKS[ext](buffer)) return `${filename}: contents do not match a real .${ext} file`;
  return null;
}
