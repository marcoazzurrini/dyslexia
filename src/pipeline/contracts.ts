import { Schema } from "effect";

export const JobStatusSchema = Schema.Literals([
  "extracting",
  "source_ready",
  "adapting",
  "draft_ready",
  "generating",
  "assembling",
  "ready",
  "failed",
  "uncertain",
]);
export type JobStatus = typeof JobStatusSchema.Type;

export const PipelineJobSchema = Schema.Struct({
  audioKey: Schema.optionalKey(Schema.String),
  characters: Schema.Number,
  completedChunks: Schema.Number,
  createdAt: Schema.String,
  draftKey: Schema.optionalKey(Schema.String),
  durationSeconds: Schema.optionalKey(Schema.Number),
  error: Schema.optionalKey(Schema.String),
  estimatedTtsUsd: Schema.Number,
  id: Schema.String,
  sourceKey: Schema.optionalKey(Schema.String),
  status: JobStatusSchema,
  title: Schema.String,
  totalChunks: Schema.Number,
  updatedAt: Schema.String,
  url: Schema.String,
});
export type PipelineJob = typeof PipelineJobSchema.Type;

export const JobDetailSchema = Schema.Struct({
  draft: Schema.optionalKey(
    Schema.Struct({
      sourceUrl: Schema.String,
      text: Schema.String,
      title: Schema.String,
    })
  ),
  job: PipelineJobSchema,
  source: Schema.optionalKey(
    Schema.Struct({
      markdown: Schema.String,
      sourceUrl: Schema.String,
      title: Schema.String,
    })
  ),
});
export type JobDetail = typeof JobDetailSchema.Type;

export const SessionSchema = Schema.Struct({
  authenticated: Schema.Boolean,
  configured: Schema.Boolean,
});
export type PipelineSession = typeof SessionSchema.Type;
export const JobListSchema = Schema.Struct({
  jobs: Schema.Array(PipelineJobSchema),
});
export const CreatedJobSchema = Schema.Struct({ job: PipelineJobSchema });
