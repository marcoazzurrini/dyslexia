# Dyslexia

An audio-first web app for listening to articles, with source-preserving narration and access to original visual content.

## Status

The repository currently contains research and a technical proposal. The application has not been scaffolded, and no audio has been generated or deployed.

## First playback test

The first iteration uses one reviewed article excerpt and a pregenerated MP3 to test playback on an iPhone, both in Safari and as an installed web app.

The test covers:

- Playback, seeking, and speed controls.
- Continued listening with the screen locked.
- Supported lock-screen and headset controls.
- Playback interruptions and resume behavior.
- Locally saved position and speed.
- Access to the source article and relevant visuals.

URL imports, a library, offline downloads, and cross-device synchronization are outside this initial test.

## Planned stack

- TanStack Start, React, and TypeScript.
- Cloudflare Workers and Workers Static Assets for deployment.
- Browser-native audio playback, with Media Session enhancements where supported.
- Local browser storage for playback position and speed.
- Fish hosted TTS for pregenerating the audio fixture outside the browser.

The first test does not require a database or TanStack Query. The hosting choice in the original playback proposal was open; Cloudflare is now the intended deployment target. The deployed recording's seeking behavior still needs verification.

## Research and design

- [Audio content preparation: evidence review](docs/research/audio-content-preparation.md)
- [First playback test: technical proposal](docs/research/first-playback-test.md)

## Secrets and media

Keep API keys in local environment files, never in browser bundles or committed files. The `.gitignore` excludes local secrets, agent sessions, build output, and generated audio.

Generated audio fixtures must be supplied separately during development and deployment. Publishing application source does not grant permission to redistribute source articles or generated recordings.
