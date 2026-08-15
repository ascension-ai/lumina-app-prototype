import { useEffect, useState } from 'react';
import Pill from './Pill';
import { SKINS } from './skins';
import useDemoBar, { ANSWER, QUESTION } from './useDemoBar';
import './pill-base.css';
import './notch.css';
import './pills.css';
import './gallery.css';

/*
 * Gallery — dev-only review harness for the floating bar candidates.
 * Served at http://localhost:5173/gallery.html by the normal `npm run dev`.
 * Nothing here is imported by the app.
 */

const BACKDROPS = [
  { key: 'dawn', label: 'Colour' },
  { key: 'night', label: 'Dark' },
  { key: 'paper', label: 'Light' },
  { key: 'busy', label: 'Busy app' },
];

// Slowing a spring without changing how it feels: scale stiffness and damping
// together so the damping ratio c / 2*sqrt(k*m) stays put.
function scaleSpring(spring, slow) {
  if (!slow) return spring;
  return { ...spring, stiffness: spring.stiffness * 0.12, damping: spring.damping * 0.35 };
}

function Stage({ skin, backdrop, slow, broadcast, autoPlay }) {
  const bar = useDemoBar(slow ? 3 : 1);
  const skinned = { ...skin, spring: scaleSpring(skin.spring, slow) };

  // "Play all" remounts every stage with a fresh token; each one starts its own loop.
  useEffect(() => {
    if (autoPlay) bar.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A forced state from the toolbar shows plausible content for that state, so the
  // three states can be compared side by side without waiting for the animation.
  const forced = broadcast
    ? {
        barState: broadcast,
        messages:
          broadcast === 'conversing' ? [{ role: 'user', content: QUESTION }, ANSWER] : [],
        loading: false,
        input: '',
      }
    : null;

  const view = forced || bar;

  // Waking on click, but never stealing a click meant for the input or a footer button.
  const onSlotClick = (e) => {
    if (broadcast) return;
    if (e.target.closest('.lp-body')) return;
    bar.wake();
  };

  return (
    <div className={`stage bg-${backdrop} anchor-${skin.anchor}`}>
      <div className="fakewin" aria-hidden="true">
        <div className="fakewin-bar" />
        <div className="fakewin-ln" /><div className="fakewin-ln" /><div className="fakewin-ln" />
        <div className="fakewin-ln" /><div className="fakewin-ln" /><div className="fakewin-ln" />
      </div>

      <div className="stage-ctl">
        <button onClick={bar.play}>▶ Play</button>
        <button onClick={bar.reset}>Reset</button>
      </div>

      <div className="stage-slot" onClick={onSlotClick}>
        <Pill
          skin={skinned}
          barState={view.barState}
          messages={view.messages}
          loading={view.loading}
          input={view.input}
          onInputChange={bar.setInput}
          onSubmit={bar.submit}
          onExpand={() => {}}
          onClear={bar.reset}
        />
      </div>
    </div>
  );
}

export default function Gallery() {
  const [backdrop, setBackdrop] = useState('dawn');
  const [slow, setSlow] = useState(false);
  const [broadcast, setBroadcast] = useState(null);
  const [playToken, setPlayToken] = useState(0);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Floating bar — five directions</h1>
        <p>
          Every prototype is the real React component (<code>Pill.jsx</code>) driven by a real motion
          spring, differing only by the skin object in <code>skins.jsx</code>. Click a pill to wake it,
          type and hit enter, or press <b>Play</b> for the full sleeping → awake → thinking → answer
          loop. Judge two things: how invisible the sleeping state is, and whether the opening reads as
          one shape growing rather than a panel appearing.
        </p>
      </header>

      <div className="toolbar">
        <button className="ctl primary" onClick={() => { setBroadcast(null); setPlayToken((t) => t + 1); }}>
          ▶ Play all
        </button>
        <span className="sep" />
        <label>Force state</label>
        {['sleeping', 'awake', 'conversing'].map((s) => (
          <button key={s} className={`ctl ${broadcast === s ? 'on' : ''}`}
            onClick={() => setBroadcast(broadcast === s ? null : s)}>
            {s}
          </button>
        ))}
        <span className="sep" />
        <label>Desktop</label>
        {BACKDROPS.map((b) => (
          <button key={b.key} className={`ctl ${backdrop === b.key ? 'on' : ''}`}
            onClick={() => setBackdrop(b.key)}>
            {b.label}
          </button>
        ))}
        <span className="sep" />
        <button className={`ctl ${slow ? 'on' : ''}`} onClick={() => setSlow(!slow)}>Slow motion</button>
      </div>

      <div className="grid">
        {SKINS.map((skin, i) => (
          <article className="card" key={skin.key}>
            <div className="card-head">
              <span className="idx">{String.fromCharCode(65 + i)}</span>
              <h2>{skin.name}</h2>
              <span className="tagline">{skin.tagline}</span>
            </div>

            <Stage key={`${skin.key}-${playToken}`} skin={skin} backdrop={backdrop}
              slow={slow} broadcast={broadcast} autoPlay={playToken > 0} />

            <div className="notes">
              <div><b>Why it works</b><p>{skin.why}</p></div>
              <div><b>Fit with the codebase</b><p>{skin.fit}</p></div>
              <div><b>Watch out</b><p className={skin.risk[0]}>{skin.risk[1]}</p></div>
            </div>
          </article>
        ))}
      </div>

      <footer className="page-foot">
        <p>
          <b>Reality check.</b> The Electron window is <code>transparent: true</code> with{' '}
          <code>hasShadow: false</code>, so <code>backdrop-filter</code> cannot blur the desktop behind
          the bar — every fill here is opaque or near-opaque on purpose. Real frosted glass would be a
          main-process change (<code>vibrancy: 'hud'</code> on macOS), not a CSS one. All five grow
          upward because <code>resize-floating</code> pins the bottom edge.
        </p>
      </footer>
    </div>
  );
}
