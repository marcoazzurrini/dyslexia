import type { Step } from "@dyslexia/ui";

import type { JobStatus } from "../pipeline/contracts";

/** States in which the server is working and the screen should poll. */
export const ACTIVE_STATES: ReadonlySet<JobStatus> = new Set([
  "extracting",
  "adapting",
  "generating",
  "assembling",
]);

/** States that wait for the person to review. */
export const REVIEW_STATES: ReadonlySet<JobStatus> = new Set([
  "source_ready",
  "draft_ready",
]);

const STAGES = [
  { label: "Extract source", status: "extracting" },
  { label: "Review source", status: "source_ready" },
  { label: "Adapt text", status: "adapting" },
  { label: "Review narration", status: "draft_ready" },
  { label: "Generate speech", status: "generating" },
  { label: "Assemble recording", status: "assembling" },
  { label: "Ready to listen", status: "ready" },
] as const satisfies readonly { label: string; status: JobStatus }[];

/** A short status for lists, such as "Review source". */
export const stageLabel = (status: JobStatus) => {
  if (status === "failed") {
    return "Failed";
  }
  if (status === "uncertain") {
    return "Needs attention";
  }
  return STAGES.find((stage) => stage.status === status)?.label ?? status;
};

/** The stages of a job that is running, waiting, or done. */
export const stepsFor = (status: JobStatus): Step[] => {
  const current = STAGES.findIndex((stage) => stage.status === status);
  return STAGES.map((stage, index): Step => {
    if (index < current || status === "ready") {
      return { label: stage.label, state: "done" };
    }
    if (index === current) {
      return {
        label: stage.label,
        state: REVIEW_STATES.has(status) ? "waiting" : "current",
      };
    }
    return { label: stage.label, state: "upcoming" };
  });
};
