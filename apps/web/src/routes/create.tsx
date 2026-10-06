import {
  ACCOUNT_NOT_ALLOWED,
  signIn as googleSignIn,
  signOut as googleSignOut,
} from "@dyslexia/auth/client";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { Schema } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";

import { ARTICLE } from "../lib/article";
import { selectArticle } from "../lib/selected-article";
import type {
  JobDetail,
  JobStatus,
  PipelineJob,
  PipelineSession,
} from "../pipeline/contracts";
import {
  CreatedJobSchema,
  JobDetailSchema,
  JobListSchema,
  SessionSchema,
} from "../pipeline/contracts";

const API = "/api/pipeline";
// Google sign-in returns here with ?error= when it does not finish.
const CreateSearch = Schema.Struct({ error: Schema.optional(Schema.String) });
const route = getRouteApi("/create");
const ACTIVE_STATES = new Set<JobStatus>([
  "extracting",
  "adapting",
  "generating",
  "assembling",
]);
const STAGES = [
  { label: "Extract source", status: "extracting" },
  { label: "Review source", status: "source_ready" },
  { label: "Adapt text", status: "adapting" },
  { label: "Review narration", status: "draft_ready" },
  { label: "Generate speech", status: "generating" },
  { label: "Assemble recording", status: "assembling" },
  { label: "Ready to listen", status: "ready" },
] as const;
const stageLabel = (status: JobStatus) =>
  STAGES.find((stage) => stage.status === status)?.label ??
  (status === "uncertain" ? "Needs attention" : "Failed");

class PipelineError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PipelineError";
    this.status = status;
  }
}

const isErrorResponse = (value: unknown): value is { error: string } =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  typeof value.error === "string";

interface SourceSubmission {
  markdown: string;
  title: string;
}

interface ApprovalSubmission {
  maxCostUsd: number;
  text: string;
  title: string;
}

const request = async (
  path: string,
  options: RequestInit
): Promise<typeof Schema.Json.Type> => {
  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = isErrorResponse(body)
      ? body.error
      : "The narration service could not complete this request.";
    throw new PipelineError(message, response.status);
  }
  return response.status === 204
    ? null
    : Schema.decodeUnknownSync(Schema.Json)(await response.json());
};

interface PendingReview {
  id: string;
  status: JobStatus;
}

const pendingReview = (
  pending: PendingReview | null,
  jobs: readonly PipelineJob[]
) =>
  pending &&
  jobs.some((job) => job.id === pending.id && job.status !== pending.status)
    ? null
    : pending;

const visibleDetail = (
  pending: PendingReview | null,
  detail: JobDetail | null
) => (pending?.id === detail?.job.id ? null : detail);

const usePipeline = () => {
  const [session, setSession] = useState<PipelineSession | null>(null);
  const [jobs, setJobs] = useState<PipelineJob[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [requestError, setRequestError] = useState("");
  const [busy, setBusy] = useState(false);
  const actionRef = useRef<AbortController | null>(null);
  const pendingReviewRef = useRef<PendingReview | null>(null);
  const refreshJobsRef = useRef<(() => void) | null>(null);
  const refreshSessionRef = useRef<(() => void) | null>(null);

  const handleError = useCallback((failure: Error) => {
    if (failure instanceof PipelineError && failure.status === 401) {
      setSession({ authenticated: false, configured: true });
      setJobs(null);
      setDetail(null);
      setSelectedId(null);
      selectArticle(ARTICLE);
    }
    setRequestError(failure.message);
  }, []);

  useEffect(() => {
    let controller: AbortController | null = null;
    const checkSession = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const value = Schema.decodeUnknownSync(SessionSchema)(
          await request("/session", {
            signal: current.signal,
          })
        );
        if (!current.signal.aborted) {
          setSession(value);
        }
      } catch (error) {
        if (!current.signal.aborted) {
          handleError(
            error instanceof Error
              ? error
              : new Error("Could not check access.")
          );
        }
      }
    };
    refreshSessionRef.current = () => {
      void checkSession();
    };
    void checkSession();
    return () => {
      controller?.abort();
      refreshSessionRef.current = null;
    };
  }, [handleError]);

  useEffect(() => () => actionRef.current?.abort(), []);

  useEffect(() => {
    if (!session?.authenticated || !session.configured || busy) {
      return;
    }
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (stopped || document.visibilityState !== "visible" || controller) {
        return;
      }
      const current = new AbortController();
      controller = current;
      try {
        const result = Schema.decodeUnknownSync(JobListSchema)(
          await request("/jobs", {
            signal: current.signal,
          })
        );
        const selected = selectedId
          ? Schema.decodeUnknownSync(JobDetailSchema)(
              await request(`/jobs/${encodeURIComponent(selectedId)}`, {
                signal: current.signal,
              })
            )
          : null;
        if (!stopped && !current.signal.aborted) {
          pendingReviewRef.current = pendingReview(
            pendingReviewRef.current,
            result.jobs
          );
          setJobs([...result.jobs]);
          setDetail(visibleDetail(pendingReviewRef.current, selected));
          if (
            pendingReviewRef.current ||
            result.jobs.some((job) => ACTIVE_STATES.has(job.status)) ||
            (selected && ACTIVE_STATES.has(selected.job.status))
          ) {
            // Schedule after completion, never overlapping slow requests.
            timer = setTimeout(refresh, 3000);
          }
        }
      } catch (error) {
        if (!stopped && !current.signal.aborted) {
          handleError(
            error instanceof Error
              ? error
              : new Error("Could not load narrations.")
          );
        }
      }
      controller = null;
      // A tab may become visible again before an aborted fetch settles.
      if (
        !stopped &&
        current.signal.aborted &&
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        void refresh();
      } else {
        controller?.abort();
      }
    };
    refreshJobsRef.current = visibility;
    void refresh();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      refreshJobsRef.current = null;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    busy,
    handleError,
    selectedId,
    session?.authenticated,
    session?.configured,
  ]);

  const perform = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (actionRef.current) {
      return;
    }
    const controller = new AbortController();
    actionRef.current = controller;
    setBusy(true);
    setRequestError("");
    try {
      await action(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        handleError(
          error instanceof Error
            ? error
            : new Error("The request failed. Please check your connection.")
        );
      }
    }
    if (!controller.signal.aborted) {
      actionRef.current = null;
      setBusy(false);
    }
  };

  // Leaves the app for Google and returns here.
  const signIn = () => perform(() => googleSignIn());
  const signOut = () =>
    perform(async () => {
      await googleSignOut();
      setSession({ authenticated: false, configured: true });
      setJobs(null);
      setDetail(null);
      setSelectedId(null);
      selectArticle(ARTICLE);
    });
  const submitUrl = (url: string) =>
    perform(async (signal) => {
      const result = Schema.decodeUnknownSync(CreatedJobSchema)(
        await request("/jobs", {
          body: JSON.stringify({ url }),
          method: "POST",
          signal,
        })
      );
      setSelectedId(result.job.id);
      setDetail(null);
    });
  const submitReview = (
    id: string,
    stage: "source" | "approve",
    body: SourceSubmission | ApprovalSubmission
  ) =>
    perform(async (signal) => {
      await request(`/jobs/${encodeURIComponent(id)}/${stage}`, {
        body: JSON.stringify(body),
        method: "POST",
        signal,
      });
      pendingReviewRef.current = {
        id,
        status: stage === "source" ? "source_ready" : "draft_ready",
      };
      setDetail(null);
    });
  const handleReload = () => {
    setRequestError("");
    if (session?.authenticated) {
      refreshJobsRef.current?.();
    } else {
      refreshSessionRef.current?.();
    }
  };

  return {
    busy,
    detail,
    error: requestError,
    handleReload,
    jobs,
    selectedId,
    session,
    setSelectedId,
    signIn,
    signOut,
    submitReview,
    submitUrl,
  };
};

type Pipeline = ReturnType<typeof usePipeline>;

const SourceReview = ({
  detail,
  pipeline,
}: {
  detail: JobDetail;
  pipeline: Pipeline;
}) => {
  const [title, setTitle] = useState(detail.source?.title ?? detail.job.title);
  const [markdown, setMarkdown] = useState(detail.source?.markdown ?? "");
  return (
    <form
      className="pipeline-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() && markdown.trim()) {
          void pipeline.submitReview(detail.job.id, "source", {
            markdown,
            title: title.trim(),
          });
        }
      }}
    >
      <fieldset disabled={pipeline.busy}>
        <legend>Review extracted source</legend>
        <p id="source-help">
          Review the full extracted Markdown. Select and delete irrelevant text.
          Only the text left below will be adapted.
        </p>
        <label htmlFor="source-title">Article title</label>
        <input
          id="source-title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor="source-markdown">Source Markdown</label>
        <textarea
          id="source-markdown"
          required
          rows={14}
          aria-describedby="source-help"
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
        />
        <button type="submit">
          {pipeline.busy ? "Submitting source…" : "Adapt selected text"}
        </button>
      </fieldset>
    </form>
  );
};

const DraftReview = ({
  detail,
  pipeline,
}: {
  detail: JobDetail;
  pipeline: Pipeline;
}) => {
  const [title, setTitle] = useState(detail.draft?.title ?? detail.job.title);
  const [text, setText] = useState(detail.draft?.text ?? "");
  const [maximum, setMaximum] = useState(
    String(Math.max(10, Math.ceil(detail.job.estimatedTtsUsd * 100) / 100))
  );
  const [approved, setApproved] = useState(false);
  const originalLength =
    detail.job.characters || detail.draft?.text.length || 1;
  const estimate = (detail.job.estimatedTtsUsd * text.length) / originalLength;
  const maxCostUsd = Number(maximum);
  const budgetValid =
    Number.isFinite(maxCostUsd) &&
    maxCostUsd > 0 &&
    maxCostUsd <= 50 &&
    maxCostUsd >= estimate;
  const budgetError = budgetValid
    ? ""
    : "Enter a positive maximum that covers the estimated speech cost.";
  return (
    <form
      className="pipeline-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (approved && budgetValid && title.trim() && text.trim()) {
          void pipeline.submitReview(detail.job.id, "approve", {
            maxCostUsd,
            text,
            title: title.trim(),
          });
        }
      }}
    >
      <fieldset disabled={pipeline.busy}>
        <legend>Review narration draft</legend>
        <p id="draft-help">
          Review and edit without spending speech-generation credits. Audio is
          generated only after your explicit approval below.
        </p>
        <label htmlFor="draft-title">Narration title</label>
        <input
          id="draft-title"
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setApproved(false);
          }}
        />
        <label htmlFor="draft-text">Narration text</label>
        <textarea
          id="draft-text"
          required
          rows={14}
          aria-describedby="draft-help"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setApproved(false);
          }}
        />
        <p className="cost-estimate">
          Estimated speech cost for this narration:{" "}
          <strong>${estimate.toFixed(2)} USD</strong>
        </p>
        <p id="cost-help" className="small-text">
          Approximate speech-only estimate, scaled to your edited text. Excludes
          LLM adaptation, extraction, and other provider charges. Final speech
          cost may differ. This approval limits the estimate, not the provider’s
          invoice; use provider account limits for a hard spending cap.
        </p>
        <label htmlFor="maximum-cost">Maximum approved speech cost (USD)</label>
        <input
          id="maximum-cost"
          type="number"
          min="0.01"
          max="50"
          step="0.01"
          required
          inputMode="decimal"
          aria-describedby={`cost-help${budgetError ? " budget-error" : ""}`}
          aria-invalid={!budgetValid}
          value={maximum}
          onChange={(event) => {
            setMaximum(event.target.value);
            setApproved(false);
          }}
        />
        {budgetError && (
          <p id="budget-error" className="form-error" role="alert">
            {budgetError}
          </p>
        )}
        <label className="approval-label">
          <input
            type="checkbox"
            required
            checked={approved}
            onChange={(event) => setApproved(event.target.checked)}
          />
          <span>
            I approve speech generation for this narration up to the maximum
            above.
          </span>
        </label>
        <button type="submit">
          {pipeline.busy
            ? "Submitting approval…"
            : "Confirm and generate audio"}
        </button>
      </fieldset>
    </form>
  );
};

const JobReview = ({
  detail,
  pipeline,
}: {
  detail: JobDetail;
  pipeline: Pipeline;
}) => {
  const { job } = detail;
  const stageIndex = STAGES.findIndex((stage) => stage.status === job.status);
  return (
    <section className="panel job-detail" aria-labelledby="job-title">
      <h2 id="job-title">{job.title || "New narration"}</h2>
      <p className="job-source">{job.url}</p>
      <output className="job-status">{stageLabel(job.status)}</output>
      <ol className="job-stages" aria-label="Narration progress">
        {STAGES.map((stage, index) => (
          <li
            key={stage.status}
            aria-current={job.status === stage.status ? "step" : undefined}
          >
            {stage.label}
            {index < stageIndex ? " · Complete" : ""}
          </li>
        ))}
      </ol>
      {job.status === "generating" && job.totalChunks > 0 && (
        <div className="chunk-progress">
          <label htmlFor="speech-progress">
            Speech segments: {job.completedChunks} of {job.totalChunks}
          </label>
          <progress
            id="speech-progress"
            max={job.totalChunks}
            value={job.completedChunks}
          />
        </div>
      )}
      {ACTIVE_STATES.has(job.status) && (
        <p>
          You can leave this page while the server works. Progress updates every
          3 seconds while this page is visible.
        </p>
      )}
      {job.status === "source_ready" && (
        <SourceReview detail={detail} pipeline={pipeline} />
      )}
      {job.status === "draft_ready" && (
        <DraftReview detail={detail} pipeline={pipeline} />
      )}
      {(job.status === "failed" || job.status === "uncertain") && (
        <div className="job-failure" role="alert">
          <p>
            {job.status === "uncertain"
              ? "The provider outcome is uncertain. Speech may have been generated or billed."
              : "This narration could not be completed."}
          </p>
          {job.error && <p>{job.error}</p>}
          <p>
            No automatic retry will run. Check the job and provider status
            before starting another narration to avoid duplicate charges.
          </p>
        </div>
      )}
      {job.status === "ready" && (
        <Link
          className="text-link"
          to="/"
          onClick={() =>
            selectArticle({
              audioUrl: `${API}/jobs/${encodeURIComponent(job.id)}/audio`,
              author: "Your narration",
              durationSeconds: job.durationSeconds ?? 0,
              id: job.id,
              sourceUrl: job.url,
              title: job.title,
              version: job.id,
            })
          }
        >
          Listen
        </Link>
      )}
    </section>
  );
};

const NewArticleForm = ({ pipeline }: { pipeline: Pipeline }) => {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const submitUrl = () => {
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        setUrlError(
          "Enter a valid HTTPS article URL without embedded credentials."
        );
        return;
      }
      setUrlError("");
      void pipeline.submitUrl(parsed.href);
    } catch {
      setUrlError(
        "Enter a valid HTTPS article URL without embedded credentials."
      );
    }
  };
  return (
    <form
      className="panel pipeline-form"
      onSubmit={(event) => {
        event.preventDefault();
        submitUrl();
      }}
    >
      <fieldset disabled={pipeline.busy}>
        <legend>Start with an article</legend>
        <label htmlFor="article-url">Article URL</label>
        <input
          id="article-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          required
          placeholder="https://example.com/article"
          aria-invalid={Boolean(urlError)}
          aria-describedby={`url-help${urlError ? " url-error" : ""}`}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setUrlError("");
          }}
        />
        <p id="url-help">
          Use an HTTPS link. Extraction and adaptation may incur provider
          charges. Speech generation waits for your approval.
        </p>
        {urlError && (
          <p id="url-error" className="form-error" role="alert">
            {urlError}
          </p>
        )}
        <button type="submit">
          {pipeline.busy ? "Working…" : "Create draft"}
        </button>
      </fieldset>
    </form>
  );
};

const JobList = ({ pipeline }: { pipeline: Pipeline }) => {
  const { busy, jobs, selectedId, detail } = pipeline;
  return (
    <>
      <section className="panel job-list" aria-labelledby="jobs-title">
        <div className="section-heading">
          <h2 id="jobs-title">Your narrations</h2>
          <button type="button" disabled={busy} onClick={pipeline.handleReload}>
            Refresh jobs
          </button>
        </div>
        {!jobs && <p>Loading narrations…</p>}
        {jobs?.length === 0 && (
          <p>No narrations yet. Start with an article link above.</p>
        )}
        {jobs && jobs.length > 0 && (
          <ul>
            {jobs.map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={selectedId === job.id}
                  onClick={() => pipeline.setSelectedId(job.id)}
                >
                  <span>{job.title || job.url}</span>
                  <span className="job-list-status">
                    {stageLabel(job.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {selectedId && detail?.job.id !== selectedId && (
        <output>Loading selected narration…</output>
      )}
      {detail && detail.job.id === selectedId && (
        <JobReview
          key={`${detail.job.id}:${detail.job.status}`}
          detail={detail}
          pipeline={pipeline}
        />
      )}
    </>
  );
};

const Create = () => {
  const pipeline = usePipeline();
  const { session, busy } = pipeline;
  const signInError = route.useSearch().error;
  return (
    <main id="main-content" className="app-shell create-page" tabIndex={-1}>
      <header className="app-header">
        <img src="/icon.svg" alt="" width={44} height={44} />
        <span className="app-name">Dyslexia</span>
        <Link className="text-link header-link" to="/">
          Home
        </Link>
      </header>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Your listening library</p>
        <h1 id="page-title">Create narration</h1>
        <p className="intro-text">
          Turn an article into audio. Choose the source text, review the
          narration, then approve speech generation.
        </p>
      </section>
      {pipeline.error && (
        <div className="panel pipeline-error">
          <p role="alert" id="pipeline-error">
            {pipeline.error} Nothing will be resubmitted automatically. Refresh
            the status before trying again.
          </p>
          <button type="button" disabled={busy} onClick={pipeline.handleReload}>
            Refresh status
          </button>
        </div>
      )}
      {!session && !pipeline.error && <output>Checking access…</output>}
      {session && !session.configured && (
        <section className="panel" aria-labelledby="setup-title">
          <h2 id="setup-title">Narration setup needed</h2>
          <p>
            Ask the server owner to configure Google sign-in and the required
            narration providers.
          </p>
          <button
            className="setup-refresh"
            type="button"
            onClick={pipeline.handleReload}
          >
            Check setup again
          </button>
        </section>
      )}
      {session?.configured && !session.authenticated && (
        <section className="panel" aria-labelledby="sign-in-title">
          <h2 id="sign-in-title">Sign in</h2>
          {signInError && (
            <p role="alert">
              {signInError === ACCOUNT_NOT_ALLOWED
                ? "That Google account cannot use this app. Choose your own account."
                : "Sign-in did not finish. Try again."}
            </p>
          )}
          <p>This device stays signed in for a year of use.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void pipeline.signIn();
            }}
          >
            {busy ? "Opening Google…" : "Sign in with Google"}
          </button>
        </section>
      )}
      {session?.configured && session.authenticated && (
        <>
          <div className="session-actions">
            <p>Personal session active</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void pipeline.signOut();
              }}
            >
              Sign out
            </button>
          </div>
          <NewArticleForm pipeline={pipeline} />
          <JobList pipeline={pipeline} />
        </>
      )}
    </main>
  );
};

export const Route = createFileRoute("/create")({
  component: Create,
  validateSearch: Schema.toStandardSchemaV1(CreateSearch),
});
