/**
 * Runs the narration eval: writes a script for each article in the Langfuse
 * dataset with one model and prompt, has the judge check it, and records the
 * run as a Langfuse experiment with a pass or fail for each check.
 *
 *   bun run eval                                   the production prompt and model
 *   bun run eval --model anthropic/claude-sonnet-5.5
 *   bun run eval --prompt evals/prompts/v2.md      a candidate prompt
 *   bun run eval --repeat 3                        three runs, to see the noise
 *   bun run eval --held-out                        only the held-out articles
 *   bun run eval --case code,italian               only these articles
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";

import { observationInput, observationOutput } from "../src/observation.ts";
import { Writer, WriterSettings } from "../src/services/writer.ts";
import type { WritingSettings } from "../src/services/writer.ts";
import { flushTraces, narrationTracingFor } from "../src/telemetry.ts";
import { CHECK_NAMES, CHECKS, JUDGE_MODEL, judge } from "./judge.ts";
import type { Findings } from "./judge.ts";
import { ensureDataset, listItems, saveScore } from "./langfuse.ts";
import type { Item } from "./langfuse.ts";
import { spendingFetch } from "./spending.ts";

const { values: options } = parseArgs({
  options: {
    case: { type: "string" },
    "held-out": { default: false, type: "boolean" },
    model: { type: "string" },
    prompt: { type: "string" },
    reasoning: { type: "string" },
    repeat: { default: "1", type: "string" },
  },
});

const ARTICLES_AT_ONCE = 3;
const spending = spendingFetch(globalThis.fetch);
const key = process.env.OPENROUTER_API_KEY?.trim() ?? "";

const settingsFor = (defaults: WritingSettings) => {
  const reasoning = options.reasoning ?? defaults.reasoning;
  if (reasoning !== "low" && reasoning !== "medium" && reasoning !== "high") {
    throw new Error("--reasoning must be low, medium, or high.");
  }
  return {
    model: options.model ?? defaults.model,
    prompt: options.prompt
      ? readFileSync(options.prompt, "utf-8")
      : defaults.prompt,
    promptName: options.prompt
      ? path.basename(options.prompt, ".md")
      : "current",
    reasoning,
  } as const;
};

const services = Layer.mergeAll(
  Writer.layer,
  narrationTracingFor({
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    // Keeps eval runs out of the development and production views.
    LANGFUSE_TRACING_ENVIRONMENT: "experiment",
  })
).pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromEnv({ env: { OPENROUTER_API_KEY: key } })
    )
  )
);

/** What every span of one experiment run carries, so Langfuse groups them. */
interface Experiment {
  readonly id: string;
  readonly name: string;
  readonly datasetId: string;
  readonly settings: ReturnType<typeof settingsFor>;
}

const article = (item: Item) => ({
  text: item.input.text,
  title: item.input.title,
});

const noScript: Findings = {
  complete: ["No script was written."],
  faithful: ["No script was written."],
  "no-clutter": ["No script was written."],
  "reads-well": ["No script was written."],
};

/** Writes and checks one article's script, as one trace of the experiment. */
const scoreItem = (experiment: Experiment, item: Item) =>
  Effect.gen(function* writeAndCheck() {
    const root = yield* Effect.currentSpan;
    const itemContext = {
      "langfuse.experiment.item.id": item.id,
      "langfuse.experiment.item.root_observation_id": root.spanId,
    };
    for (const [name, value] of Object.entries({
      ...itemContext,
      "langfuse.experiment.item.metadata.case": item.metadata.case,
    })) {
      root.attribute(name, value);
    }
    const written = yield* Effect.result(
      (yield* Writer)
        .write(article(item))
        .pipe(Effect.annotateSpans(itemContext))
    );
    if (written._tag === "Failure") {
      yield* Effect.annotateCurrentSpan(
        observationOutput({ failed: written.failure._tag })
      );
      return { root, script: undefined };
    }
    yield* Effect.annotateCurrentSpan(observationOutput(written.success));
    return { root, script: written.success };
  }).pipe(
    Effect.withSpan("write narration script", {
      attributes: observationInput({
        link: item.input.link,
        title: item.input.title,
      }),
      root: true,
    }),
    Effect.annotateSpans({
      "langfuse.experiment.dataset.id": experiment.datasetId,
      "langfuse.experiment.id": experiment.id,
      "langfuse.experiment.metadata.model": experiment.settings.model,
      "langfuse.experiment.metadata.prompt": experiment.settings.promptName,
      "langfuse.experiment.metadata.reasoning": experiment.settings.reasoning,
      "langfuse.experiment.name": experiment.name,
    }),
    Effect.provideService(WriterSettings, experiment.settings),
    Effect.flatMap(({ root, script }) =>
      Effect.gen(function* checkScript() {
        const findings: Findings = script
          ? (yield* judge(article(item), script, key).pipe(
              Effect.withTracerEnabled(false)
            )).findings
          : noScript;
        for (const check of CHECK_NAMES) {
          const problems = findings[check];
          yield* saveScore({
            comment: problems.length
              ? problems.map((problem) => `- ${problem}`).join("\n")
              : CHECKS[check],
            name: check,
            observationId: root.spanId,
            passed: problems.length === 0,
            traceId: root.traceId,
          });
        }
        return { case: item.metadata.case, findings };
      })
    )
  );

const mark = (problems: readonly string[]) =>
  problems.length ? `✗ ${problems.length}` : "✓";

const runOnce = (
  datasetId: string,
  items: readonly Item[],
  settings: ReturnType<typeof settingsFor>,
  round: number,
  rounds: number
) =>
  Effect.gen(function* runExperiment() {
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const experiment: Experiment = {
      datasetId,
      id: crypto.randomUUID(),
      name: `${settings.promptName} · ${settings.model} · ${stamp}${rounds > 1 ? ` · ${round}/${rounds}` : ""}${options["held-out"] ? " · held out" : ""}`,
      settings,
    };
    console.log(`\n${experiment.name}`);
    const results = yield* Effect.forEach(
      items,
      (item) => scoreItem(experiment, item),
      { concurrency: ARTICLES_AT_ONCE }
    );
    yield* flushTraces;
    console.table(
      Object.fromEntries(
        results.map((result) => [
          result.case,
          Object.fromEntries(
            CHECK_NAMES.map((check) => [check, mark(result.findings[check])])
          ),
        ])
      )
    );
    for (const check of CHECK_NAMES) {
      const passed = results.filter(
        (result) => result.findings[check].length === 0
      ).length;
      console.log(`${check}: ${passed}/${results.length} passed`);
    }
    let writing = 0;
    let judging = 0;
    for (const [model, cost] of spending.take()) {
      if (model.startsWith(JUDGE_MODEL)) {
        judging += cost;
      } else {
        writing += cost;
      }
    }
    console.log(
      `cost: writing $${writing.toFixed(2)}, judging $${judging.toFixed(2)}`
    );
  });

await Effect.runPromise(
  Effect.gen(function* evaluate() {
    const settings = settingsFor(yield* WriterSettings);
    const dataset = yield* ensureDataset;
    const only = options.case?.split(",").map((name) => name.trim());
    const items = (yield* listItems).filter(
      (item) =>
        item.metadata.heldOut === options["held-out"] &&
        (!only || only.includes(item.metadata.case))
    );
    if (items.length === 0) {
      return yield* Effect.die(
        new Error("No articles. Run `bun run eval:dataset` first.")
      );
    }
    const rounds = Math.max(1, Math.trunc(Number(options.repeat)) || 1);
    for (let round = 1; round <= rounds; round += 1) {
      yield* runOnce(dataset.id, items, settings, round, rounds);
    }
    console.log(
      "\nOpen Langfuse → Datasets → narration-articles → Experiments to compare runs and read the judge's reasons."
    );
  }).pipe(
    Effect.provide(services),
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, spending.fetch)
  )
);
