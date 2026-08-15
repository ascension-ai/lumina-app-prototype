/*
 * Dock Notch — the shipping skin for Lumina's floating bar.
 *
 * A light surface fused to the bottom edge of the screen: square bottom corners, rounded
 * top ones, shadow thrown upward. Asleep it is a small tab that swells on hover and opens
 * on click; awake it is the same shape, stretched.
 *
 * Geometry lives here and nowhere else. FloatingBar imports METRICS to tell the main
 * process how tall the OS window must be, and notch.css reads the same numbers through
 * `vars` below — so the CSS and the window can never disagree.
 */

const ROW_H = 54;        // input row
const FOOT_H = 36;       // "Open app" / "Clear" footer
const PANEL_MAX = 340;   // tallest the conversation may grow, padding included
const SCROLL_PT = 16;    // conversation padding, top
const SCROLL_PB = 6;     // conversation padding, bottom
const SHADOW_PAD = 40;   // transparent room above the notch so its shadow is not clipped

export const METRICS = {
  ROW_H,
  FOOT_H,
  PANEL_MAX,
  PANEL_PAD: SCROLL_PT + SCROLL_PB,
  SHADOW_PAD,
};

const SPRING = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 };

const NOTCH_SKIN = {
  key: 'notch',
  name: 'Dock Notch',
  className: 'lp-notch',
  tone: 'light',
  anchor: 'edge',
  spring: SPRING,

  // Tab asleep, tab swollen under the cursor, full bar awake.
  sleep: { width: 104, height: 20, radius: 11 },
  peek: { width: 132, height: 26, radius: 13 },
  open: { width: 560, radius: 22 },

  vars: {
    '--lp-row-h': `${ROW_H}px`,
    '--lp-foot-h': `${FOOT_H}px`,
    '--lp-panel-max': `${PANEL_MAX}px`,
    '--lp-scroll-pt': `${SCROLL_PT}px`,
    '--lp-scroll-pb': `${SCROLL_PB}px`,
  },

  idle: () => <span className="lp-grip" />,
};

export default NOTCH_SKIN;
