# Dyslexia

An audio-first web app for people who find reading hard. Give it an article and it produces a narration you can listen to, while keeping access to the original text and visuals.

## Intent

- Listening comes first. The app is built around a player that works well on a phone, including from the home screen and with the screen locked.
- Narration stays faithful to the source. Adaptation makes text easier to listen to; it does not summarize or change the meaning.
- The original article is always one tap away, so nothing visual or factual is lost.
- A person reviews the work before money is spent. Paid steps such as text-to-speech run only after approval.

## How it works

1. You submit an article link.
2. The app extracts the article and shows it for review.
3. A language model adapts the text for listening, and you review the draft.
4. A text-to-speech service narrates the approved draft.
5. The audio is stored and played back in the web app.

## Working on the project

The code is the source of truth. Read `package.json` for the available scripts and the configuration files for the deployment setup. Topic notes and research live in `docs/`.

Changes go through pull requests to `main`. Checks must pass before merging, and merged changes deploy automatically.

## Secrets and content

Keep API keys in local environment files. Never commit them or expose them to the browser. `.env.example` lists the variables the app expects.

Publishing this source code does not grant permission to redistribute source articles or generated recordings.
