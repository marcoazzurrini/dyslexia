---
name: Reader
description: Articles turned into narrations, in an iPhone app that sits beside Apple Podcasts.
colors:
  indigo-tint: "#5856d6"
  indigo-pressed: "#4644b8"
  indigo-text: "#4f4dcc"
  indigo-wash: "rgb(88 86 214 / 0.12)"
  grouped-gray: "#f2f2f7"
  media-canvas: "#f7f7f9"
  cell-white: "#ffffff"
  cell-pressed: "#e5e5ea"
  label-graphite: "#1c1c1e"
  label-secondary: "rgb(60 60 67 / 0.78)"
  label-tertiary: "rgb(60 60 67 / 0.5)"
  separator: "rgb(60 60 67 / 0.2)"
  control-fill: "rgb(118 118 128 / 0.12)"
  control-fill-pressed: "rgb(118 118 128 / 0.24)"
  thumb-white: "#ffffff"
  scrim: "rgb(0 0 0 / 0.3)"
  danger-red: "#d70015"
  danger-wash: "rgb(215 0 21 / 0.1)"
  success-green: "#248a3d"
  warning-amber: "#b25000"
  cover-blue: "#0062c4"
  cover-teal: "#00727a"
  cover-green: "#2b7a35"
  cover-rust: "#b8440f"
  cover-raspberry: "#b5245f"
  cover-violet: "#8a2aa6"
  cover-walnut: "#86532a"
  cover-slate: "#4a5868"
typography:
  large-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title1:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title2:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title3:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.18rem"
    fontWeight: 600
    lineHeight: 1.3
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  callout:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.94rem"
    fontWeight: 400
    lineHeight: 1.45
  subheadline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.4
  footnote:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.01em"
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.875rem"
  xl: "2.25rem"
  full: "999px"
spacing:
  xxs: "0.125rem"
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  gutter: "1.25rem"
  xxl: "1.5rem"
  xxxl: "2rem"
  huge: "3rem"
components:
  button-filled:
    backgroundColor: "{colors.indigo-tint}"
    textColor: "{colors.cell-white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-filled-active:
    backgroundColor: "{colors.indigo-pressed}"
  button-tinted:
    backgroundColor: "{colors.indigo-wash}"
    textColor: "{colors.indigo-text}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-gray:
    backgroundColor: "{colors.control-fill}"
    textColor: "{colors.label-graphite}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-gray-active:
    backgroundColor: "{colors.control-fill-pressed}"
  button-destructive:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger-red}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-plain:
    textColor: "{colors.indigo-text}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-large:
    typography: "{typography.body}"
    padding: "0.75rem 1.25rem"
    height: "50px"
  icon-button-tinted:
    textColor: "{colors.indigo-text}"
    rounded: "{rounded.full}"
    size: "44px"
  list-group:
    backgroundColor: "{colors.cell-white}"
    rounded: "{rounded.lg}"
  list-row:
    backgroundColor: "{colors.cell-white}"
    textColor: "{colors.label-graphite}"
    typography: "{typography.body}"
    padding: "0.75rem 1rem"
    height: "44px"
  list-row-pressed:
    backgroundColor: "{colors.cell-pressed}"
  listening-line:
    textColor: "{colors.label-secondary}"
    typography: "{typography.caption}"
  listening-track:
    backgroundColor: "{colors.control-fill}"
    rounded: "{rounded.full}"
    height: "3px"
  row-play:
    textColor: "{colors.label-graphite}"
    rounded: "{rounded.full}"
    size: "1.5rem"
  segmented-control:
    backgroundColor: "{colors.control-fill}"
    textColor: "{colors.label-graphite}"
    typography: "{typography.subheadline}"
    padding: "3px"
    height: "44px"
  segmented-thumb:
    backgroundColor: "{colors.thumb-white}"
  tab-bar:
    backgroundColor: "{colors.media-canvas}"
    textColor: "{colors.label-secondary}"
    rounded: "{rounded.full}"
    height: "62px"
    width: "28rem"
  tab-bar-selected:
    textColor: "{colors.indigo-text}"
  mini-player:
    backgroundColor: "{colors.media-canvas}"
    textColor: "{colors.label-graphite}"
    rounded: "{rounded.lg}"
    height: "3.75rem"
    width: "28rem"
  sheet:
    backgroundColor: "{colors.grouped-gray}"
    textColor: "{colors.label-graphite}"
    rounded: "{rounded.xl}"
    width: "40rem"
  cover-row:
    textColor: "{colors.cell-white}"
    rounded: "{rounded.md}"
    size: "3.5rem"
  cover-mini:
    textColor: "{colors.cell-white}"
    rounded: "{rounded.sm}"
    size: "2.75rem"
  cover-shelf:
    textColor: "{colors.cell-white}"
    rounded: "{rounded.md}"
    width: "9.5rem"
  cover-large:
    textColor: "{colors.cell-white}"
    rounded: "1.25rem"
    width: "min(78%, 38vh)"
  resume-card:
    textColor: "{colors.cell-white}"
    rounded: "{rounded.lg}"
    padding: "1rem"
    width: "min(17rem, 78vw)"
---

# Design System: Reader

## Overview

**Creative North Star: "The First-Party Sibling"**

Reader looks like an app Apple shipped beside Podcasts. Every structural choice is the iOS one: grouped settings on system gray, plain media screens on a near-white canvas, large titles that hand off to a compact bar, sheets with a grabber, a floating tab bar, a mini player above it. The system's personality is not invented; it is borrowed on purpose from the category standard, because the listener should never have to learn the app.

What makes it Reader rather than a template is the cover. Narrations have no art, so each gets a generated square in a deep hue chosen from its site, with the site's initial in white. Covers give every list row, shelf, card, and the player a face, and the large cover in the player breathes with playback: full size while playing, stepping back while paused, as Podcasts does. One indigo tint marks everything that can be pressed, selected, or is progressing; the cover hues never use it.

Density is iOS default: 44px touch targets, 4-point rem spacing that grows with the system text size, 1.5 line spacing for running text. Light and dark are both first-class. The earlier look (cream paper, green accent, equal icon tiles on every row) is rejected.

**Key Characteristics:**

- iOS structure and semantic colors, near the system values but never pure black or pure white text.
- One indigo tint for actions, selection, and progress; cover hues for identity only.
- Generated covers as the only imagery, in five fixed sizes.
- Opaque floating chrome (tab bar, mini player) with content fading out behind it.
- Soft, ambient shadows on covers and floating chrome only; cells are flat.
- Every size in rem, so the whole interface follows Dynamic Type.

## Colors

An iOS system palette with one indigo tint, plus eight deep cover hues that carry identity, not action. Light values are listed in the frontmatter; each has a dark counterpart in the sidecar.

### Primary

- **Indigo Tint** (accent): filled buttons, the selected tab, list progress bars, the avatar, the caret and selection highlight. Light and dark differ slightly to keep contrast; white on it passes AA.
- **Indigo Text** (accentText): tinted text and glyphs on any background, such as the add glyph, the source link in the player, finished checks, the selected tab label. Lifts to a pale indigo in dark mode.
- **Indigo Wash** (accentFill): the background of tinted buttons.
- **Indigo Pressed** (accentPressed): the pressed state of filled controls.

### Secondary

- **Cover Hues** (blue, teal, green, rust, raspberry, violet, walnut, slate): the generated cover's fill, picked by a Fibonacci hash of the site name so one site always gets one hue. Each is deep enough for white text at AA. Large covers add light from the top within their own hue; the Home resume card sits on a darker mix of the same hue; the player sheet washes its top with the hue.

### Neutral

- **Grouped Gray** (background): behind grouped lists, such as Profile and settings. Near-black in dark mode.
- **Media Canvas** (canvas): behind plain content, such as Home and Library: a step lighter than grouped gray and well off white so a full screen does not glare. Also the opaque fill of the floating chrome (glass).
- **Cell White** (surface): cells and cards on grouped gray; becomes the canvas inside plain lists.
- **Cell Pressed** (surfacePressed): a pressed or hovered row.
- **Label Graphite** (label): primary text, never pure black; pale gray in dark mode.
- **Secondary and Tertiary Label**: site names, times, footnotes, section headers; chevrons and grabbers. Secondary is more opaque than iOS's own, and goes near-solid under increased contrast.
- **Separator**, **Control Fill**, **Thumb White**, **Scrim**: hairlines, gray controls and tracks, the segmented control's thumb, the sheet's backdrop.
- **Danger Red** / **Danger Wash**: destructive text and fills, such as Sign out and a failed narration's cover. A separate destructive red sits behind white text on a swiped Delete.
- **Success Green**, **Warning Amber**: state notices only.

### Named Rules

**The One Tint Rule.** Indigo means "you can press this" or "this is selected or progressing". Nothing decorative is indigo, and no cover hue is indigo.

**The No Glare Rule.** Text is never pure black, and full-screen grounds are never pure white. White is for cells, the segmented thumb, and text on color.

## Typography

**Display Font:** system-ui (San Francisco on Apple devices, with Segoe UI and Roboto fallbacks) **Body Font:** the same system face

**Character:** one platform sans in the iOS text styles, relative to the body size, which on iPhone follows the system text size setting. Hierarchy comes from size and weight, never from a second family.

### Hierarchy

- **Large Title** (700, 2rem, 1.15, -0.02em): screen titles (Home greeting, Library, Profile), balanced.
- **Title 1** (700, 1.65rem, 1.2): rare; the size of the Profile avatar initial.
- **Title 2** (700, 1.3rem, 1.25): the narration title in the full player.
- **Title 3** (600, 1.18rem, 1.3): prominent list section headings and the resume card title, both set at 700.
- **Headline** (600, 1rem, 1.35): sheet titles and the compact nav bar title.
- **Body** (400, 1rem, 1.5): running text and list row titles (rows use 500).
- **Callout / Subheadline** (0.94rem / 0.88rem): medium buttons; row subtitles, shelf titles, segmented labels, mini player title.
- **Footnote** (400, 0.8rem, 1.4): times, list headers and footers, listening lines, status lines.
- **Caption** (500, 0.75rem, 0.01em): the smallest metadata.

### Named Rules

**The Running Text Rule.** Running text keeps 1.5 line spacing, and every type size is in rem so Dynamic Type scales it. Copy is sentence case; nothing is set in capitals.

**The Tabular Time Rule.** Times, speeds, and remaining time use tabular numerals, so they do not jitter while playing.

## Layout

A single column capped at a 40rem measure plus a 1.25rem gutter on each side, honoring safe-area insets. Screens stack sections with a 1.5rem gap. Spacing follows a 4-point scale in rem (0.125rem to 3rem). Home uses horizontal shelves that scroll under the screen margins with snap and hidden scrollbars; a lone card spans the width. Library and Profile are lists. The full player is a sheet: grabber, cover at min(78%, 38vh) up to 17rem so controls stay in view on short screens, left-aligned title and site, scrubber, transport controls 3rem apart, speed control at the bottom.

The bottom of each screen is reserved for floating chrome: the tab bar (62px) floats above the home indicator, capped at 28rem; the mini player floats 0.5rem above it. Content pads its bottom to clear them.

### Named Rules

**The Clean Edge Rule.** Bars are opaque, and content fades into the canvas behind floating bars, so text never shows through or sits half cut beside a bar.

## Elevation & Depth

Hybrid: cells and lists are flat and tonal (white on gray, hairline separators), while generated covers and floating chrome carry soft ambient shadows. The large cover's shadow shrinks with it when paused. Sheets lift with a soft upward shadow over a dim scrim. Chrome uses an inset half-pixel top highlight in place of a border.

### Shadow Vocabulary

- **Cover large** (`0 14px 36px rgb(0 0 0 / 0.24), 0 2px 6px rgb(0 0 0 / 0.12)`; paused `0 6px 18px rgb(0 0 0 / 0.16), 0 1px 3px rgb(0 0 0 / 0.1)`): the player cover.
- **Cover shelf** (`0 6px 16px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08)`) and **cover card** (`0 4px 12px rgb(0 0 0 / 0.24)`): Home.
- **Floating bar** (tab bar `inset 0 0.5px 0 glassEdge, 0 10px 30px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08)`; mini player `inset 0 0.5px 0 glassEdge, 0 8px 30px rgb(0 0 0 / 0.16)`).
- **Sheet** (`0 -8px 40px rgb(0 0 0 / 0.18)`).
- **Segmented thumb** (`0 3px 8px rgb(0 0 0 / 0.12), 0 1px 1px rgb(0 0 0 / 0.06)`).

### Named Rules

**The Lift Has A Reason Rule.** Only things that float (chrome, sheets, the segmented thumb) or have a face (covers) cast a shadow. Rows and grouped cells never do.

## Shapes

Continuous-feeling rounded rectangles at tight iOS radii: 0.5rem for the mini cover, 0.625rem for buttons, row covers and shelf covers, 0.875rem for inset grouped sections, cards, and the mini player, 1.25rem for the large cover, 2.25rem for the top corners of sheets. Capsules (full radius) for the tab bar, filter chips, row play glyphs, progress tracks, the grabber, and round icon buttons. The segmented control uses its own nested radii (0.5625rem outside, 0.4375rem thumb).

## Components

### Buttons

Quiet and system-like; feedback starts on press.

- **Shape:** gently rounded (0.625rem).
- **Filled:** indigo with white, semibold; one per screen at most.
- **Tinted / Gray / Destructive / Plain:** indigo wash, control fill, red wash, or text only.
- **Sizes:** small 34px, medium 44px (default), large 50px.
- **States:** press scales to 0.96 (none under reduced motion) and darkens or fades; 2px indigo focus ring offset 2px; disabled at 45% opacity.

### Icon buttons

Round, 44px. Navigation actions (add) are bare tinted glyphs with no disc, as in iOS bars. The small outline variant, a 24px ring with a 44px touch area, is a row's play button. The play/pause glyph in the player is a 5rem plain glyph without a disc; skip controls are 3.5rem glyphs. Icons are SVG on a 24-unit grid in the SF Symbols style, sized to the text.

### Lists

A section's variant sets how every row in it looks, so rows of one kind always match.

- **Grouped**, for settings: white cells in a 0.875rem inset section on grouped gray, a footnote semibold secondary header, body titles at 500, subheadline subtitles.
- **Media**, for narrations: cells take the canvas color and run edge to edge within the gutter, under a bold Title 3 heading. Rows lead with a 3.5rem cover, separators start past it, and the text is compact: see Narration row.
- **Row:** 44px minimum, 0.75rem by 1rem padding; pressed or hovered rows turn cell-pressed. Swipe reveals a red Delete. Rows take their text as plain strings, never styled markup.

### Narration row

Every row in a media section, whether ready, being made, or failed. As in Audible: the title in subheadline semibold, on one line ending in an ellipsis; the site in footnote; then how far the listener got in secondary caption. Started narrations show a short 3px indigo bar before the time left, unstarted ones their length, finished ones an indigo check and "Finished". Pressing the row opens the full player. A small outlined play button after the text plays the narration in place, keeping the player in the mini bar, and turns into pause while that narration plays. Then the more button, whose sheet offers Mark as finished (or unfinished) and Delete.

### Filter chips

Gray capsules in a row that scrolls sideways when the labels do not fit; the selected chip is filled indigo. Used for Library filters, which outgrow a segmented control on a phone.

### Segmented control

Gray track with 3px padding, a white thumb that slides on a spring; used for playback speed.

### Navigation

- **Tab bar:** a floating opaque capsule, no highlight shape; the selected tab is tinted indigo, others secondary label; fixed 11px semibold labels under 1.5rem glyphs; press scales to 0.96.
- **Nav bar:** transparent over the large title, turning opaque with a hairline once scrolled while the compact title fades in.
- **Mini player:** an opaque floating rounded rectangle above the tab bar: mini cover, title, time left, play/pause and skip forward.

### Sheets

Grabber (36 by 5px), 2.25rem top corners, elevated gray, a 30px close button, scrim behind, drag to dismiss. The player sheet washes its top with the cover hue.

### Cover (signature)

A rounded square in the site's hue, the initial in bold white, the site name at the lower left on shelf and large sizes. Sizes: mini 2.75rem, row 3.5rem, card 4.25rem, shelf 9.5rem, large up to 17rem. Being made shows a gray cover with a spinner; failed shows a red-washed cover. The large cover scales to 0.84 when paused, on a spring over 500ms.

### Sections and shelves

A bold Title 3 heading over its content. A shelf lays cards or tiles side by side and scrolls sideways under the screen's margins, snapping to each item.

### Resume card

Home's "pick up where you left off": a 13rem-tall card in a darker mix of the cover hue, the card cover at the top left, a white play disc in the hue at the top right, title, site and time left, and a white progress bar.

## Do's and Don'ts

### Do:

- **Do** use iOS semantic roles (background, canvas, surface, label, separator, fill) rather than raw colors.
- **Do** give every narration a generated cover, in one of the five sizes, in its site's hue.
- **Do** keep indigo for actions, selection, and progress, and the player scrubber in label color as Podcasts does.
- **Do** keep touch targets at 44px or more and sizes in rem, so text size changes scale the interface.
- **Do** respect reduced motion (no press scaling, no cover breathing), reduced transparency, and increased contrast.
- **Do** keep floating chrome opaque and fade content out behind it.
- **Do** define how things look in the component library. Screens only lay components out; a lint check fails a screen that sets type, color, or shape.

### Don't:

- **Don't** use pure black text or a pure white full-screen ground.
- **Don't** return to cream paper, a green accent, or equal icon tiles on every row.
- **Don't** use indigo as a cover hue or as decoration.
- **Don't** put a highlight shape behind the selected tab, or a disc behind the player's play glyph.
- **Don't** set text in capitals or add a second typeface.
- **Don't** add shadows to rows or grouped cells.
