import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import renderMarkdown from './markdown';

/*
 * Pill — the presentational floating bar, driven entirely by a skin object.
 *
 * Deliberately dumb: no store, no timers, no IPC. FloatingBar keeps all of that and hands
 * it down. That split is what let five candidates be compared, and it is what keeps the
 * wake/sleep contract in one place now that one of them ships.
 *
 * The morph is one element. Width and radius animate on the container while the idle tab
 * collapses its own height to zero and the body grows from zero to auto — both inside the
 * same flex column, so the container height is never set. That is the whole trick: the bar
 * is always one shape changing size, never two layouts cross-fading.
 */
export default function Pill({
  skin,
  barState = 'sleeping',
  messages = [],
  loading = false,
  input = '',
  onInputChange = () => {},
  onSubmit = () => {},
  onWake,
  onEscape,
  onExpand,
  onClear,
  onMouseEnter,
  onMouseLeave,
  inputRef,
  scrollRef,
  contentRef,
}) {
  const localInput = useRef(null);
  const ref = inputRef || localInput;
  const [peeking, setPeeking] = useState(false);

  const sleeping = barState === 'sleeping';
  const hasMessages = messages.length > 0 || loading;
  const showPanel = !sleeping && hasMessages;
  const edge = skin.anchor === 'edge';

  // Asleep, the cursor swells the tab — the only affordance saying it can be opened.
  const peek = sleeping && peeking && skin.peek ? skin.peek : null;
  const size = sleeping ? peek || skin.sleep : skin.open;
  const radius = size.radius ?? skin.open.radius;
  const shape = edge
    ? { borderTopLeftRadius: radius, borderTopRightRadius: radius, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { borderRadius: radius };

  const submit = (e) => {
    e?.preventDefault?.();
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
  };

  const enter = () => { if (sleeping) setPeeking(true); onMouseEnter?.(); };
  const leave = () => { setPeeking(false); onMouseLeave?.(); };

  // Going to sleep shrinks the OS window out from under the cursor, and a mouseleave is
  // not guaranteed when that happens — drop the swollen state rather than risk it
  // sticking. A real hover re-triggers it on the next mouse move.
  useEffect(() => { if (sleeping) setPeeking(false); }, [sleeping]);

  return (
    <motion.div
      className={`lp ${skin.className} lp-${skin.tone} ${edge ? 'lp-edge' : ''} ${showPanel ? 'lp-open' : ''}`}
      data-state={barState}
      data-peek={peek ? 'true' : 'false'}
      style={skin.vars}
      initial={false}
      animate={{ width: size.width, ...shape }}
      transition={skin.spring}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onClick={sleeping ? onWake : undefined}
      role={sleeping ? 'button' : undefined}
      tabIndex={sleeping ? 0 : undefined}
      aria-label={sleeping ? 'Open Lumina' : undefined}
      onKeyDown={sleeping ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWake?.(); } } : undefined}
    >
      {/* The idle tab collapses its height rather than unmounting, so there is never a
          frame where the container has no content to size itself against. */}
      <motion.div
        className="lp-idle"
        initial={false}
        animate={{ height: sleeping ? size.height : 0, opacity: sleeping ? 1 : 0 }}
        transition={skin.spring}
      >
        {skin.idle()}
      </motion.div>

      <motion.div
        className="lp-body"
        initial={false}
        animate={{ height: sleeping ? 0 : 'auto', opacity: sleeping ? 0 : 1 }}
        transition={skin.spring}
        style={{ pointerEvents: sleeping ? 'none' : 'auto' }}
        inert={sleeping || undefined}
      >
        <AnimatePresence initial={false}>
          {showPanel && (
            <motion.div
              key="panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={skin.spring}
              className="lp-panel"
            >
              <div ref={scrollRef} className="lp-scroll">
                <div ref={contentRef} className="lp-msgs">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...skin.spring, delay: 0.04 }}
                    >
                      {msg.role === 'user' ? (
                        <div className="lp-user-row">
                          <div className="lp-user">{msg.content}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="lp-ai">{renderMarkdown(msg.content)}</div>
                          {msg.toolCalls?.length > 0 && (
                            <div className="lp-tags">
                              {[...new Set(msg.toolCalls)].map((tool) => (
                                <span key={tool}>
                                  {tool.replace('slack_', '').replace('notion_', '')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {loading && (
                    <div className="lp-thinking">
                      <span className="lp-wave"><i /><i /><i /><i /></span>
                      <span>Searching…</span>
                    </div>
                  )}
                </div>
              </div>

              {(onExpand || onClear) && (
                <div className="lp-foot">
                  {onExpand && (
                    <button className="floating-no-drag" onClick={onExpand} type="button">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                      Open app
                    </button>
                  )}
                  {onClear && (
                    <button className="floating-no-drag" onClick={onClear} type="button">Clear</button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <form className="lp-row" onSubmit={submit}>
          <svg className="lp-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
          </svg>
          <input
            ref={ref}
            className="lp-input floating-no-drag"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onEscape?.(); } }}
            placeholder="Ask Lumina anything"
            disabled={loading}
          />
          <AnimatePresence mode="wait" initial={false}>
            {loading ? (
              <motion.span key="w" className="lp-wave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <i /><i /><i /><i />
              </motion.span>
            ) : input.trim() ? (
              <motion.button
                key="send"
                type="submit"
                className="lp-send floating-no-drag"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </motion.button>
            ) : (
              <motion.span key="hint" className="lp-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                ⌥ Space
              </motion.span>
            )}
          </AnimatePresence>
        </form>
      </motion.div>
    </motion.div>
  );
}
