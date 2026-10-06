# Design decisions

This file records decisions and constraints that should hold as the code changes. It does not describe the implementation; read the code for that.

## Narration pipeline

- **Review before paying.** Each paid step waits for explicit approval of its input: the extracted source before adaptation, and the narration draft before speech. Show a cost estimate before speech.
- **No blind paid retries.** A paid request can time out after the provider has already charged. Record an intent before each paid call, reuse saved results, and stop for a human decision when the outcome is uncertain. Free steps, such as joining saved audio, may retry.
- **One retry owner per operation.** Do not stack SDK, library, and workflow retries on the same call.
- **Approved inputs are pinned.** A restarted job must not reuse paid results for changed input.
- **Extracted pages are untrusted data.** The adaptation model gets no tools or credentials, and its output is validated for completeness before review.
- **Cost estimates are not limits.** Set hard spending caps in each provider account.

## Playback

- **The browser owns the media.** Use one native audio element and let it fetch the file directly. Never load whole recordings into application state.
- **Recordings are immutable and versioned.** Saved positions are keyed by recording version, so replacing audio means a new key and URL.
- **Audio delivery must support HTTP byte ranges.** Seeking depends on correct `206` responses. A missing audio path must return `404`, never the app shell.
- **System controls are an enhancement.** Media Session improves lock-screen controls but cannot guarantee background playback. Feature-detect it.
- **Progress is device-local.** Losing browser storage must not break playback.

## Security

- Provider keys stay on the server. The browser only receives an HttpOnly session cookie.
- Paid actions require Google sign-in with an allowed account and a same-origin request. Sign-in happens inside the app, never through emailed links, because installed iPhone apps do not share sessions with Safari.
- An unlisted URL is not access control.

## Verification

- Automated tests never call paid providers or use real keys.
- Browser automation cannot certify iPhone behavior. Before relying on a playback change, run the phone test below on a real device, in both Safari and the Home Screen app. Record the model and iOS version.

### Phone test

1. Play, pause, resume, and seek to a distant, unbuffered position.
2. Change speed and check that the voice still sounds natural.
3. Lock the screen and listen for several minutes. Use lock-screen and headset controls.
4. Switch apps, return, and open the source link without restarting the recording.
5. Reload. Position and speed return, and playback does not start by itself.
6. Interrupt with a call or another audio app, then resume.
7. Lose and restore the connection. The player offers a way to recover.
8. Listen for mispronunciations and audible joins between generated chunks.
