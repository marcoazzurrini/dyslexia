import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildArguments,
  containerCommand,
  PLATFORM,
  runArguments,
} from "./verify.mjs";

const image = `sha256:${"a".repeat(64)}`;

test("default verification runs the complete CI suite", () => {
  assert.deepEqual(containerCommand([]), ["npm", "run", "ci"]);
});

test("focused browser arguments are passed literally after a fresh build", () => {
  assert.deepEqual(containerCommand(["browser", "-g", "restores versioned"]), [
    "sh",
    "-c",
    'npm run build && npm test -- "$@"',
    "playwright",
    "-g",
    "restores versioned",
  ]);
  assert.throws(() => containerCommand(["--skip-tests"]));
});

test("local builds use the shared Dockerfile and native Linux ARM64", () => {
  const args = buildArguments("/tmp/image-id");
  assert.equal(PLATFORM, "linux/arm64");
  assert.equal(args[args.indexOf("--platform") + 1], PLATFORM);
  assert.equal(args[args.indexOf("--file") + 1], "Dockerfile.verify");
  assert.equal(args[args.indexOf("--iidfile") + 1], "/tmp/image-id");
  assert.ok(args.includes("--load"));
});

test("each run uses a disposable container and mounts only browser reports", () => {
  const args = runArguments(image, "/tmp/project reports", "verification", [
    "npm",
    "run",
    "ci",
  ]);
  assert.ok(args.includes("--rm"));
  assert.ok(args.includes("--init"));
  assert.ok(args.includes("--ipc=host"));
  assert.equal(args[args.indexOf("--platform") + 1], PLATFORM);
  assert.equal(
    args[args.indexOf("--mount") + 1],
    "type=bind,source=/tmp/project reports,target=/app/test-results"
  );
  assert.deepEqual(args.slice(-4), [image, "npm", "run", "ci"]);
  assert.throws(() => runArguments("dyslexia:stale", "/tmp", "test", []));
});

test("CI and pre-push use the same runner and container recipe", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf-8"
  );
  const hook = readFileSync(
    new URL("../lefthook.yml", import.meta.url),
    "utf-8"
  );
  assert.match(workflow, /runs-on: ubuntu-24\.04-arm/u);
  assert.match(workflow, /platforms: linux\/arm64/u);
  assert.match(workflow, /file: Dockerfile\.verify/u);
  assert.match(workflow, /run: npm run verify/u);
  assert.match(hook, /pre-push:[\s\S]*run: npm run verify/u);
});

test("the build context denies local files unless explicitly allowed", () => {
  const ignore = readFileSync(
    new URL("../.dockerignore", import.meta.url),
    "utf-8"
  );
  const rules = ignore
    .split("\n")
    .filter((line) => line && !line.startsWith("#"));
  assert.equal(rules[0], "**");
  for (const denied of [
    "!.env",
    "!.local/",
    "!node_modules/",
    "!.pi/",
    "!page.html",
  ]) {
    assert.ok(!rules.includes(denied));
  }
  assert.ok(rules.includes("**/.env"));
  assert.ok(rules.includes("**/*.mp3"));
});
