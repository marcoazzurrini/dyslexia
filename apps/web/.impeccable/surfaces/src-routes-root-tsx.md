---
version: 1
slug: "src-routes-root-tsx"
primary_target: "src/routes/__root.tsx"
related_targets: ["src/player/now-playing.tsx","src/screens"]
---

# Reader app shell and player

Scope: every app screen (Home, Library, Profile, sheets, mini player, full player). Visitor mode: Operate. Built around the player.

Audience and job: the owner, dyslexic, listening on the move; glances at the phone to see what is playing, how long is left, and to pause, skip, or change speed. Adds links during the day.

Constraints: keep iOS structure (tab bar, large titles, grouped lists, sheets, mini player), accessible names, and every state. Dyslexia rules from PRODUCT.md hold: no pure black text, 1.5 line spacing for running text, sentence case, system text size.

User answers: current look is generic, flat, and dull; dark mode is grim. Chose the category standard on purpose. Quality bar: Apple Podcasts.

## Direction contract

THESIS: Reader as a first-party Apple app, Apple Podcasts its sibling. It refuses the earlier look's cream paper, green accent, and icon tiles that made every row equal; each narration gets a cover, so lists and the player have a face.

OWN-WORLD: iOS system grouped grey ground (#f2f2f7 light, near-black in dark) for settings; a plain canvas (#f7f7f9 light, the same near-black dark) for media screens (Home, Library), a step lighter than the grouped gray and well off white so it does not glare; white cells, label #1c1c1e, one indigo tint (#5856d6 / #5e5ce6) for actions, selection, and progress. Generated covers: a rounded square in a hue chosen by the narration's site, its initial in white, soft offset shadow. Platform sans, iOS type scale.

STORY: The listener sees what to pick up, taps a cover, and the full player shows a large cover, title, site, a thin scrubber, and the controls; time left is readable at a glance.

FIRST VIEWPORT: Full player sheet: grabber; a cover up to 260pt (min(78%, 38vh), so the controls stay in view on short screens) centred with a soft drop shadow, shrinking when paused as in Podcasts; title 24pt bold and site in tint below, left-aligned; thin scrubber with elapsed and remaining in small tabular numerals; skip back, large play/pause glyph without a disc, skip forward; speed segmented control at the bottom.

FORM: The category standard (canon), chosen by the user from the safer re-roll; seed key 9329ac65. Signature: the cover that breathes with playback.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisions after the first build

- The user rejected the first build as "almost the same as before": generic, big rounded buttons. Home became shelves (a card per narration to pick up, large covers for what is new), Library a plain list with a play capsule per row, filters a segmented control, the add action a bare tinted glyph, Sign out a red row; corner radii tightened.
- Bottom bar: the user rejected the edge-to-edge docked bar and chose "Floating, tint only" on the decision page (mocks/bar/floating.png, approved): a floating capsule with no highlight shape, the selected tab in the tint, the mini player floating above it with play and skip forward.
- Bars are opaque, and content fades out behind them, so text never shows through or half cut beside text.
