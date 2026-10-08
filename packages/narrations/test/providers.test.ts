import { describe, expect, test } from "bun:test";

import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

import { servicesFor } from "../src/layers.ts";
import { MAX_PART_CHARACTERS } from "../src/limits.ts";
import type { Reader } from "../src/services/reader.ts";
import type { Voice } from "../src/services/voice.ts";
import type { Writer } from "../src/services/writer.ts";
import { speech } from "./support/audio.ts";
import { recordingTracer } from "./support/fakes.ts";
import { withReader, withVoice, withWriter } from "./support/services.ts";

const KEYS = {
  ELEVENLABS_API_KEY: "eleven-secret",
  FIRECRAWL_API_KEY: "firecrawl-secret",
  OPENROUTER_API_KEY: "openrouter-secret",
};

type Answer = Response | (() => Promise<Response>);

const asFetch = (
  handle: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): typeof globalThis.fetch =>
  Object.assign(handle, {
    preconnect: () => {
      // Not needed in tests.
    },
  });

/** A fetch that records requests and gives the answers in order. */
const fakeFetch = (...answers: Answer[]) => {
  const requests: Request[] = [];
  const fetch = asFetch((input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    const answer = answers.shift();
    if (!answer) {
      return Promise.reject(new Error("No answer left"));
    }
    return answer instanceof Response ? Promise.resolve(answer) : answer();
  });
  return { fetch, requests };
};

const outcome = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.match(effect, {
    onFailure: (error) => ({ error }),
    onSuccess: (value) => ({ value }),
  });

const run = <A, E>(
  effect: Effect.Effect<A, E, Reader | Writer | Voice>,
  fetch: typeof globalThis.fetch,
  keys: Parameters<typeof servicesFor>[0] = KEYS
) =>
  Effect.runPromise(
    outcome(effect).pipe(
      Effect.provide(servicesFor(keys)),
      Effect.provideService(FetchHttpClient.Fetch, fetch)
    )
  );

const read = (url: string) => withReader((reader) => reader.read(url));
const write = (text: string) =>
  withWriter((writer) => writer.write({ text, title: "Title" }));
const speak = (text: string) => withVoice((voice) => voice.speak(text));

interface Scraped {
  readonly markdown: string;
  readonly metadata: { readonly statusCode?: number; readonly title?: string };
}

const scraped = (data: Scraped, status = 200) =>
  Response.json({ data, success: true }, { status });
const completion = (content: string | null, finishReason = "stop") =>
  Response.json({
    choices: [{ finish_reason: finishReason, message: { content } }],
  });

describe("the article reader (Firecrawl)", () => {
  test("asks for the main content as Markdown", async () => {
    const { fetch, requests } = fakeFetch(
      scraped({
        markdown: "  # Title\n\nBody.  ",
        metadata: { statusCode: 200, title: " The title " },
      })
    );
    const result = await run(read("https://example.org/a"), fetch);
    expect(result).toEqual({
      value: { text: "# Title\n\nBody.", title: "The title" },
    });
    const [request] = requests;
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(request?.headers.get("authorization")).toBe(
      "Bearer firecrawl-secret"
    );
    expect(await request?.json()).toEqual({
      formats: ["markdown"],
      onlyMainContent: true,
      url: "https://example.org/a",
    });
  });

  test("asks for the link of a site that needs help", async () => {
    const { fetch, requests } = fakeFetch(
      scraped({ markdown: "Body.", metadata: {} })
    );
    const result = await run(
      read("https://x.com/poteto/article/2094457600259842065"),
      fetch
    );
    expect(result).toEqual({ value: { text: "Body.", title: "x.com" } });
    expect(await requests[0]?.json()).toMatchObject({
      url: "https://x.com/poteto/status/2094457600259842065",
    });
  });

  test("names an untitled article after its site", async () => {
    const { fetch } = fakeFetch(scraped({ markdown: "Body.", metadata: {} }));
    const result = await run(read("https://www.example.org/a"), fetch);
    expect(result).toEqual({ value: { text: "Body.", title: "example.org" } });
  });

  test.each([
    [
      "the page failed",
      scraped({
        markdown: "Error",
        metadata: { statusCode: 404, title: "Not found" },
      }),
    ],
    [
      "the page is empty",
      scraped({ markdown: "  ", metadata: { title: "Empty" } }),
    ],
    [
      "Firecrawl could not read it",
      Response.json({ success: false }, { status: 200 }),
    ],
    ["the answer is not JSON", new Response("<html>")],
    ["Firecrawl refused the page", new Response("blocked", { status: 403 })],
    ["the page does not exist", new Response("missing", { status: 404 })],
  ])("reports an unreadable article when %s", async (_case, answer) => {
    const { fetch } = fakeFetch(answer);
    const result = await run(read("https://example.org/a"), fetch);
    expect(result).toEqual({
      error: expect.objectContaining({ _tag: "ArticleUnreadable" }),
    });
  });

  test.each([401, 402])(
    "reports a refused request for status %i",
    async (status) => {
      const { fetch } = fakeFetch(new Response("no", { status }));
      const result = await run(read("https://example.org/a"), fetch);
      expect(result).toEqual({
        error: expect.objectContaining({
          _tag: "ServiceRejected",
          service: "reader",
          status,
        }),
      });
    }
  );

  test.each([408, 429, 500, 503])(
    "reports an unavailable service for status %i",
    async (status) => {
      const { fetch } = fakeFetch(new Response("busy", { status }));
      const result = await run(read("https://example.org/a"), fetch);
      expect(result).toEqual({
        error: expect.objectContaining({
          _tag: "ServiceUnavailable",
          service: "reader",
        }),
      });
    }
  );

  test("reports an unavailable service when the network fails", async () => {
    const { fetch } = fakeFetch(() =>
      Promise.reject(new TypeError("network down"))
    );
    const result = await run(read("https://example.org/a"), fetch);
    expect(result).toEqual({
      error: expect.objectContaining({ _tag: "ServiceUnavailable" }),
    });
  });

  test("stops reading an answer that is too large", async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(64 * 1024));
      },
    });
    const { fetch } = fakeFetch(new Response(endless));
    const result = await run(read("https://example.org/a"), fetch);
    expect(result).toEqual({
      error: expect.objectContaining({ _tag: "ServiceUnavailable" }),
    });
    // 2 MiB is the limit; reading stops soon after it.
    expect(pulled).toBeLessThan(40);
  });

  test("gives up on a service that does not answer", async () => {
    let aborted = false;
    const hanging = asFetch((_input, init) => {
      const { promise, reject } = Promise.withResolvers<Response>();
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      });
      return promise;
    });
    const result = await Effect.runPromise(
      Effect.gen(function* body() {
        const fiber = yield* Effect.forkChild(
          outcome(read("https://example.org/a"))
        );
        yield* TestClock.adjust("3 minutes");
        return yield* Fiber.join(fiber);
      }).pipe(
        Effect.provide(servicesFor(KEYS)),
        Effect.provideService(FetchHttpClient.Fetch, hanging),
        Effect.provide(TestClock.layer())
      )
    );
    expect(result).toEqual({
      error: expect.objectContaining({ _tag: "ServiceUnavailable" }),
    });
    expect(aborted).toBe(true);
  });

  test("needs its API key", async () => {
    const { fetch } = fakeFetch();
    await expect(
      run(read("https://example.org/a"), fetch, {
        ...KEYS,
        FIRECRAWL_API_KEY: undefined,
      })
    ).rejects.toThrow();
  });
});

describe("the writer (OpenRouter)", () => {
  test("asks the model for the whole article as JSON, with the article as data", async () => {
    const { fetch, requests } = fakeFetch(
      completion(JSON.stringify({ text: "Spoken." }))
    );
    const result = await run(write("Article body."), fetch);
    expect(result).toEqual({ value: "Spoken." });
    const [request] = requests;
    expect(request?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request?.headers.get("authorization")).toBe(
      "Bearer openrouter-secret"
    );
    const body = await request?.json();
    expect(body).toMatchObject({
      model: "openai/gpt-6.1-sol",
      reasoning: { effort: "medium" },
      response_format: {
        json_schema: { name: "narration", strict: true },
        type: "json_schema",
      },
      stream: false,
    });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("not a summary");
    expect(body.messages[1]).toEqual({
      content: JSON.stringify({ text: "Article body.", title: "Title" }),
      role: "user",
    });
  });

  test.each([
    ["was cut off", completion(JSON.stringify({ text: "Half" }), "length")],
    [
      "refused",
      Response.json({
        choices: [
          { finish_reason: "stop", message: { content: null, refusal: "No." } },
        ],
      }),
    ],
    ["returned no text", completion(null)],
    [
      "returned text that is not JSON",
      completion("Here is your narration: ..."),
    ],
    ["returned JSON without text", completion(JSON.stringify({ title: "x" }))],
    [
      "returned two answers",
      Response.json({
        choices: [
          { finish_reason: "stop", message: { content: "{}" } },
          { finish_reason: "stop", message: { content: "{}" } },
        ],
      }),
    ],
    [
      "returned an unexpected shape",
      Response.json({ error: { message: "overloaded" } }),
    ],
  ])(
    "reports an incomplete script when the model %s",
    async (_case, answer) => {
      const { fetch } = fakeFetch(answer);
      const result = await run(write("Article."), fetch);
      expect(result).toEqual({
        error: expect.objectContaining({ _tag: "ScriptIncomplete" }),
      });
    }
  );

  test.each([
    [400, "ServiceRejected"],
    [401, "ServiceRejected"],
    [402, "ServiceRejected"],
    [429, "ServiceUnavailable"],
    [502, "ServiceUnavailable"],
  ])("maps status %i to %s", async (status, tag) => {
    const { fetch } = fakeFetch(new Response("{}", { status }));
    const result = await run(write("Article."), fetch);
    expect(result).toEqual({
      error: expect.objectContaining({ _tag: tag, service: "writer" }),
    });
  });
});

describe("the voice (ElevenLabs)", () => {
  test("asks for constant-bitrate MP3 with the chosen voice and model", async () => {
    const audio = speech(3);
    const { fetch, requests } = fakeFetch(new Response(audio));
    const result = await run(speak("Hello there."), fetch);
    expect(result).toEqual({ value: audio });
    const [request] = requests;
    expect(request?.url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128"
    );
    expect(request?.headers.get("xi-api-key")).toBe("eleven-secret");
    expect(request?.headers.get("authorization")).toBeNull();
    expect(await request?.json()).toEqual({
      model_id: "eleven_v4",
      text: "Hello there.",
    });
  });

  test("sends the longest part whole", async () => {
    const text = "a".repeat(MAX_PART_CHARACTERS);
    const { fetch, requests } = fakeFetch(new Response(speech()));
    await run(speak(text), fetch);
    const body = await requests[0]?.json();
    expect(body).toMatchObject({ text });
  });

  test("reports an unavailable service for empty audio", async () => {
    const { fetch } = fakeFetch(new Response(new Uint8Array()));
    const result = await run(speak("Hello."), fetch);
    expect(result).toEqual({
      error: expect.objectContaining({
        _tag: "ServiceUnavailable",
        service: "voice",
      }),
    });
  });

  test("rejects audio over 8 MiB", async () => {
    const { fetch } = fakeFetch(
      new Response(new Uint8Array(8 * 1024 * 1024 + 1))
    );
    const result = await run(speak("Hello."), fetch);
    expect(result).toEqual({
      error: expect.objectContaining({
        _tag: "ServiceUnavailable",
        service: "voice",
      }),
    });
  });

  test("reports a refused request without the key", async () => {
    const { fetch } = fakeFetch(new Response("bad key", { status: 401 }));
    const result = await run(speak("Hello."), fetch);
    expect(result).toEqual({
      error: expect.objectContaining({
        _tag: "ServiceRejected",
        service: "voice",
        status: 401,
      }),
    });
    expect(JSON.stringify(result)).not.toContain("eleven-secret");
  });
});

describe("traces of the outside services", () => {
  test("never record a service key", async () => {
    const { spans, tracer } = recordingTracer();
    const { fetch } = fakeFetch(
      scraped({ markdown: "Body.", metadata: { title: "Title" } }),
      completion(JSON.stringify({ text: "Body." })),
      new Response(speech())
    );
    await run(
      Effect.all([
        read("https://example.org/a"),
        write("Body."),
        speak("Hi"),
      ]).pipe(Effect.withTracer(tracer)),
      fetch
    );
    const recorded = JSON.stringify(
      spans.map((span) => Object.fromEntries(span.attributes))
    );
    expect(recorded).toContain("http.request.header.xi-api-key");
    for (const key of Object.values(KEYS)) {
      expect(recorded).not.toContain(key);
    }
  });

  test("record the writer's model and token usage", async () => {
    const { named, tracer } = recordingTracer();
    const { fetch } = fakeFetch(
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ text: "Body." }) },
          },
        ],
        usage: { completion_tokens: 20, cost: 0.002, prompt_tokens: 100 },
      })
    );
    await run(write("Body.").pipe(Effect.withTracer(tracer)), fetch);
    const [span] = named("Writer.write");
    expect(Object.fromEntries(span?.attributes ?? [])).toMatchObject({
      "gen_ai.request.model": expect.any(String),
      "gen_ai.usage.cost": 0.002,
      "gen_ai.usage.input_tokens": 100,
      "gen_ai.usage.output_tokens": 20,
      "script.characters": 5,
    });
  });
});
