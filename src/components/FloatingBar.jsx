import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import useLuminaStore from '../stores/store';
import Pill from './floating/Pill';
import NOTCH_SKIN, { METRICS } from './floating/notchSkin';
import './floating/pill-base.css';
import './floating/notch.css';

/*
 * FloatingBar — the ambient surface: wake/sleep timers, Option+Space, and the contract
 * with the OS window. All presentation lives in Pill + notchSkin; everything stateful
 * lives here.
 *
 * Window sizing is the subtle part. The main process pins the window flush to the bottom
 * of the work area, so the bar can only grow upward — and the window must always be at
 * least as tall as the bar, or the notch gets clipped against the top of its own window.
 * Hence: grow the window synchronously *before* the browser paints the taller bar, and
 * shrink it only once the collapse animation has finished.
 */

const IDLE_AFTER_WAKE = 5000;
const IDLE_AFTER_LEAVE = 3000;
const IDLE_AFTER_ANSWER = 8000;
const COLLAPSE_MS = 460; // must stay >= the spring's settle time in notchSkin

export default function FloatingBar() {
  const { barState, chatMessages, chatLoading, sendChat, clearChat, wakeBar, sleepBar, expandApp } =
    useLuminaStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const contentRef = useRef(null);
  const idleTimer = useRef(null);
  const shrinkTimer = useRef(null);
  const lastHeight = useRef(0);

  const isSleeping = barState === 'sleeping';
  const isConversing = barState === 'conversing';
  const hasMessages = chatMessages.length > 0 || chatLoading;

  // --- Idle timers ---
  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
  }, []);

  const startIdleTimer = useCallback((ms = IDLE_AFTER_WAKE) => {
    clearIdleTimer();
    idleTimer.current = setTimeout(() => {
      const { chatLoading: ld } = useLuminaStore.getState();
      if (!ld) sleepBar();
    }, ms);
  }, [clearIdleTimer, sleepBar]);

  // --- Option+Space toggle ---
  useEffect(() => {
    const cleanup = window.lumina?.onToggleWake(() => {
      const { barState: s } = useLuminaStore.getState();
      s === 'sleeping' ? wakeBar() : sleepBar();
    });
    return () => {
      cleanup?.();
      clearIdleTimer();
      if (shrinkTimer.current) clearTimeout(shrinkTimer.current);
    };
  }, [wakeBar, sleepBar, clearIdleTimer]);

  // --- Mouse interactions ---
  const onMouseEnter = () => { clearIdleTimer(); };
  const onMouseLeave = () => {
    const { barState: s, chatLoading: ld } = useLuminaStore.getState();
    if (s === 'awake' && !ld) startIdleTimer(IDLE_AFTER_LEAVE);
  };

  // --- State transitions ---
  useEffect(() => {
    if (isSleeping) { clearIdleTimer(); return; }
    if (barState === 'awake') {
      setTimeout(() => inputRef.current?.focus(), 250);
      startIdleTimer(IDLE_AFTER_WAKE);
    }
  }, [barState, isSleeping, startIdleTimer, clearIdleTimer]);

  useEffect(() => {
    if (isConversing && !chatLoading && chatMessages.length > 0) {
      if (chatMessages[chatMessages.length - 1].role === 'assistant') startIdleTimer(IDLE_AFTER_ANSWER);
    }
  }, [chatMessages, chatLoading, isConversing, startIdleTimer]);

  // --- Window height ---
  // The bar's height is fully determined: an input row, plus (when there is a
  // conversation) the scroller capped at PANEL_MAX and a footer. SHADOW_PAD is
  // transparent headroom so the notch's upward shadow is not cut off by the window.
  const measure = useCallback(() => {
    const content = contentRef.current?.scrollHeight ?? 0;
    const panel = hasMessages
      ? Math.min(content + METRICS.PANEL_PAD, METRICS.PANEL_MAX) + METRICS.FOOT_H
      : 0;
    return Math.ceil(METRICS.ROW_H + panel + METRICS.SHADOW_PAD);
  }, [hasMessages]);

  const applyHeight = useCallback(() => {
    if (!window.lumina?.resizeFloating || isSleeping) return;
    // Cancel any pending shrink first, and unconditionally: if the bar grew back to the
    // height it already had, `target` matches and we bail out below — but a shrink queued
    // before that would still fire and clip the conversation.
    if (shrinkTimer.current) { clearTimeout(shrinkTimer.current); shrinkTimer.current = null; }

    const target = measure();
    if (target === lastHeight.current) return;

    if (target > lastHeight.current) {
      // Growing: the window must lead the animation, never trail it.
      lastHeight.current = target;
      window.lumina.resizeFloating(target);
    } else {
      // Shrinking: hold the window until the bar has finished collapsing into it.
      shrinkTimer.current = setTimeout(() => {
        shrinkTimer.current = null;
        const { barState: s } = useLuminaStore.getState();
        if (s === 'sleeping') return; // the main process handles the sleeping window
        lastHeight.current = target;
        window.lumina.resizeFloating(target);
      }, COLLAPSE_MS);
    }
  }, [isSleeping, measure]);

  useLayoutEffect(() => {
    if (isSleeping) { lastHeight.current = 0; return; }
    applyHeight();
  }, [chatMessages, chatLoading, isSleeping, hasMessages, applyHeight]);

  // Markdown can reflow after layout (long lines wrapping, fonts settling), so watch the
  // real content box rather than trusting a single measurement.
  useEffect(() => {
    if (isSleeping || !contentRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => applyHeight());
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [isSleeping, hasMessages, applyHeight]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  // --- Handlers ---
  const onSubmit = async (text) => {
    if (!text || chatLoading) return;
    setInput('');
    clearIdleTimer();
    try { await sendChat(text); } catch {}
  };

  const onInputChange = (value) => {
    setInput(value);
    if (barState === 'awake') startIdleTimer(IDLE_AFTER_WAKE);
  };

  // While asleep the window is barely larger than the tab, but the few pixels of shadow
  // margin around it still absorb clicks — so make them open the bar too rather than
  // swallowing the click silently. Clicks on the tab itself are handled by Pill.
  const onBackdropClick = (e) => {
    if (isSleeping && !e.target.closest('.lp')) wakeBar();
  };

  return (
    <div className="w-full h-full flex flex-col justify-end items-center" onClick={onBackdropClick}>
      <Pill
        skin={NOTCH_SKIN}
        barState={barState}
        messages={chatMessages}
        loading={chatLoading}
        input={input}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        onWake={wakeBar}
        onEscape={sleepBar}
        onExpand={expandApp}
        onClear={() => { clearChat(); startIdleTimer(IDLE_AFTER_LEAVE); }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        inputRef={inputRef}
        scrollRef={scrollRef}
        contentRef={contentRef}
      />
    </div>
  );
}
