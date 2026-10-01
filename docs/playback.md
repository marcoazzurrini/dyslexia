# First article player

## Scope

One completed recording of Dan Abramov's **How I Vibed a Proof of Conway’s Conjecture** is ready for a phone listening test. The MP3 lasts 50 minutes and 34.32 seconds and occupies 48.55 MB. The browser does not call ElevenLabs or generate narration.

Playback uses one native audio element, Media Chrome controls, and optional Media Session integration. Position and speed are saved on the current device, keyed by article and recording version. This is not cross-device synchronization. Browser storage can be cleared or denied; playback must still work.

The player remains mounted at the application root during client-side navigation. Playback requires a user gesture. Closing or force-quitting the browser ends playback; reopening can restore the last saved position without autoplay. Background suspension may prevent the most recent position from being saved.

## Audio delivery

The unchanged MP3 is stored in the `dyslexia-audio` R2 bucket. It exceeds Workers Static Assets' 25 MiB per-file limit, so it is not bundled in the app, committed to Git, or downloaded into React state.

- Binding: `AUDIO` in `wrangler.jsonc`.
- Object key: `conway-b2ac2e01fb55c21c.mp3`.
- App URL: `/audio/conway-b2ac2e01fb55c21c.mp3`.
- Metadata: `src/lib/article.ts`.
- Handler: `src/server/audio-response.ts`.

The same-origin Worker streams the object and supports `HEAD`, ordinary `GET`, and single HTTP byte ranges. Seeking returns `206 Partial Content` with accurate `Content-Range` and `Content-Length`. Unsatisfiable ranges return `416`. Conditional requests use ETags and `If-Range`. Unknown recording paths return `404`, not the SPA shell. R2 credentials stay inside Cloudflare.

The bucket has no public bucket endpoint. **The application audio route is publicly reachable because the app currently has no authentication.** Neither an unlisted URL nor `Cache-Control: private` provides access control. Authentication would need to protect both the app and its audio route before private sharing or sensitive recordings are introduced. No bucket listing or upload endpoint is exposed.

### Supply the recording locally

Local development uses a separate local R2 store. It does not read production objects automatically:

```sh
npx wrangler r2 object put dyslexia-audio/conway-b2ac2e01fb55c21c.mp3 \
  --local \
  --file .local/narration/audio/narration-b2ac2e01fb55c21c.mp3 \
  --content-type audio/mpeg
npm run dev
```

Browser tests intercept audio requests with a short synthetic fixture. Server unit tests use an in-memory bucket. CI needs neither the private local narration files, Cloudflare credentials, nor an ElevenLabs key.

### Upload a production recording

The initial bucket is already provisioned. Authenticate with the intended Cloudflare account before uploading:

```sh
npx wrangler r2 object put dyslexia-audio/conway-b2ac2e01fb55c21c.mp3 \
  --remote \
  --file .local/narration/audio/narration-b2ac2e01fb55c21c.mp3 \
  --content-type audio/mpeg \
  --cache-control 'private, max-age=3600'
```

App releases still use a checked pull request and Cloudflare's Git integration. Adding an R2 binding does not copy a local recording into the bucket. Keep each recording at a versioned object key; change the version and URL together when replacing it so saved positions never point into incompatible audio. Retain previous objects while older app versions may reference them.

For a production byte-range smoke test:

```sh
curl -I 'https://dyslexia.marcoazzurrini.com/audio/conway-b2ac2e01fb55c21c.mp3'
curl -sS -D - -H 'Range: bytes=0-1' \
  'https://dyslexia.marcoazzurrini.com/audio/conway-b2ac2e01fb55c21c.mp3' \
  -o /dev/null
```

Expect `audio/mpeg`, the complete file length on `HEAD`, and `206` with `Content-Range: bytes 0-1/<size>` on the range request.

## Phone acceptance test

Automated Chromium and WebKit tests check controls and state, not physical iPhone background behavior. Record the iPhone model and iOS version; test both Safari and the Home Screen app:

1. Start playback, pause, resume, and seek to a distant, previously unbuffered position.
2. Change speed. Check that speech pitch remains natural.
3. Lock the screen and listen for several minutes. Use supported lock-screen and headset controls.
4. Switch apps, return, and follow the source link without restarting the recording.
5. Reload and confirm saved position and speed return. Playback must not start automatically.
6. Test a call or another audio app interrupting playback, then resume deliberately.
7. Lose and restore connectivity. Confirm that the player offers a useful recovery path.
8. Listen for pronunciation issues and discontinuities at generation boundaries; successful synthesis does not establish audio quality.

Media Session customizes supported system controls; it cannot guarantee background execution or prevent OS termination. No service worker, offline download, or wake-lock workaround is included. An internet connection is required.
