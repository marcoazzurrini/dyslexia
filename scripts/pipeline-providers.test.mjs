import assert from "node:assert/strict";
import test from "node:test";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OpenRouter } from "@openrouter/sdk";
import { Effect, Fiber, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";

import {
  chunkNarration,
  InvalidInput,
  NarrationDraftSchema,
  ProviderFailure,
  SourceDocumentSchema,
  validateSourceUrl,
} from "../src/pipeline/domain.ts";
import {
  Extractor,
  makeProviderLayer,
  NarrationAdapter,
  SpeechGenerator,
} from "../src/pipeline/providers.ts";

const source = {
  markdown:
    "First paragraph explains the complete article.\n\nSecond paragraph preserves the final quotation: ‘All of it.’",
  sourceUrl: "https://example.com/article",
  title: "An article",
};
const config = {
  ELEVENLABS_API_KEY: "test-only-elevenlabs",
  FIRECRAWL_API_KEY: "test-only-firecrawl",
  OPENROUTER_API_KEY: "test-only-openrouter",
};
const run = (service, operation, input, fetch, keys = config) =>
  Effect.runPromise(
    Effect.gen(function* invokeProvider() {
      const provider = yield* service;
      return yield* provider[operation](input);
    }).pipe(Effect.provide(makeProviderLayer({ ...keys, fetch })))
  );
const noNetwork = () => {
  throw new Error("Unexpected network request");
};
const expectFailure = async (promise, provider, operation) => {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ProviderFailure);
    assert.equal(error._tag, "ProviderFailure");
    assert.equal(error.provider, provider);
    assert.equal(error.operation, operation);
    assert.ok(Schema.is(Schema.String)(error.message));
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(
      `${error.stack}\n${JSON.stringify(error)}`,
      /PRIVATE_RESPONSE|test-only-/u
    );
    return true;
  });
};
const extractionResponse = (overrides = {}) =>
  Response.json({
    data: {
      markdown: source.markdown,
      metadata: { sourceURL: source.sourceUrl, title: source.title },
    },
    success: true,
    ...overrides,
  });
const completionResponse = (
  text = source.markdown,
  finishReason = "stop",
  title = source.title
) =>
  Response.json({
    choices: [
      {
        finish_reason: finishReason,
        index: 0,
        logprobs: null,
        message: {
          content: JSON.stringify({ text, title }),
          refusal: null,
          role: "assistant",
        },
      },
    ],
    created: 1,
    id: "test-completion",
    model: "openai/gpt-6.1-sol",
    object: "chat.completion",
    system_fingerprint: null,
  });

for (const text of [
  "a",
  "x".repeat(3000),
  "x".repeat(3001),
  "x".repeat(100_000),
  `${"First sentence. ".repeat(220)}\n\n${"Second paragraph! ".repeat(200)}`,
  `  First\r\n\r\nSecond\rThird.  `,
  `${"x".repeat(2999)}🎧${"音声".repeat(1600)}`,
]) {
  test(`chunking preserves normalized text at length ${text.length}`, () => {
    const chunks = chunkNarration(text);
    assert.equal(
      chunks.map((chunk) => chunk.text).join(""),
      text.replaceAll(/\r\n?/gu, "\n").trim()
    );
    assert.ok(chunks.length <= 40);
    for (const [index, chunk] of chunks.entries()) {
      assert.equal(chunk.index, index);
      assert.ok(chunk.text.length > 0 && chunk.text.length <= 3000);
      assert.ok(chunk.text.isWellFormed());
    }
  });
}
test("chunking prefers paragraphs and sentences without dropping separators", () => {
  const paragraph = `${"x".repeat(1800)}\n\n${"y".repeat(1800)}`;
  assert.equal(chunkNarration(paragraph)[0].text, `${"x".repeat(1800)}\n\n`);
  const sentence = `${"x".repeat(1800)}. ${"y".repeat(1800)}`;
  assert.equal(chunkNarration(sentence)[0].text, `${"x".repeat(1800)}. `);
});
test("chunking rejects blank, oversized, and more than 40 chunks", () => {
  for (const text of [
    "",
    " \n ",
    "x".repeat(100_001),
    `${"x".repeat(1500)}\n\n`.repeat(60),
  ]) {
    assert.throws(() => chunkNarration(text), InvalidInput);
  }
});

for (const url of [
  "http://example.com",
  "file:///tmp/article",
  "https://user:password@example.com",
  "https://@example.com",
  "https://example.com:",
  "https:///example.com",
  "https://foo.localdomain",
  "https://foo.example",
  "https://localhost",
  "https://localhost.",
  "https://foo.local",
  "https://foo.internal",
  "https://foo.lan",
  "https://foo.home.arpa",
  "https://intranet",
  "https://127.0.0.1",
  "https://10.0.0.1",
  "https://169.254.169.254",
  "https://192.168.1.1",
  "https://8.8.8.8",
  "https://2130706433",
  "https://0x7f000001",
  "https://[::1]",
  "https://[2606:4700:4700::1111]",
  "https://example.com:0",
  "https://example.com:444",
  "https://example.com:65536",
  "https://example.com:no",
  "https://example.com\\@localhost",
  "https://example.com\n.evil.com",
  "not a URL",
]) {
  test(`source URL rejects ${JSON.stringify(url)}`, async () => {
    await assert.rejects(
      Effect.runPromise(validateSourceUrl(url)),
      InvalidInput
    );
  });
}
test("source URL normalizes public HTTPS, default port, and fragments", async () => {
  assert.equal(
    await Effect.runPromise(
      validateSourceUrl("https://EXAMPLE.com:443/article#section")
    ),
    source.sourceUrl
  );
});
test("domain schemas reject blank strings and content limits", async () => {
  await Promise.all(
    [
      { ...source, title: " " },
      { ...source, sourceUrl: "" },
      { ...source, markdown: "" },
      { ...source, markdown: "x".repeat(80_001) },
    ].map((input) =>
      assert.rejects(
        Effect.runPromise(
          Schema.decodeUnknownEffect(SourceDocumentSchema)(input)
        )
      )
    )
  );
  await Promise.all(
    [" ", "x".repeat(100_001)].map((text) =>
      assert.rejects(
        Effect.runPromise(
          Schema.decodeUnknownEffect(NarrationDraftSchema)({ ...source, text })
        )
      )
    )
  );
});

test("document budgets include metadata and accept exact boundaries", async () => {
  const metadataLength = source.title.length + source.sourceUrl.length;
  await Effect.runPromise(
    Schema.decodeUnknownEffect(SourceDocumentSchema)({
      ...source,
      markdown: "x".repeat(80_000 - metadataLength),
    })
  );
  await assert.rejects(
    Effect.runPromise(
      Schema.decodeUnknownEffect(SourceDocumentSchema)({
        ...source,
        markdown: "x".repeat(80_001 - metadataLength),
      })
    )
  );
  await Effect.runPromise(
    Schema.decodeUnknownEffect(NarrationDraftSchema)({
      ...source,
      text: "x".repeat(100_000 - metadataLength),
    })
  );
  await assert.rejects(
    Effect.runPromise(
      Schema.decodeUnknownEffect(NarrationDraftSchema)({
        ...source,
        text: "x".repeat(100_001 - metadataLength),
      })
    )
  );
});

test("service contracts accept independent Layer.succeed doubles", async () => {
  const layers = Layer.mergeAll(
    Layer.succeed(Extractor, { extract: () => Effect.succeed(source) }),
    Layer.succeed(NarrationAdapter, {
      adapt: (document) =>
        Effect.succeed({ ...document, text: document.markdown }),
    }),
    Layer.succeed(SpeechGenerator, {
      generate: (text) =>
        Effect.succeed({ audio: new TextEncoder().encode(text) }),
    })
  );
  const audio = await Effect.runPromise(
    Effect.gen(function* fakePipeline() {
      const extractor = yield* Extractor;
      const adapter = yield* NarrationAdapter;
      const speech = yield* SpeechGenerator;
      const document = yield* extractor.extract(source.sourceUrl);
      const draft = yield* adapter.adapt(document);
      return yield* speech.generate(draft.text);
    }).pipe(Effect.provide(layers))
  );
  assert.equal(new TextDecoder().decode(audio.audio), source.markdown);
});

for (const [service, operation, input, provider] of [
  [Extractor, "extract", source.sourceUrl, "firecrawl"],
  [NarrationAdapter, "adapt", source, "openrouter"],
  [SpeechGenerator, "generate", "Hello", "elevenlabs"],
]) {
  test(`${provider} fails safely without configured keys`, async () => {
    await expectFailure(
      run(service, operation, input, noNetwork, {}),
      provider,
      operation
    );
  });
  test(`${provider} hides transport errors and never retries`, async (context) => {
    // ElevenLabs 2.70.0 leaves its 180-second timer alive when fetch rejects.
    // Fake timers keep this upstream behavior from retaining the test process.
    context.mock.timers.enable({ apis: ["setTimeout"] });
    let calls = 0;
    await expectFailure(
      run(service, operation, input, () => {
        calls += 1;
        return Promise.reject(new Error("PRIVATE_RESPONSE test-only-secret"));
      }),
      provider,
      operation
    );
    assert.equal(calls, 1);
  });
  test(`${provider} rejects HTTP 429 without retry`, async () => {
    let calls = 0;
    await expectFailure(
      run(service, operation, input, () => {
        calls += 1;
        return Promise.resolve(
          Response.json({ error: "PRIVATE_RESPONSE" }, { status: 429 })
        );
      }),
      provider,
      operation
    );
    assert.equal(calls, 1);
  });
}

test("Firecrawl sends one bounded main-content scrape and preserves returned data", async () => {
  const result = await run(
    Extractor,
    "extract",
    source.sourceUrl,
    (url, options) => {
      assert.equal(url, "https://api.firecrawl.dev/v2/scrape");
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      assert.deepEqual(JSON.parse(options.body), {
        formats: ["markdown"],
        onlyMainContent: true,
        url: source.sourceUrl,
      });
      return Promise.resolve(extractionResponse());
    }
  );
  assert.deepEqual(result, source);
});
for (const payload of [
  { error: "PRIVATE_RESPONSE", success: false },
  { data: { markdown: "Text" }, success: true },
  { data: { markdown: "", metadata: { title: "Title" } }, success: true },
  { data: { markdown: "Text", metadata: { title: " " } }, success: true },
  { data: { markdown: 42, metadata: { title: "Title" } }, success: true },
  {
    data: { markdown: "x".repeat(80_001), metadata: { title: "Title" } },
    success: true,
  },
  {
    data: {
      markdown: "Text",
      metadata: { sourceURL: "https://localhost", title: "Title" },
    },
    success: true,
  },
  {
    data: { markdown: "Text", metadata: { statusCode: 404, title: "Title" } },
    success: true,
  },
]) {
  test(`Firecrawl rejects malformed extraction ${JSON.stringify(payload).slice(0, 120)}`, async () => {
    await expectFailure(
      run(Extractor, "extract", source.sourceUrl, () =>
        Promise.resolve(Response.json(payload))
      ),
      "firecrawl",
      "extract"
    );
  });
}
test("Firecrawl rejects invalid JSON and cancels oversized response streams", async () => {
  await expectFailure(
    run(Extractor, "extract", source.sourceUrl, () =>
      Promise.resolve(new Response("PRIVATE_RESPONSE"))
    ),
    "firecrawl",
    "extract"
  );
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
    },
    pull(controller) {
      controller.enqueue(new Uint8Array(1024 * 1024 + 1));
    },
  });
  await expectFailure(
    run(Extractor, "extract", source.sourceUrl, () =>
      Promise.resolve(new Response(stream))
    ),
    "firecrawl",
    "extract"
  );
  assert.ok(cancelled);
});

test("OpenRouter uses verified SDK options and a source-only structured prompt", async (context) => {
  const prototype = Object.getPrototypeOf(
    new OpenRouter({ apiKey: "test-only" }).chat
  );
  const original = prototype.send;
  const send = context.mock.method(
    prototype,
    "send",
    function inspectChat(...args) {
      const [request, options] = args;
      assert.deepEqual(options.retries, { strategy: "none" });
      assert.equal(options.timeoutMs, 180_000);
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(request.chatRequest.maxCompletionTokens, 40_000);
      return original.apply(this, args);
    }
  );
  const draft = await run(
    NarrationAdapter,
    "adapt",
    source,
    async (input, init) => {
      const request = new Request(input, init);
      const body = await request.json();
      assert.equal(
        request.url,
        "https://openrouter.ai/api/v1/chat/completions"
      );
      assert.equal(body.model, "openai/gpt-6.1-sol");
      assert.deepEqual(body.reasoning, { effort: "medium" });
      assert.equal(body.stream, false);
      assert.equal(body.max_completion_tokens, 40_000);
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(body.response_format.json_schema.strict, true);
      assert.deepEqual(JSON.parse(body.messages[1].content), source);
      assert.equal(body.tools, undefined);
      assert.doesNotMatch(JSON.stringify(body), /test-only-/u);
      return completionResponse();
    }
  );
  assert.deepEqual(draft, {
    sourceUrl: source.sourceUrl,
    text: source.markdown,
    title: source.title,
  });
  assert.equal(send.mock.callCount(), 1);
});
for (const reason of ["length", "content_filter", "tool_calls", null]) {
  test(`OpenRouter rejects finish_reason ${reason}`, async () => {
    await expectFailure(
      run(NarrationAdapter, "adapt", source, () =>
        Promise.resolve(completionResponse(source.markdown, reason))
      ),
      "openrouter",
      "adapt"
    );
  });
}
for (const text of [
  "",
  "Summary.",
  "x".repeat(100_001),
  "Unrelated invented content. ".repeat(20),
]) {
  test(`OpenRouter rejects missing coverage or invalid draft of length ${text.length}`, async () => {
    await expectFailure(
      run(NarrationAdapter, "adapt", source, () =>
        Promise.resolve(completionResponse(text))
      ),
      "openrouter",
      "adapt"
    );
  });
}
test("OpenRouter rejects a missing ending even when output remains long", async () => {
  const document = {
    ...source,
    markdown: `${"Body material is repeated. ".repeat(100)}\n\nUnique closing statement: cobalt narwhals dance.`,
  };
  await expectFailure(
    run(NarrationAdapter, "adapt", document, () =>
      Promise.resolve(
        completionResponse("Body material is repeated. ".repeat(101))
      )
    ),
    "openrouter",
    "adapt"
  );
});
test("OpenRouter rejects non-JSON model output without leaking it", async () => {
  const response = await completionResponse().json();
  response.choices[0].message.content = "PRIVATE_RESPONSE";
  await expectFailure(
    run(NarrationAdapter, "adapt", source, () =>
      Promise.resolve(Response.json(response))
    ),
    "openrouter",
    "adapt"
  );
});

test("ElevenLabs uses verified SDK options and reads every audio byte", async (context) => {
  const prototype = Object.getPrototypeOf(
    new ElevenLabsClient({ apiKey: "test-only" }).textToSpeech
  );
  const original = prototype.convert;
  const convert = context.mock.method(
    prototype,
    "convert",
    function inspectSpeech(...args) {
      const [voice, request, options] = args;
      assert.equal(voice, "JBFqnCBsd6RMkjVDRZzb");
      assert.equal(request.modelId, "eleven_v4");
      assert.equal(request.outputFormat, "mp3_44100_128");
      assert.equal(options.maxRetries, 0);
      assert.equal(options.timeoutInSeconds, 180);
      assert.ok(options.abortSignal instanceof AbortSignal);
      return original.apply(this, args);
    }
  );
  const audio = await run(
    SpeechGenerator,
    "generate",
    "Hello",
    async (input, init) => {
      const request = new Request(input, init);
      assert.equal(
        request.url,
        "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128"
      );
      assert.deepEqual(await request.json(), {
        model_id: "eleven_v4",
        text: "Hello",
      });
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2]));
            controller.enqueue(new Uint8Array([3, 4]));
            controller.close();
          },
        }),
        {
          headers: {
            "content-type": "audio/mpeg",
            "request-id": "request_123",
          },
        }
      );
    }
  );
  assert.deepEqual(audio, {
    audio: new Uint8Array([1, 2, 3, 4]),
    requestId: "request_123",
  });
  assert.equal(convert.mock.callCount(), 1);
});
test("ElevenLabs rejects blank and oversized chunks before dispatch", async () => {
  await Promise.all(
    [" ", "x".repeat(3001)].map((text) =>
      expectFailure(
        run(SpeechGenerator, "generate", text, noNetwork),
        "elevenlabs",
        "generate"
      )
    )
  );
});
test("ElevenLabs rejects empty, oversized, and interrupted streams", async () => {
  await expectFailure(
    run(SpeechGenerator, "generate", "Hello", () =>
      Promise.resolve(new Response(new Uint8Array()))
    ),
    "elevenlabs",
    "generate"
  );
  let cancelled = false;
  await expectFailure(
    run(SpeechGenerator, "generate", "Hello", () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
            pull(controller) {
              controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1));
            },
          })
        )
      )
    ),
    "elevenlabs",
    "generate"
  );
  assert.ok(cancelled);
  await expectFailure(
    run(SpeechGenerator, "generate", "Hello", () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.error(new Error("PRIVATE_RESPONSE"));
            },
          })
        )
      )
    ),
    "elevenlabs",
    "generate"
  );
});

for (const [service, operation, input, provider] of [
  [Extractor, "extract", source.sourceUrl, "firecrawl"],
  [NarrationAdapter, "adapt", source, "openrouter"],
  [SpeechGenerator, "generate", "Hello", "elevenlabs"],
]) {
  test(`${provider} deadline includes a stalled response body`, async () => {
    const reading = Promise.withResolvers();
    const closed = Promise.withResolvers();
    let requestSignal;
    const transport = (requestInput, init) => {
      requestSignal = new Request(requestInput, init).signal;
      return Promise.resolve(
        new Response(
          new ReadableStream({
            cancel() {
              closed.resolve();
            },
            pull() {
              reading.resolve();
            },
            start(controller) {
              if (provider === "openrouter") {
                requestSignal.addEventListener(
                  "abort",
                  () => controller.error(new Error("PRIVATE_RESPONSE abort")),
                  { once: true }
                );
              }
            },
          }),
          {
            headers: {
              "content-type":
                provider === "elevenlabs" ? "audio/mpeg" : "application/json",
            },
          }
        )
      );
    };
    const program = Effect.gen(function* deadlineTest() {
      const instance = yield* service;
      const pending = yield* Effect.forkChild(instance[operation](input));
      yield* Effect.promise(() => reading.promise);
      yield* TestClock.adjust("251 seconds");
      return yield* Fiber.join(pending);
    }).pipe(
      Effect.provide(makeProviderLayer({ ...config, fetch: transport })),
      Effect.provide(TestClock.layer())
    );
    await expectFailure(Effect.runPromise(program), provider, operation);
    assert.ok(requestSignal.aborted);
    if (provider !== "openrouter") {
      await closed.promise;
    }
  });
}

test("interrupting speech cancels body consumption and aborts the request", async () => {
  const controller = new AbortController();
  const reading = Promise.withResolvers();
  const closed = Promise.withResolvers();
  let requestSignal;
  const program = Effect.gen(function* cancellationTest() {
    const speech = yield* SpeechGenerator;
    return yield* speech.generate("Hello");
  }).pipe(
    Effect.provide(
      makeProviderLayer({
        ...config,
        fetch: (input, init) => {
          requestSignal = new Request(input, init).signal;
          return Promise.resolve(
            new Response(
              new ReadableStream({
                cancel() {
                  closed.resolve();
                },
                pull() {
                  reading.resolve();
                },
              })
            )
          );
        },
      })
    )
  );
  const result = Effect.runPromiseExit(program, { signal: controller.signal });
  await reading.promise;
  controller.abort();
  const exit = await result;
  assert.equal(exit._tag, "Failure");
  await closed.promise;
  assert.ok(requestSignal.aborted);
});
