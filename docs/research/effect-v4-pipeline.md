# Effect v4 for the dynamic narration pipeline

Research snapshot: 2026-10-02. This is an implementation plan, not a deployed pipeline.

## Selected stack

- Firecrawl's HTTP API for extraction; no CLI or browser process in the Worker.
- `@openrouter/sdk` for adaptation with `openai/gpt-6.1-sol`, medium reasoning.
- `@elevenlabs/elevenlabs-js` for speech with `eleven_v4`.
- Effect v4 for typed operations, dependency injection, errors, cancellation, resource management, and testing.
- Cloudflare Workflows for durable orchestration and recovery between steps.
- R2 for source artifacts, narration drafts, audio chunks, and completed recordings.
- A Cloudflare Container for FFmpeg assembly, not for every API call.

The same application operations can be called by a local Node script and by individual Workflow steps. This does not require an autonomous agent framework.

## Versions verified

The npm registry currently reports these stable releases:

| Package                     | Version  |
| --------------------------- | -------- |
| `effect`                    | `4.0.0`  |
| `@effect/platform-node`     | `4.0.0`  |
| `@openrouter/sdk`           | `1.4.18` |
| `@elevenlabs/elevenlabs-js` | `2.70.0` |

Effect v4 is now stable. Older beta articles sometimes refer to `ServiceMap`; current v4 uses `Context.Service`. Do not copy v3 examples using `Context.Tag` or `Effect.Service`, or install the older `beta` tag accidentally. Pin exact initial versions and review upgrades.

`@effect/platform-node` belongs in the local CLI and container implementation, not in the Worker entrypoint.

## Idiomatic Effect design

### Keep the domain small

Start with a few actual capabilities:

- `Extractor`: get a structured source document from a URL.
- `NarrationAdapter`: turn a selected source document into a complete narration draft.
- `SpeechGenerator`: generate one identified audio chunk.
- `ArtifactStore`: persist artifacts and retrieve existing results.
- `AudioAssembler`: assemble an ordered list of chunk references.

Use plain functions for pure transformations such as hashing, text normalization, chunk planning, and manifest construction. Do not create a service for every helper.

### Services and layers

Define service contracts with `Context.Service`. Resolve SDK clients and configuration while constructing their live implementations through `Layer`; service methods should generally not require callers to provide those construction dependencies again.

Provide the live layer graph at the execution boundary. Tests provide fake implementations instead of calling external providers. A layer provides dependency wiring, not durable persistence or a cross-request singleton.

### Effects and errors

Use named `Effect.fn` functions for reusable operations and `Effect.gen` for readable sequencing. Wrap Promise APIs once, inside provider adapters, with `Effect.tryPromise`.

Map unknown SDK failures into explicit tagged domain errors: extraction failure, invalid source, adaptation failure, incomplete narration, speech failure, and an uncertain generation outcome. Preserve safe diagnostic fields such as provider, operation, status, and request ID. Do not log authorization headers, complete source articles, or raw provider responses by default.

Use `Effect.catchTag` for expected recovery paths. Do not convert every failure into an empty string or catch defects as if they were routine provider errors.

Only execute effects at boundaries: a Workflow step, CLI entrypoint, or container request. Avoid nested `Effect.runPromise` calls inside application services. `NodeRuntime.runMain` is suitable for the CLI; use the Worker-compatible Effect runtime at Worker boundaries.

### Cancellation and cleanup

Forward the `AbortSignal` supplied by `Effect.tryPromise` to the provider request. Set explicit timeouts for each operation. Cancellation of the local request does not prove that a provider stopped generation or will not charge for it.

Use scopes and `Effect.acquireRelease` for temporary directories, processes, and other resources that must be cleaned up. Consume or close response bodies. A successful TTS request that returns a stream is not a completed audio artifact until that stream has been fully consumed and the result persisted.

Limit concurrency explicitly. Start conservatively for TTS, then increase within the account's actual concurrent-request limit. Do not use an unbounded `Promise.all` over an article's chunks.

## Runtime validation: prefer Effect Schema

Use Effect's `Schema` to define source documents, narration sections, chunk plans, manifests, and job commands. Infer TypeScript types from those schemas instead of separately maintaining interfaces. Validate untrusted values with v4's `Schema.decodeUnknownEffect`.

Valibot is a valid option, but is not necessary for this backend. Add it only for a concrete boundary that benefits from it, such as an existing UI schema contract. Do not maintain equivalent Effect and Valibot schemas for the same data.

Schema validation establishes structure and constraints, not faithful narration. Separately check section coverage, output truncation, missing text, model finish reason, and the treatment of equations, quotations, code, tables, and images. Keep a draft-review step before paying for TTS in the initial dynamic version.

Treat extracted page content as untrusted data, not instructions. The adaptation model does not need tool access or credentials.

## SDK details that affect this project

### ElevenLabs

The official SDK uses camel-cased request fields such as `modelId` and `outputFormat`. Its documented defaults are **two automatic retries** and a **60-second timeout**.

Our existing v4 generation took roughly 68–83 seconds per chunk. Keeping that default timeout would therefore be a poor starting point for this project.

Configure TTS requests explicitly, initially with a longer timeout such as 180 seconds and `maxRetries: 0`. Forward `abortSignal`. Bound the complete operation, including consuming and saving the returned audio, rather than only waiting for response headers.

Keep the existing tested voice/output settings initially. Preserve chunk fingerprints and completed receipts when replacing the old direct HTTP implementation; a SDK migration must not silently regenerate already-paid audio.

### OpenRouter

Wrap the SDK request in `Effect.tryPromise`, forward cancellation, and use explicit request timeouts. Keep model selection, medium reasoning, prompt version, and output limits in validated configuration.

The installed `1.4.18` SDK requires a `chatRequest` wrapper. The earlier flat `chat.send({ model, messages, ... })` illustration does not type-check against this version. The verified request shape is:

```ts
client.chat.send(
  {
    chatRequest: {
      model: "openai/gpt-6.1-sol",
      reasoning: { effort: "medium" },
      messages: [{ role: "user", content: articleText }],
      stream: false,
    },
  },
  { signal, retries: { strategy: "none" } }
);
```

Here `signal` comes from the enclosing `Effect.tryPromise`. This example only demonstrates request options; the production adapter still needs the narration instructions, output contract, configured limits, and typed error mapping.

Do not assume that TypeScript types for a chat response validate the model's narration. Parse and validate the actual output and reject truncated results.

### Firecrawl

Use the scrape API with an explicit response contract. Check HTTP status and the API's success/error result before accepting extracted content. Preserve the original extraction separately from the cleaned source and narration.

Website variation belongs in extraction policy: main-content extraction first, bounded fallbacks for difficult pages, and a selection/review interface when the desired content is ambiguous. Effect organizes those branches; it does not make arbitrary extraction automatically correct.

## Durable execution and paid retries

Effect is not a replacement for Cloudflare Workflows. Its in-memory state does not survive a Worker restart. Workflows owns persisted step boundaries; R2 and the job ledger retain the actual artifacts and generation records.

A first workflow can have these stages:

1. Authenticate, validate the URL and limits, and allocate a job ID.
2. Extract and persist the source document.
3. Adapt, validate, and persist the narration draft.
4. Wait for selection/draft approval and the cost limit.
5. Create a deterministic chunk plan.
6. Generate and persist individual chunks, reusing completed results.
7. Request container assembly and wait for its completed manifest.
8. Publish the recording and its playback metadata.

Return artifact references from Workflow steps rather than storing large article bodies or audio in Workflow results. When container assembly outlives a short request, use a durable completion event or persisted status, not a detached promise that depends on a Worker staying alive.

Choose one retry owner per operation. Do not multiply SDK retries, Effect retries, and Workflow retries.

- Safe reads and documented transient failures can use bounded retry with backoff and jitter.
- Invalid credentials, quota exhaustion, malformed input, and rejected narration need explicit handling, not blind retries.
- Paid generation has an ambiguous failure window: the provider may complete or charge after the caller times out or before a result is saved.
- Write a generation intent before dispatch; store results and provider identifiers afterward. Use provider idempotency only where it is actually documented.
- If completion is uncertain, reconcile or require a deliberate retry. Do not claim exactly-once billing or automatically submit the same paid work again.

Expose paid job creation only behind authentication and usage limits. Keep all provider keys in Worker secrets, never the browser bundle. Validate public HTTP(S) inputs and apply restrictions to redirects or any direct server-side fetches.

## Testing and implementation order

1. Validate the exact Effect v4 and SDK APIs with a small offline TypeScript probe.
2. Implement the domain schemas, service contracts, and fake layers. Test the complete pipeline without credentials or network access.
3. Add provider adapters, including malformed responses, cancellation, rate limits, quota errors, timeouts, and uncertain paid outcomes.
4. Test the Workflow and container boundary by assembling existing R2 chunks, without new ElevenLabs charges.
5. Add the authenticated URL submission, draft review, and job-status UI.
6. Run one explicitly approved end-to-end generation with a cost limit.

Continue using the existing Docker verification environment. Do not substitute live paid API calls for deterministic CI tests.

## Verification status

Registry versions and official v4/SDK documentation were checked. An isolated, ignored scratch project at `.pi/effect-v4-research/` installed the exact versions above without modifying application dependencies.

- Strict TypeScript 7.0.2 checking passed for the Effect service, layer, named function, schema decoder, Node entrypoint, and both SDK adapters.
- Both SDK adapters type-check with cancellation and retries disabled. The ElevenLabs adapter also type-checks with an explicit 180-second timeout.
- The local mock program passed: service injection returned the expected narration value, and invalid input produced a schema failure.
- No paid API requests, extraction requests, container deployments, or live provider integration tests ran. Static typing and mock execution do not establish deployed Worker compatibility or provider behavior.

The reproducible local checks are:

```sh
./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck \
  --target ES2022 --module NodeNext --moduleResolution NodeNext \
  .pi/effect-v4-research/probe.ts
node .pi/effect-v4-research/probe.ts
```

## Sources

- [Effect 4.0 release](https://effect.website/blog/releases/effect/40)
- [Effect v4 services](https://effect.website/docs/v4/requirements-management/services/)
- [Effect v4 layers](https://effect.website/docs/v4/requirements-management/layers/)
- [Service migration details](https://github.com/Effect-TS/effect/blob/main/migration/services.md)
- [Schema migration details](https://github.com/Effect-TS/effect/blob/main/migration/schema.md)
- [Creating effects and Promise adapters](https://effect.website/docs/v4/getting-started/creating-effects/)
- [Effect retry policy](https://effect.website/docs/v4/error-management/retrying/)
- [Resource management](https://effect.website/docs/v4/resource-management/introduction/)
- [ElevenLabs JavaScript SDK](https://github.com/elevenlabs/elevenlabs-js)
- [OpenRouter TypeScript SDK](https://github.com/OpenRouterTeam/typescript-sdk)
- [Firecrawl scrape API](https://docs.firecrawl.dev/api-reference/endpoint/scrape)
