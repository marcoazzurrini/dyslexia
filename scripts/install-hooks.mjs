import { spawnSync } from "node:child_process";

// CI and verification containers do not need Git hooks or a .git directory.
if (process.env.CI !== "true" && process.env.LEFTHOOK !== "0") {
  const result = spawnSync("lefthook", ["install"], { stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
  }
  process.exitCode = result.status ?? 1;
}
