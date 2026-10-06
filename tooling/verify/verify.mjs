import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = path.resolve(import.meta.dirname, "../..");
const PLATFORM = "linux/arm64";

const containerCommand = (args) => {
  if (args.length === 0) {
    return ["bun", "run", "check"];
  }
  if (args[0] !== "e2e") {
    throw new Error(
      "Use bun run verify, or bun run verify:e2e <Playwright arguments>."
    );
  }
  return [
    "sh",
    "-c",
    'cd apps/web && bun run build && bunx playwright test "$@"',
    "playwright",
    ...args.slice(1),
  ];
};

const buildArguments = (imageFile) => [
  "buildx",
  "build",
  "--platform",
  PLATFORM,
  "--load",
  "--file",
  "tooling/verify/Dockerfile",
  "--tag",
  "dyslexia-verify:local",
  "--iidfile",
  imageFile,
  ".",
];

const runArguments = (image, reports, name, command) => {
  if (!/^sha256:[a-f\d]{64}$/u.test(image)) {
    throw new Error(
      "Verification requires the exact image ID returned by the build."
    );
  }
  return [
    "run",
    "--rm",
    "--init",
    "--ipc=host",
    "--cpus=4",
    "--platform",
    PLATFORM,
    "--name",
    name,
    "--mount",
    `type=bind,source=${reports},target=/app/apps/web/test-results`,
    image,
    ...command,
  ];
};

const docker = (args, capture = false) => {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf-8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  return result;
};

const requireDocker = () => {
  const result = docker(["info", "--format", "{{.OSType}}"], true);
  if (result.status !== 0 || result.stdout.trim() !== "linux") {
    throw new Error(
      "Start OrbStack or Docker Desktop and retry. Verification never falls back to host tests."
    );
  }
};

const buildImage = (imageFile) => {
  const started = performance.now();
  const result = docker(buildArguments(imageFile));
  console.log(
    `Verification image: ${((performance.now() - started) / 1000).toFixed(1)}s (cached layers are reused).`
  );
  if (result.status !== 0) {
    throw new Error("Verification image build failed.");
  }
  return readFileSync(imageFile, "utf-8").trim();
};

// The assembler image is built from its own directory, as in production.
const smokeAssembler = () => {
  const build = docker(
    ["build", "--platform", PLATFORM, "--quiet", "apps/assembler"],
    true
  );
  if (build.status !== 0) {
    throw new Error(`Assembler image build failed.\n${build.stderr}`);
  }
  const result = docker([
    "run",
    "--rm",
    "--platform",
    PLATFORM,
    "--network",
    "none",
    build.stdout.trim(),
    "node",
    "smoke.mjs",
  ]);
  if (result.status !== 0) {
    throw new Error("Assembler smoke test failed.");
  }
};

const main = () => {
  const args = process.argv.slice(2);
  const command = containerCommand(args);
  requireDocker();
  const name = `dyslexia-verify-${randomUUID()}`;
  const reports = path.join(
    root,
    "node_modules",
    ".cache",
    "verification",
    name
  );
  mkdirSync(reports, { recursive: true });
  const imageFile = path.join(reports, "image-id");
  // GitHub loads the exact image using build-push-action and its layer cache.
  // Local runs build it here; neither path mounts the host's node_modules.
  const image = process.env.VERIFY_IMAGE || buildImage(imageFile);
  console.log(
    `Verification: ${PLATFORM}, CI=true, fresh container. Reports: ${reports}`
  );
  const started = performance.now();
  try {
    const result = docker(runArguments(image, reports, name, command));
    process.exitCode = result.status ?? 1;
  } finally {
    // Also stop a container if the attached Docker command was interrupted.
    docker(["rm", "--force", name], true);
    rmSync(imageFile, { force: true });
    console.log(
      `Container checks: ${((performance.now() - started) / 1000).toFixed(1)}s.`
    );
  }
  if (process.exitCode === 0 && args.length === 0) {
    smokeAssembler();
  }
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
