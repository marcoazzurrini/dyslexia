# First playback test: technical proposal

## Status and purpose

The first playback test uses TanStack Start and pregenerated audio served as a static file. This document proposes the remaining technical choices; it does not cover deployment execution or paid audio generation.

The test should establish whether a source-preserving narration sample remains understandable and whether an installed web app plays reliably on a locked iPhone. It is not the article-importing application yet.

No application scaffolding, audio generation, or deployment has been performed for this proposal.

## Proposed stack

- TanStack Start, React, and TypeScript.
- Start's SPA mode, with the prerendered shell and assets served by an HTTPS static host for this test.
- A browser-native HTML `<audio>` element for playback.
- The Media Session API as a progressive enhancement for metadata and supported external controls.
- A small static TypeScript or JSON record for the article and audio metadata.
- `localStorage` for this device's playback position and preferred speed.
- A web app manifest and icons for installation.

**No database, TanStack Query, application API, background queue, object-storage service, or service worker is required for this test.**

TanStack Start remains the application framework. Deploying its static output initially does not mean replacing it with a different framework. Future server functions and server routes will require a suitable server deployment; static hosting alone cannot execute them.

## Why no database?

There is one known article and one prepared recording. Store their metadata in the codebase. Store the playback position locally on the phone.

Local browser storage is not a durable account-level library: it can be cleared, is associated with a particular origin and browser context, and does not synchronize across devices. Those are acceptable limitations for this test. Read and write browser storage only on the client, not during build-time prerendering.

Save a position keyed by article identity and audio version. Replacing the recording must not restore a timestamp from a different version. Save periodically while events are available and on pause, seek, and page visibility changes. Do not rely only on unload handlers. Handle storage failures without stopping playback.

Background JavaScript can be suspended. Recovery after force-quitting a backgrounded app is therefore best effort and must be measured. A database would not, by itself, solve missed client-side progress updates.

Add a database when persistent article records, generation jobs, or cross-device progress actually require one.

## Why no TanStack Query?

TanStack Start does not require TanStack Query. TanStack Router supplies its own data-loading facilities, and a static article record does not even require an asynchronous route loader.

Query becomes useful when the application has server data to manage: generation status, mutations, a changing library, or progress synchronization. Query is not an audio player and should not be used to fetch the complete MP3 into application state. Let the media element and browser request the media directly.

## Audio generation and files

Generate the reviewed sample outside the running web app with a small local script using Fish's API. The generation script is a development tool, not the product interface.

- Keep the Fish API key in a local, ignored secret file or environment variable.
- Never expose it through a client-visible environment variable, the public directory, or a bundled import.
- Review the narration and show an estimated generation cost before making the paid request. Do not implement a monthly spending cap.
- Generate a complete opening section with its necessary context. A several-minute sample is sufficient to begin; a longer recording can later exercise a sustained walking session.
- Prefer one MP3 for the first test. It avoids testing background transitions between multiple files at the same time as basic playback.
- Serve it at a versioned URL, for example `/audio/conway-opening-v1.mp3`.
- Keep metadata such as title, author, source URL, audio URL, and audio version in a small static record.
- Keep the reviewed narration text and relevant visual references available. Automatic word highlighting and timestamp alignment are outside this test.

Generated audio is a deployable fixture, not necessarily a file to commit to a public Git repository. Build and upload procedures must account for it if it remains untracked.

A static file URL does not imply offline playback or a permanent download to the phone. The browser can buffer and cache data, but the test assumes a network connection. Playback requires no manual file transfer or audio import.

## Playback design

Use a stable `<audio>` element rather than Web Audio or a custom streaming engine. Begin with native controls as a baseline, adding speed selection and small skip controls as needed. Keep the media element mounted when navigating within the app.

Start playback only after a user gesture. Handle rejected playback requests, loading, network errors, and unknown duration without leaving misleading UI state.

Feature-detect the Media Session API. Supply title and author metadata, then register only supported play, pause, and seek handlers. Unsupported actions must not break playback. Update playback and position metadata when supported and valid.

Media Session exposes controls; it does not guarantee background playback. A service worker would not guarantee it either. iOS can suspend or terminate the app, and behavior must be verified on the actual device and iOS version.

## PWA scope

Provide HTTPS, a linked manifest, appropriate icons, a start URL, and standalone display configuration. Test both a Safari tab and the installed Home Screen app; success in one does not prove success in the other.

Do not add a service worker for the initial baseline. Current installability guidance does not require one. It is useful later for a deliberate offline strategy, but installing a PWA does not automatically make its media available offline.

Avoiding a service worker also removes one source of media-caching and byte-range failures during this test. If a scaffold includes one, ensure it does not intercept or precache the audio by accident.

## Hosting requirements and access

The deployment must provide:

- A phone-accessible HTTPS origin.
- Correct MP3 content type, normally `audio/mpeg`.
- Reliable byte-range responses for media seeking and partial retrieval. Verify an actual `Range` request returns `206 Partial Content` with the expected `Content-Range`, rather than relying only on an advertised header.
- Static assets served before the SPA fallback. A missing audio path must not silently return the application shell as HTML.
- Direct reloads and the installation start URL routed correctly to the app.

Keep the app and recording on the same origin initially to avoid unnecessary CORS configuration. A dedicated object-storage service can be added later when the library grows or deployment limits justify it.

The hosting decision remains open:

- **Private HTTPS deployment:** closer to real use and independent of the laptop. Prefer host-level access control rather than building application accounts for the test. Protection must cover media URLs as well as the app shell and must not interrupt seeking with login responses.
- **HTTPS tunnel to the laptop:** avoids a permanent deployment, but the computer and connection must remain available throughout the walk. Verify media range handling through the tunnel.

An unlisted public URL is not access control. Publishing application source does not imply permission to publish generated audio or source articles. Determine media access and redistribution requirements separately. A `robots` directive is not access control either.

## Acceptance tests

Record the iPhone model, iOS version, test origin, and whether each run uses Safari or Home Screen mode.

1. Start playback through a user gesture and verify sound, duration, and seek behavior.
2. Change playback speed and verify that playback remains understandable.
3. Lock the phone and continue listening for the duration of the sample.
4. Pause and resume through supported lock-screen or headset controls.
5. Switch to another app, then return without restarting the recording.
6. Exercise an interruption such as another media app or a call. Check that playback can resume; do not assume automatic resumption is desirable.
7. Reload or reopen the app and check the saved position and speed. Record any position loss after background termination.
8. Seek to an unbuffered portion and verify byte-range delivery on the deployed host.
9. Change connectivity and ensure loading or playback failure is recoverable. Offline operation is not a passing requirement yet.
10. Open the source or a visual reference without unnecessarily destroying the player.

Desktop browser automation can cover controls and state restoration. It cannot certify real iPhone background playback. That requires a device test.

## Remaining decisions before implementation

1. Deployment versus a temporary HTTPS tunnel, including whether access should be private.
2. The exact recording sample and Fish voice, followed by review of the script and estimated cost.
3. The iPhone and iOS version used for the acceptance test.

The database and TanStack Query choices do not need to block this test: both can be deferred without losing the chosen application framework.

## Sources

- [TanStack Start: SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)
- [TanStack Start: static prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering)
- [TanStack Router: data loading and optional external caches](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading)
- [MDN: making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN: Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
- [MDN: HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)
- [Workbox: serving cached audio and video](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video)

Narration preparation should follow the separate [audio content evidence review](audio-content-preparation.md).
