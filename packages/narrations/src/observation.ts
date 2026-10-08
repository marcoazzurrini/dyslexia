// Span attributes that tell Langfuse what a step is and what it saw, from
// https://langfuse.com/integrations/native/opentelemetry#property-mapping.
// Other tracing backends keep them as ordinary attributes.

type Type = "generation" | "tool" | "span";

/** Data a step was given or produced, in a form Langfuse can show. */
export type Shown =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly Shown[]
  | { readonly [key: string]: Shown };

/** What kind of step a span is: a model call, a call to a service, or other work. */
export const observationType = (type: Type) => ({
  "langfuse.observation.type": type,
});

/** What the step was given, as Langfuse shows it. */
export const observationInput = (input: Shown) => ({
  "langfuse.observation.input": JSON.stringify(input),
});

/** What the step produced, as Langfuse shows it. */
export const observationOutput = (output: Shown) => ({
  "langfuse.observation.output": JSON.stringify(output),
});

/** The settings a model was called with. */
export const modelParameters = (
  parameters: Readonly<Record<string, string | number>>
) => ({
  "langfuse.observation.model.parameters": JSON.stringify(parameters),
});

/** Marks a step that ended a narration, with the listener's reason. */
export const failedObservation = (reason: string) => ({
  "langfuse.observation.level": "ERROR",
  "langfuse.observation.status_message": reason,
});

/** The narration a span belongs to, filterable in Langfuse on every step. */
export const narrationOf = (id: string) => ({
  "langfuse.trace.metadata.narration_id": id,
  "narration.id": id,
});
