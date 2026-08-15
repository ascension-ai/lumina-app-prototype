# Floating bar — prototype gallery

Five candidate replacements for the bottom pill, built to be reviewed side by side and
then shipped without a rewrite.

> **Decided 2026-08-15: Dock Notch (C), light.** It ships — see
> `src/components/floating/notchSkin.jsx` and `notch.css`. The React gallery below shows
> the *shipping* skin in card C (it imports the same module, so it cannot go stale). The
> standalone `index.html` is the original review snapshot and still shows C in its
> first, dark form.

There are two ways to look at them.

## 1. Zero-install review

Open `design/pill-gallery/index.html` in any browser (double-click it — no server, no npm).
Hand-written HTML/CSS/JS, self-contained.

## 2. The real components

The same five designs as actual React, using the app's own `motion` springs:

```
npm run dev      # then open http://localhost:5173/gallery.html
```

This is the version to trust for judging motion — it is the shipping component, not a
mock-up of it. `index.html` (the app) is untouched; the gallery is a second Vite entry
that nothing in the app imports.

## The five

| | Name | Idle footprint | Tone | Codebase cost |
|---|---|---|---|---|
| A | **Wispr Capsule** | 104×26 bead, breathing waveform | dark | drop-in |
| B | **Edge Halo** | 132×3 luminous seam | light | wants a ~4px sleeping window |
| C | **Dock Notch** ✅ | 104×20 tab fused to the screen edge | light | **shipped** |
| D | **Soft Slab** | 168×10 lozenge, one violet dot | light | smallest diff — today's bar, calmed |
| E | **Orb** | 30×30 glowing bead | dark | drop-in, elastic overshoot |

Each card in the gallery carries its own *why it works* / *fit with the codebase* /
*watch out* notes, and the toolbar can force all five into the same state, swap the
desktop behind them (including a busy light app, for legibility), and run everything in
slow motion.

## Files

```
src/components/floating/
  Pill.jsx          the presentational bar — dumb, no store, no timers, no IPC   [ships]
  notchSkin.jsx     Dock Notch geometry + the METRICS that size the OS window    [ships]
  notch.css         the winning skin, light                                      [ships]
  pill-base.css     shared skeleton, all scoped under .lp                        [ships]
  markdown.jsx      the ~30-line renderer, lifted out of FloatingBar             [ships]
  skins.jsx         the five candidates as config (C re-exports the real skin)
  pills.css         the four losing skins
  Gallery.jsx       dev-only review harness
  useDemoBar.js     fake store for the harness
  gallery.css       review-page chrome
gallery.html        dev-only Vite entry — not part of the production build
```

## How the winner was adopted

`Pill` takes exactly the slice of state `FloatingBar` already holds, so adoption was a
render swap — the timers, `Option+Space` handling, `resizeFloating` reporting and store
wiring all stayed where they were:

```jsx
import Pill from './floating/Pill';
import NOTCH_SKIN, { METRICS } from './floating/notchSkin';
import './floating/pill-base.css';
import './floating/notch.css';

<Pill
  skin={NOTCH_SKIN}
  barState={barState}
  messages={chatMessages}
  loading={chatLoading}
  input={input}
  onInputChange={setInput}
  onSubmit={sendChat}
  onExpand={expandApp}
  onClear={clearChat}
  onMouseEnter={onMouseEnter}
  onMouseLeave={onMouseLeave}
  inputRef={inputRef}
  scrollRef={scrollRef}
  contentRef={contentRef}
/>
```

The four losing skins stay in `skins.jsx` / `pills.css`, which only `Gallery.jsx` imports —
they are absent from the production bundle, so the comparison survives without costing the
app anything.

Two things the notch needed beyond the swap, both in `electron/main.js`:

- **Flush docking.** `getDockedBounds()` centres on `screen.getPrimaryDisplay().workArea`
  and sits on its bottom edge. The old helper used `workAreaSize`, which drops the origin —
  the bar had been sitting a menu-bar's height too high all along.
- **A window the size of the tab.** Asleep the window is 160×34 rather than 520×56, so the
  tab is a real click target and no invisible strip swallows desktop clicks. Wake grows the
  window *before* the bar paints; sleep shrinks it 460 ms *after*, once the bar has
  collapsed into it.

## Constraints these were designed against

- The Electron window is `transparent: true` with `hasShadow: false`, so CSS
  `backdrop-filter` **cannot** blur the desktop behind the bar. Every fill is opaque or
  near-opaque on purpose. Real frosted glass is a main-process change
  (`vibrancy: 'hud'` on macOS), not a CSS one.
- `resize-floating` pins `y + height`, so all five grow **upward** from a fixed bottom edge.
- The morph is one element: the idle row collapses its own height to zero while the body
  grows from zero to auto, both inside the same flex column. The container height is never
  set, so the open is continuous instead of a cross-fade between two layouts — that is the
  part that makes it feel seamless, and it is worth preserving whichever skin wins.
- Nothing in the protected core is touched: wake/sleep/morph, `Option+Space`, the feed,
  workflow execution and chat scope routing are all untouched by this branch of work.
