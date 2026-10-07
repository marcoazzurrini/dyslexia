import { statSync } from "node:fs";

// Cloudflare rejects a deploy when Worker startup takes too long, and only
// the deploy itself measures that. Code in the entry module runs at startup,
// so keep heavy server code in modules loaded on demand (see src/worker.ts).
const LIMIT_BYTES = 2 * 1024 * 1024;
const entry = new URL("../dist/server/index.js", import.meta.url);
const { size } = statSync(entry);
if (size > LIMIT_BYTES) {
  console.error(
    `dist/server/index.js is ${(size / 1024 / 1024).toFixed(1)} MB, over the ${LIMIT_BYTES / 1024 / 1024} MB startup budget. Load heavy modules with import() on first use.`
  );
  process.exitCode = 1;
}
