# Design decisions

This file records decisions and constraints that should hold as the code changes. It does not describe the implementation; read the code for that.

## Making narrations

- **A link in, a recording out.** Nobody reviews or approves anything along the way. A narration is either being made, ready to play, or failed with a reason.
- **Failure leaves nothing behind.** When a narration fails, everything it made is deleted and only the reason is kept, so the listener can try again or remove it.
- **Length caps the cost.** Articles longer than 100,000 characters of extracted text are refused, which caps one narration at about $8 of speech.
- **Retry only what may pass.** Network errors and timeouts are retried a few times. A page that cannot be read, a refused API key, or an article that is too long is not.
- **One retry owner per failure.** The app retries expected failures; the platform retries only crashes. Do not stack retries on the same call.
- **Finished steps are not repeated.** A run that restarts continues from its last finished step, so paid work is not done twice.
- **Extracted pages are untrusted data.** The adaptation model gets no tools or credentials, and treats the page as material to narrate, never as instructions.
- **Trust the model; fix quality in the prompt.** The page arrives with its clutter, and the prompt tells the model what to leave out. Do not check the model's output with word-counting heuristics. When narrations go wrong, improve the prompt first, then try a better model.
- **Site quirks live in one place.** When a site needs special help to be read, that help goes in one list next to the reader, with the reason it exists. The rest of the app never asks which site a link is on.
- **Hard limits live with the providers.** Set spending caps in each provider account.

## Interface

- **It should feel like an iPhone app.** Follow iOS patterns people already know: large titles, inset grouped lists, sheets, and a player that stays in reach on every screen.
- **Comfortable to read.** Use a soft background and never pure black text, at least 1.5 line spacing for running text, sentence case rather than capitals, and the system font at the size the reader chose in iOS settings.
- **One main action per screen.** The next step is the most visible control.
- **Every state explains itself.** Loading, empty, in-progress, and failed states say what happened and what to do next.
- **Design system first.** Screens are built from the shared components and tokens, and each component and screen state has a story to review it in isolation.

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
