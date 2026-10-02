# Isolated audio assembler

This private container performs only MP3 assembly. Expose port `8080` through the Worker's Container binding, not a public ingress. The Worker authenticates callers and issues a per-job capability. The container has no provider credentials and never calls generation providers.

## Contract

`GET /health` returns HTTP 200 with `{"ok":true}`.

`POST /assemble` accepts `Content-Type: application/json` and at most 4096 bytes:

```json
{
  "jobId": "12345678-1234-4234-8234-123456789abc",
  "baseUrl": "https://dyslexia.marcoazzurrini.com",
  "token": "per-job-scoped-capability",
  "chunkCount": 2
}
```

The UUID must have an RFC variant and version 1–8. `chunkCount` is an integer from 1 through 40. The token must use bearer-token characters and contain 1–2048 characters. Extra properties are rejected.

Production origins are restricted to HTTPS, with no explicit port:

- `https://dyslexia.marcoazzurrini.com`
- `https://dyslexia.marco-azzurrini-art.workers.dev`

A trailing root slash is accepted. Credentials, paths, queries, fragments, URL normalization tricks, other hosts, and redirects are rejected.

`ALLOW_LOCAL_ASSEMBLY=true` additionally allows HTTP origins with the exact host `127.0.0.1`, `localhost`, or `host.docker.internal`, optionally with a port from 1 through 65535. The default is `false`; other values do not enable local mode. No other environment setting is required. The server listens on `0.0.0.0:8080`.

For indices `0..chunkCount-1`, the container sequentially downloads:

```text
GET {baseUrl}/api/pipeline/internal/jobs/{jobId}/chunks/{index}
Authorization: Bearer {token}
```

Chunks are limited to 8 MiB each and 128 MiB in total. Both declared and streamed sizes are checked. An empty, missing, or unsuccessful chunk fails the request. All files use generated names in a new private temporary directory. FFmpeg uses the concat demuxer, safe relative filenames, file-only input, and MP3 stream-copy in index order. Input chunks must have compatible MP3 stream parameters. FFprobe reads the assembled MP3's actual duration.

The completed file is uploaded once:

```text
PUT {baseUrl}/api/pipeline/internal/jobs/{jobId}/audio
Authorization: Bearer {token}
Content-Type: audio/mpeg
Content-Length: {actual file size}
```

Any non-2xx upload fails. Redirects are disabled for downloads and uploads. After a successful upload and scoped cleanup, HTTP 200 returns:

```json
{ "durationSeconds": 1.234, "bytes": 12345 }
```

The Worker records the manifest and completes the job. The artifact endpoint must validate capability scope and make repeated PUTs to the same job safe. A lost response can mean the upload succeeded; retrying assembly downloads the same chunks and replaces the same final artifact without any provider call. The container keeps no durable receipt, cache, or cross-instance deduplication state.

Only one request is processed at a time, including body parsing and cleanup. Overlapping requests receive HTTP 409 `{"error":"busy"}`; health remains available. There is no queue and no automatic retry. Body reading and assembly share a five-minute deadline; each FFmpeg/FFprobe subprocess has a 60-second limit. Client disconnects abort work. Cleanup waits for aborted subprocesses and I/O to settle before removing files and releasing the busy lock.

Other failures return JSON `{"error":"code"}` with 400 for invalid input, 413 for size limits, 415 for unsupported body encoding/type, 502 for assembly or upstream failures, 504 for deadlines, or 500 for local setup failures. Tokens, upstream bodies, and command output are not included in error responses.

Temporary files are ephemeral. Effect 4 scopes clean up successful, failed, and interrupted requests; hard process termination can bypass finalizers. There are no reuse or persistence guarantees.

## Verification

From the repository root, install only this package and run the deterministic suite. No FFmpeg binary, Docker, provider call, or network service is required; HTTP tests bind only to loopback and inject the command runner.

```sh
npm ci --prefix containers/assembler --omit=dev --ignore-scripts
node --test scripts/assembly.test.mjs
```

The Docker build context must be `containers/assembler`, not the repository root:

```sh
docker build -t dyslexia-assembler ./containers/assembler
docker run --rm --network none dyslexia-assembler node smoke.mjs
```

The smoke check creates two short MP3 fixtures inside the container, starts local artifact and assembly HTTP servers, performs a real concat/upload, verifies headers and duration with FFprobe, then removes fixtures. It requires no published port or outside network. If FFmpeg and FFprobe are already installed locally, `node containers/assembler/smoke.mjs` runs the same check without Docker.

The image pins `node:24.20.0-bookworm-slim`, installs FFmpeg without recommended packages, uses the package lock with production-only `npm ci`, and runs as non-root `appuser` with writable `/tmp`. No root application dependency or configuration change is needed by the image.
