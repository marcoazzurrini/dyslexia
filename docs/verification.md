# Reproducible verification

Local pre-push and GitHub Actions use `Dockerfile.verify` and `scripts/verify.mjs`. Both run the complete `npm run ci` suite: formatting, lint, script tests, production build, typecheck, and browser tests.

## Daily use

Start OrbStack or Docker Desktop, then run:

```sh
npm run verify
```

The same command runs automatically before a push. It fails if Docker is unavailable; it never silently switches to macOS tests. Normal editing and `npm run dev` remain native. Pre-commit formatting, lint, and typecheck remain native for fast feedback.

To reproduce one browser failure without rerunning unrelated checks:

```sh
npm run test:container -- --project=mobile-webkit -g 'restores versioned'
```

Focused runs still build the current source. They do not replace the full pre-push check. `npm run ci` and `npm test` remain available on the host for investigation, but host results are not the protected verification result.

## What matches CI

- Linux ARM64, without x86 emulation on an Apple Silicon Mac.
- Digest-pinned Ubuntu Noble Playwright image and browser binaries.
- Digest-pinned Node.js 24.20.0 and its npm version.
- Dependencies installed with `npm ci` from `package-lock.json` inside Linux.
- `CI=true`, four Playwright workers, two failure retries, and the same checks.
- A fresh container with no previous build output or application storage.

GitHub uses `ubuntu-24.04-arm` to match the local container architecture. The container image build fails if `.node-version` or `@playwright/test` disagrees with the pinned tools. Update the image references and package versions together when upgrading.

This matches the userspace tools, not every property of the host: kernel versions, available memory, network timing, and load can still differ. Native macOS WebKit and Linux WebKit also do not replace Safari on a physical iPhone. Screen-lock playback, interruptions, and the real narration still need a device test.

## Keeping verification fast

The first run downloads the browser and Node images and installs dependencies. Later runs reuse those Docker layers. The dependency layer changes only when the package manifests, Node version, or hook installer changes; ordinary source edits do not reinstall packages. An npm download cache also speeds dependency updates locally.

GitHub restores and exports BuildKit layers through its Actions cache. It loads the resulting image and passes its exact image ID to the same verification runner. Local builds also run their exact image ID, rather than trusting a mutable tag.

Source and dependencies are copied into the image, so builds run on the Linux filesystem rather than traversing a macOS `node_modules` bind mount. Only test reports are mounted back to the host. Containers are disposable; the image and dependency cache persist. Keep OrbStack running during development to avoid repeatedly starting its Linux VM.

The runner prints separate image-build and check durations. Warm runs still rebuild and test changed code; caching never means reusing a previous passing test result.

## Reports and privacy

Browser traces are retained under `.cache/verification/` on failure. CI uploads them as `browser-failure-traces` for seven days. Open a trace with:

```sh
npx playwright show-trace .cache/verification/<run>/<failed-test>/trace.zip
```

The Docker build context is an allowlist. It excludes `.env`, `.local`, source HTML, generated recordings, host dependencies, Git history, Cloudflare local state, and agent files. No API keys or production audio are needed for verification. The player tests use a synthetic recording and mocked media responses.

No images are published to a registry. Cached build layers in GitHub contain only the allowlisted repository inputs and installed development dependencies.
