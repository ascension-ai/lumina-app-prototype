/*
 * The five candidates from the design review — gallery only.
 *
 * Dock Notch won and now ships: its skin lives in notchSkin.jsx and is imported here so
 * the gallery keeps showing the real thing rather than a stale copy of it. The other four
 * stay for reference; nothing in the app imports this file.
 *
 * Original note:
 * Five candidate skins for the floating bar.
 *
 * A skin is pure configuration: geometry, spring, tone and the JSX that fills the
 * sleeping state. `Pill.jsx` renders all of them — so shipping the winner means
 * deleting the other four objects from this file, nothing more.
 */

// The "seamless" spring: settles fast, no visible overshoot on width.
const SPRING_CALM = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 };
// Same family, with a deliberate lean-in overshoot.
const SPRING_ELASTIC = { type: 'spring', stiffness: 420, damping: 22, mass: 0.85 };

import NOTCH_SKIN from './notchSkin';

export const SKINS = [
  {
    key: 'capsule',
    name: 'Wispr Capsule',
    tagline: 'Opaque graphite bead → one continuous capsule',
    className: 'lp-capsule',
    tone: 'dark',
    anchor: 'float',
    spring: SPRING_CALM,
    sleep: { width: 104, height: 26, radius: 999 },
    open: { width: 480, radius: 26 },
    idle: () => (
      <div className="lp-wave lp-wave-idle">
        <i /><i /><i /><i />
      </div>
    ),
    why:
      'Closest to Wispr Flow. Asleep it is a 104x26 bead with a barely-breathing waveform, which reads as a ' +
      'system affordance rather than an app window. Waking is a pure width stretch of the same shape — nothing ' +
      'fades in except the text.',
    fit:
      'Drop-in. The sleeping Electron window can stay 520x56 because the bead is centred inside it, so no ' +
      'main-process change at all.',
    risk: ['good', 'Dark-on-dark needs the inset top highlight to stay legible; it is in the CSS. Violet survives only in tool tags.'],
  },
  {
    key: 'halo',
    name: 'Edge Halo',
    tagline: 'A 3px light seam that inflates into light glass',
    className: 'lp-halo',
    tone: 'light',
    anchor: 'float',
    spring: SPRING_CALM,
    sleep: { width: 132, height: 3, radius: 999 },
    open: { width: 540, radius: 20 },
    idle: () => <span className="lp-seam" />,
    why:
      'The most invisible idle of the five: a luminous hairline you read as ambient light, not UI. Waking ' +
      'inflates it on both axes at once, and a trace of the halo stays under the open bar so the two states ' +
      'are visibly the same object.',
    fit:
      'Keeps the current light identity and most of index.css. Wants a ~4px sleeping window height so the seam ' +
      'sits flush against the desktop.',
    risk: ['warn', 'The seam is easy to miss entirely. If discoverability beats calm, this is the weakest idle.'],
  },
  {
    ...NOTCH_SKIN,
    name: 'Dock Notch — shipped',
    tagline: 'Fused to the screen edge, Dynamic-Island style (light)',
    why:
      'Never floats. It grows out of the bottom edge with square bottom corners, so it belongs to the ' +
      'screen instead of hovering over it — and it is the most confident surface once open. Asleep it is a ' +
      'small tab that swells under the cursor and opens on click.',
    fit:
      'Shipped. The sleeping Electron window is now the tab itself (160x34, docked flush), which is what ' +
      'makes the tab clickable without click-through tricks. See electron/main.js.',
    risk: ['warn', 'Sits directly above the macOS Dock. workArea keeps them from overlapping, but check the demo machine.'],
  },
  {
    key: 'slab',
    name: 'Soft Slab',
    tagline: "Today's bar, calmed down — violet demoted to a hairline",
    className: 'lp-slab',
    tone: 'light',
    anchor: 'float',
    spring: SPRING_CALM,
    sleep: { width: 168, height: 10, radius: 999 },
    open: { width: 520, radius: 18 },
    idle: () => <span className="lp-dot" />,
    why:
      'The conservative option. Same light identity you have now, but the sleeping sliver becomes a small ' +
      'rounded lozenge with a single violet dot, the radius stops jumping, and the layered shadow collapses ' +
      'into one soft drop.',
    fit: 'Smallest diff by far — mostly a rewrite of the lumina-container and lumina-sleep-bar tokens.',
    risk: ['good', 'Lowest risk to the demo path. Also the least distinctive of the five.'],
  },
  {
    key: 'orb',
    name: 'Orb',
    tagline: 'A 30px bead that stretches elastically into the bar',
    className: 'lp-orb',
    tone: 'dark',
    anchor: 'float',
    spring: SPRING_ELASTIC,
    sleep: { width: 30, height: 30, radius: 999 },
    open: { width: 500, radius: 28 },
    idle: () => <span className="lp-core" />,
    why:
      'The smallest idle footprint that still has presence: one glowing bead. The stretch runs on an elastic ' +
      'spring, so opening feels like the assistant leaning in rather than a window appearing.',
    fit:
      'Drop-in like the Capsule, but the overshoot means the Electron window must already sit at full awake ' +
      'width before the morph starts — it does (520px).',
    risk: ['warn', 'The overshoot is charming once and irritating on the hundredth open. Judge it in slow motion.'],
  },
];

export const SKIN_BY_KEY = Object.fromEntries(SKINS.map((s) => [s.key, s]));
