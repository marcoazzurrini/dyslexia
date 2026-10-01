# Dyslexia

An audio-first web app for listening to articles, with source-preserving narration and access to original visual content.

## Status

The repository contains a minimal TanStack Start app, an installable web app manifest, and the initial research. The app currently shows an empty home screen and installation guidance. Article import and audio playback are not implemented. No audio has been generated or deployed.

## Local development

Use Node.js 24.20.0, pinned in `.node-version` for local development, GitHub Actions, and Cloudflare Builds.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Build and checks

```sh
npx playwright install chromium webkit
npm run ci
```

`npm run ci` checks formatting and linting, builds the app, checks types, and runs the browser tests. It stops on the first failure. Each check also remains available as an individual npm script.

The build generates TanStack Router's route tree and a prerendered SPA shell. `npm run preview` serves the production build using Cloudflare's local runtime. Browser tests run against this production preview; WebKit emulation does not replace testing on a physical iPhone.

The committed PNG installation icons are generated from `public/icon.svg`. After changing the SVG, regenerate them with `npm run icons` (requires the Playwright Chromium browser).

## Formatting, linting, and Git hooks

Oxfmt uses Ultracite's formatting preset. Oxlint uses Ultracite's core, React, and built-in anti-slop presets. Generated route code and the package lockfile are excluded from formatting; generated route code is also excluded from linting.

```sh
npm run format
npm run lint
npm run lint:fix
```

Lefthook installs Git hooks through the `prepare` script during `npm install` or `npm ci`. To reinstall hooks manually, run `npm run prepare`.

- **Pre-commit:** format staged files and re-stage formatter changes, lint staged code, then typecheck the entire project. Jobs run sequentially and stop on failure, so checks see the formatted files.
- **Pre-push:** build the app and run the browser tests against the fresh production build. Install Chromium and WebKit with the command above before pushing.

Fully stage files before committing. Formatting operates on working-tree files and re-stages them, so partial staging is not preserved for files the formatter processes.

## PWA installation

The app includes a manifest, standalone display mode, standard installation icons, and an Apple touch icon. It intentionally has no service worker or offline cache in this first version.

For installation testing, serve the app over HTTPS. On iPhone, open the URL in Safari and choose **Share > Add to Home Screen**. A phone visiting a laptop's local HTTP address is not the same as using a deployed HTTPS app.

## Cloudflare deployment

Production URL: <https://dyslexia.marcoazzurrini.com>.

The custom domain is declared in `wrangler.jsonc` so Git deployments preserve it. Cloudflare manages its DNS record and HTTPS certificate. The `workers.dev` URL remains available as a fallback.

The Cloudflare Vite plugin and `wrangler.jsonc` configure Workers and Static Assets. No database or external storage binding is configured.

### Pull requests and GitHub Actions

Work on a short-lived branch and open a pull request targeting `main`. `.github/workflows/ci.yml` runs the `checks` job when a pull request opens or changes. It runs formatting, linting, the production build, typechecking, and Chromium/WebKit browser tests. A newer update cancels the older run. Manual checks remain available through GitHub Actions.

GitHub protects `main`: pull requests and a successful `checks` result from GitHub Actions are required, and the branch must be up to date before merging. These requirements apply to administrators too. Direct pushes, force pushes, and deleting `main` are blocked. No human approval is required for this solo-maintained project.

Prefer small pull requests and squash merges. GitHub Actions does not deploy and does not repeat the full suite after merging. CI checks need no Cloudflare credentials.

### Cloudflare Git integration

Cloudflare Workers Builds connects `marcoazzurrini/dyslexia` to the `dyslexia` Worker in the account configured in `wrangler.jsonc`. The Worker serves the application and its static assets; no D1 database, R2 bucket, or other storage resource is needed yet.

The production build settings are:

- Production branch: `main`.
- Root directory: `/`.
- Node.js: `24.20.0`, matching `.node-version` and GitHub Actions.
- `SKIP_DEPENDENCY_INSTALL=1`: dependency installation is explicit in the build command.
- Build command: `npm ci && npm run build && npm run typecheck`.
- Deploy command: `npm run deploy:only`.
- Build watch paths: `*`, with no exclusions.
- Non-production branch builds: disabled.

After a checked pull request merges, Cloudflare builds the new `main` revision and deploys only if that build succeeds. A failed build leaves the existing production release unchanged. The full browser suite runs before merging rather than again inside Cloudflare. Cloudflare manages deployment authentication; no Cloudflare API token is stored in GitHub.

Saved Cloudflare build settings and GitHub branch protection are external configuration. Repository edits alone do not change them. Keep the dashboard settings aligned with these commands when changing the toolchain.

### Manual deployment

When ready to deploy locally:

```sh
npx wrangler login
npx playwright install chromium webkit
npm run deploy
```

`npm run deploy` runs the same CI checks before deploying. `npm run deploy:only` skips checks and building; Cloudflare runs it only after the configured production build succeeds. Use Git integration for ordinary releases rather than bypassing the pull request workflow with a manual deployment.

Deployment creates or updates the Worker named `dyslexia` in the authenticated Cloudflare account. Deployment is not part of local development or the test suite.

## First playback test

The first iteration uses one reviewed article excerpt and a pregenerated MP3 to test playback on an iPhone, both in Safari and as an installed web app.

The test covers:

- Playback, seeking, and speed controls.
- Continued listening with the screen locked.
- Supported lock-screen and headset controls.
- Playback interruptions and resume behavior.
- Locally saved position and speed.
- Access to the source article and relevant visuals.

URL imports, a library, offline downloads, and cross-device synchronization are outside this initial test.

## Stack

- TanStack Start, React, and TypeScript.
- Cloudflare Workers and Workers Static Assets for deployment.
- Browser-native audio playback, with Media Session enhancements where supported.
- Local browser storage for playback position and speed.
- Fish hosted TTS for pregenerating the audio fixture outside the browser.

The first test does not require a database or TanStack Query. Cloudflare is the intended deployment target. The deployed recording's seeking behavior still needs verification once an audio fixture is available.

## Research and design

- [Audio content preparation: evidence review](docs/research/audio-content-preparation.md)
- [First playback test: technical proposal](docs/research/first-playback-test.md)

## Secrets and media

Keep API keys in local environment files, never in browser bundles or committed files. The `.gitignore` excludes local secrets, agent sessions, build output, and generated audio.

Generated audio fixtures must be supplied separately during development and deployment. Publishing application source does not grant permission to redistribute source articles or generated recordings.
