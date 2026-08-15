import { useCallback, useRef, useState } from 'react';

/*
 * useDemoBar — a stand-in for the Zustand store, for gallery use only.
 *
 * Mirrors the exact slice of state FloatingBar feeds into Pill (barState, chatMessages,
 * chatLoading), so a skin that looks right here needs no changes when it is wired to the
 * real store. Nothing in here ships.
 */

export const QUESTION = 'what did I promise Swiggy last week?';

export const ANSWER = {
  role: 'assistant',
  content:
    'You made **three commitments** to Swiggy in the last 7 days, and two are still open.\n' +
    '\n' +
    '- Send the revised pricing sheet — promised Tuesday, no follow-up in the thread since.\n' +
    '- Intro Priya to the integrations team — still unscheduled.\n' +
    '- Share the Q3 uptime report — **done** Thursday.',
  toolCalls: ['slack_search', 'notion_query', 'meetings_summary'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function useDemoBar(speed = 1) {
  const [barState, setBarState] = useState('sleeping');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setBarState('sleeping');
    setMessages([]);
    setLoading(false);
    setInput('');
  }, []);

  // Fakes a round trip so the answer arrives the way the real agent's would.
  const answer = useCallback(
    async (text, id) => {
      const alive = () => runId.current === id;
      setMessages((m) => [...m, { role: 'user', content: text }]);
      setBarState('conversing');
      setLoading(true);
      await sleep(1500 * speed);
      if (!alive()) return;
      setLoading(false);
      setMessages((m) => [...m, ANSWER]);
    },
    [speed]
  );

  const submit = useCallback(
    (text) => {
      const id = ++runId.current;
      setInput('');
      answer(text, id);
    },
    [answer]
  );

  // The full sleeping -> awake -> typing -> thinking -> answer -> sleeping loop.
  const play = useCallback(async () => {
    const id = ++runId.current;
    const alive = () => runId.current === id;

    setMessages([]);
    setInput('');
    setLoading(false);
    setBarState('sleeping');
    await sleep(420 * speed);
    if (!alive()) return;

    setBarState('awake');
    await sleep(560 * speed);
    if (!alive()) return;

    for (let i = 1; i <= QUESTION.length; i++) {
      if (!alive()) return;
      setInput(QUESTION.slice(0, i));
      await sleep((16 + Math.random() * 34) * speed);
    }
    await sleep(280 * speed);
    if (!alive()) return;

    setInput('');
    await answer(QUESTION, id);
    if (!alive()) return;

    await sleep(6000 * speed);
    if (!alive()) return;
    setBarState('sleeping');
    setMessages([]);
  }, [answer, speed]);

  const wake = useCallback(() => {
    runId.current += 1;
    setBarState((s) => (s === 'sleeping' ? 'awake' : 'sleeping'));
  }, []);

  return { barState, messages, loading, input, setInput, submit, play, reset, wake, QUESTION };
}
