import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = path.resolve(import.meta.dirname, "..");
export const PLATFORM = "linux/arm64";

export const containerCommand = (args) => {
  if (args.length === 0) {
    return ["npm", "run", "ci"];
  }
  if (args[0] !== "browser") {
    throw new Error(
      "Use npm run verify, or npm run test:container -- <Playwright arguments>."
    );
  }
  return [
    "sh",
    "-c",
    'npm run build && npm test -- "$@"',
    "playwright",
    ...args.slice(1),
  ];
};

export const buildArguments = (imageFile) => [
  "buildx",
  "build",
  "--platform",
  PLATFORM,
  "--load",
  "--file",
  "Dockerfile.verify",
  "--tag",
  "dyslexia-verify:local",
  "--iidfile",
  imageFile,
  ".",
];

export const runArguments = (image, reports, name, command) => {
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
    `type=bind,source=${reports},target=/app/test-results`,
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

const main = () => {
  const command = containerCommand(process.argv.slice(2));
  requireDocker();
  const name = `dyslexia-verify-${randomUUID()}`;
  const reports = path.join(root, ".cache", "verification", name);
  mkdirSync(reports, { recursive: true });
  const imageFile = path.join(reports, "image-id");
  // GitHub loads the exact image using build-push-action and its layer cache.
  // Local runs build it here; neither path mounts the host's node_modules.
  const image = process.env.VERIFY_IMAGE || buildImage(imageFile);
  const args = runArguments(image, reports, name, command);
  console.log(
    `Verification: ${PLATFORM}, CI=true, fresh container. Reports: ${reports}`
  );
  const started = performance.now();
  try {
    const result = docker(args);
    process.exitCode = result.status ?? 1;
  } finally {
    // Also stop a container if the attached Docker command was interrupted.
    docker(["rm", "--force", name], true);
    rmSync(imageFile, { force: true });
    console.log(
      `Container checks: ${((performance.now() - started) / 1000).toFixed(1)}s.`
    );
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
