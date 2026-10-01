# One-article narration test

## Scope

Prepare the complete article, **How I Vibed a Proof of Conway’s Conjecture**, by Dan Abramov, for one listening test:

<https://overreacted.io/how-i-vibed-a-proof-of-conways-conjecture/>

This is not an article importer or an automated adaptation pipeline. Source preparation and narration review happen once. The reusable part is a local ElevenLabs generation script. The user-supplied `page.html` has been extracted and adapted in full under `.local/narration/`. The local folder includes `article.txt`, `narration.txt`, and a block-by-block adaptation map. The complete recording is now generated. Playback and R2 delivery are a separate step described in [the player guide](playback.md); generation itself never uploads audio.

## Local files

Keep the supplied source and the reviewed narration under `.local/narration/`, which is ignored by Git. Use a UTF-8 plain-text file named `narration.txt` for the exact words to be spoken. The script does not interpret Markdown, equations, image URLs, or code; those need review and conversion into spoken wording before generation.

Follow [the content preparation review](research/audio-content-preparation.md): preserve the author's meaning, preserve meaningful technical details, identify additions, and do not guess at unexplained visuals. Check the entire article rather than stopping at an excerpt. Keep the source separate from the narration.

## Credentials and voice

Create `.env` at the project root:

```dotenv
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=your_selected_voice_id
```

The voice ID is optional until generation. List the first 100 voices available to the account without generating audio:

```sh
npm run narrate -- --voices
```

Choose a voice in ElevenLabs before generating a long recording. Use the same voice for every chunk. George (`JBFqnCBsd6RMkjVDRZzb`) is the stock voice selected for the first technical test; pass it with `--voice` or set `ELEVENLABS_VOICE_ID`. No voice cloning is performed. The key needs permission to generate speech and, if listing voices, read the voice library. Metadata lookups can return `401 missing_permissions` for a key restricted to speech generation; that does not mean the key is invalid. Do not add a `VITE_` prefix, paste the key into a prompt, or commit it.

## Plan before spending

Without `--generate`, the script reads local files and prints a plan. It makes no API requests and requires no key:

```sh
npm run narrate -- --input .local/narration/narration.txt
```

The plan reports the model, selected voice, number of chunks, total characters, and characters that still require generation. Pass the current account rate to calculate an estimate:

```sh
npm run narrate -- --input .local/narration/narration.txt \
  --rate-usd-per-1k 0.08
```

`0.08` is an example rate, not a promise about the account's bill. Check [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) and the account dashboard. Promotional rates, allowances, taxes, and voice surcharges can change the actual amount. Review the complete narration and the estimate before authorizing generation. No monthly spending cap is implemented.

## Generate

Install `ffmpeg` locally before generating. Explicitly request the paid operation using the reviewed account rate:

```sh
npm run narrate -- --input .local/narration/narration.txt \
  --rate-usd-per-1k 0.08 --generate
```

The script uses `eleven_v4`, `mp3_44100_128`, stability `0.7`, and similarity `0.75`. It does not use unsupported v4 speed/style controls or SSML. Defaults split at paragraph or sentence boundaries up to 4,000 UTF-16 code units, conservatively below the documented 10,000-character limit. A long unbroken token fails for manual review instead of being silently dropped. `--chunk-size` accepts 100–10,000.

Requests run sequentially. The script caches each chunk by its exact text, voice, model, output format, and settings. It validates cached bytes against a saved SHA-256 digest before reuse. A changed input or voice cannot accidentally reuse incompatible audio.

Files go to `.local/narration/audio/` by default. `--output` changes that directory. The final recording is named `narration-<plan-id>.mp3`. FFmpeg decodes and re-encodes the ordered chunks into one MP3; this avoids relying on raw MP3 file concatenation. Saved plan and receipt files record generation metadata, not API keys. There is no automatic upload, public asset copy, commit, or deployment.

## Interrupted runs

Run the same command again to reuse completed chunks. Successful chunks are not billed again. The final assembly can also be retried without calling ElevenLabs again.

There are deliberately **no automatic paid retries**. A timeout can occur after ElevenLabs has already charged for and generated a chunk. The script writes a `<chunk-id>.pending` marker before each request and refuses another request for that chunk until the outcome is reviewed.

1. Check ElevenLabs history for the uncertain request.
2. If audio exists, recover it rather than immediately paying again. Keep the marker until the saved audio and its receipt have been restored together.
3. If the request did not generate audio, remove only that chunk's pending marker, then run the command again.
4. A forcibly terminated process can leave `generation.lock`. Confirm no generation process remains before removing that lock.

A damaged cached file causes an error, not silent regeneration. Recover the file, or deliberately remove the damaged file and its receipt if another paid generation is acceptable.

## Playback handoff

Listen through the assembled recording before loading it into the app. Check omissions, repeated phrases, pronunciations, equations, added descriptions, and audible changes at chunk boundaries. Generation success does not establish narration quality.

All 12 chunks are assembled in `.local/narration/audio/narration-b2ac2e01fb55c21c.mp3`: 50 minutes and 34.32 seconds, 48.55 MB. File checks confirm that its duration matches the sum of the chunks. A listening review is still required.

The app uses Video.js v10 over native audio. The recording is stored separately in R2 because it exceeds the static asset size limit; Git builds do not receive the ignored local file. See [playback and hosting](playback.md) for local seeding, uploads, byte-range verification, and physical iPhone checks. The app's audio route remains publicly reachable until access control is added.

## Verification

```sh
npm run test:scripts
npm run ci
```

Script tests use synthetic text and mocked HTTP responses. They never contact ElevenLabs or spend account funds.

## References

- [Eleven v4](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4)
- [Create speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
- [API pricing](https://elevenlabs.io/pricing/api)
