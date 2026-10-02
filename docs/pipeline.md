# Dynamic narration pipeline

The first dynamic version is a single-user, reviewed pipeline. It uses the existing player and R2 bucket; it does not replace the working demonstration recording.

## Flow

1. Open `/create` and sign in with `PIPELINE_ACCESS_TOKEN`.
2. Submit a public HTTPS article URL. A Cloudflare Workflow starts extraction through the Firecrawl API.
3. Review the extracted Markdown. Edit the title and remove anything that should not be narrated, then explicitly approve adaptation.
4. The OpenRouter SDK requests a full narration adaptation with `openai/gpt-6.1-sol` and medium reasoning. Review and edit the resulting draft.
5. Approve the speech estimate. The ElevenLabs SDK uses `eleven_v4` and the configured voice. At most two chunks are generated concurrently for each job.
6. A Cloudflare Container downloads the saved chunks, assembles them with FFmpeg, checks the output with FFprobe, and uploads the final MP3.
7. Select the completed recording to play it. The existing player retains seeking, speed, device-local progress, and feature-detected system controls.

Closing the browser does not stop a deployed Workflow. Each review gate expires after seven days. The page polls while visible and work is active; it does not overlap slow polling requests.

## Implementation

- `src/pipeline/domain.ts`: Effect Schema contracts and source/chunk validation.
- `src/pipeline/providers.ts`: Effect v4 services and Layers wrapping Firecrawl, OpenRouter, and ElevenLabs.
- `src/pipeline/contracts.ts`: shared runtime schemas and inferred client/server types.
- `src/pipeline/run.ts`: durable steps, review events, artifact reuse, speech batches, and assembly.
- `src/pipeline/api.ts` and `auth.ts`: authenticated submission, approval, status, and media routes.
- `src/pipeline/storage.ts`: R2 job metadata and artifacts. Listing reads are bounded to four concurrent requests and the latest 50 jobs.
- `src/pipeline/cloudflare.ts` and `assembler.ts`: Cloudflare Workflow and Container entrypoints.
- `src/worker.ts`: pipeline routing before the TanStack handler.
- `containers/assembler/`: the Node/FFmpeg image, bounded transfers, and smoke test.
- `src/routes/create.tsx`: login, URL submission, review, progress, and playback selection.

Effect owns typed provider operations and dependency injection. Cloudflare Workflows owns durable orchestration. Effect Schema validates both provider data and browser/API responses; no additional Valibot dependency is needed.

## Configuration

Set these server-side values in the ignored local `.env` and as Cloudflare Worker secrets before enabling production:

- `FIRECRAWL_API_KEY`
- `OPENROUTER_API_KEY`
- `ELEVENLABS_API_KEY`
- `PIPELINE_ACCESS_TOKEN`: your private app password, not a provider key. Sign-in attempts are rate-limited.
- `PIPELINE_SIGNING_SECRET`: a separate server-only key with at least 32 random characters. It signs sessions and assembly permissions; you never enter it in the app.
- `ELEVENLABS_VOICE_ID`: optional; the default is George, as used by the first recording.

Do not use a `VITE_` prefix. Do not place these values in GitHub Actions, source code, browser storage, logs, or committed files. The browser receives an HttpOnly, SameSite=Strict cookie, with Secure enabled over HTTPS; it never receives provider credentials.

Use `npx wrangler secret put NAME` for each secret when preparing a release. Wrangler configuration declares the Workflow and Container resources; deploying creates/updates them. The production Cloudflare Git integration continues to run only after a protected merge to `main`. Container deployment requires Workers Paid and a successful image build.

For local development, keep Docker running and use `npm run dev`. The local Container calls back through `host.docker.internal`. Local development with real keys can incur provider charges when you submit and approve jobs.

## Billing and recovery

Extraction begins when a URL is submitted and may consume Firecrawl credits. Adaptation starts only after source approval and consumes OpenRouter credits. Speech starts only after narration approval.

The speech estimate uses $0.08 per 1,000 characters. It excludes extraction, adaptation, taxes, voice surcharges, and plan-specific pricing. The approval limit guards this estimate, **not the provider's final invoice**. Configure provider account limits for a hard spending cap.

Source selection and speech plans are pinned before paid results can be reused. Published recording objects cannot be overwritten by a late assembly upload.

Paid SDK calls and their Workflow steps have automatic retries disabled. ElevenLabs requests have a 180-second SDK timeout; the surrounding Workflow step allows five minutes. A timeout does not prove that the provider did not charge for a request.

Before each paid operation, an atomic R2 intent is created. A saved output is reused. An unfinished intent prevents another paid attempt, even if a Workflow is restarted. Failed/uncertain jobs retain their artifacts and explain the billing uncertainty. Recovery from an uncertain paid operation currently requires operator inspection; there is intentionally no blind retry button.

Speech batches wait for both in-flight requests to settle before starting another batch. Assembly may retry because it uses existing audio rather than generating paid speech. Its callbacks use short-lived, job-scoped authorization rather than provider keys.

## Limits and privacy

- Public HTTPS sources only; local/private addresses and embedded URL credentials are rejected.
- Selected source: up to 80,000 characters. Approved narration: up to 100,000 characters and 40 chunks.
- The API checks a limit of five active jobs among recent jobs. This is a single-user safeguard, not an atomic multi-tenant quota.
- Extraction is not guaranteed for paywalls, anti-bot challenges, or arbitrary interactive pages. This version does not run an autonomous extraction agent.
- New source text, drafts, and recordings require the app session. The original demonstration recording remains publicly reachable.
- Once audio has been delivered, browser buffering/caching cannot be treated as revocable access.
- Offline downloads, cross-device progress, account management, and automated uncertain-request recovery are not implemented.

## Verification

`npm run verify` is the shared local pre-push and GitHub CI entrypoint. It runs the application checks in the pinned verification image, then builds the assembler image and runs its real FFmpeg smoke test in a fresh, network-isolated container. Docker layers are reused; running test containers are not reused.

The application verification container disables local Container startup to avoid Docker-in-Docker. This affects development emulation only, not production bindings. Provider tests inject fake services; browser tests intercept pipeline endpoints. No real provider keys or credits are used by automated tests.

Additional commands:

```sh
npm run test:scripts
npm run test:container -- tests/pipeline.spec.ts
npm run test:assembly:container
```

Mocks and a local FFmpeg smoke test do not establish that deployed Cloudflare bindings and live provider accounts work together. After deployment, use a short article for an explicitly approved end-to-end run. Physical iPhone background and screen-locked playback remains a separate manual check.
