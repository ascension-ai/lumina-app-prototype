import React, { useState } from 'react';
import useLuminaStore from '../../stores/store';

export default function CommandBar() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const { workflows, triggerWorkflow, sendChat, chatLoading } = useLuminaStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    // Handle /run command
    const runMatch = trimmed.match(/^\/run\s+(.+)$/i);
    if (runMatch) {
      const query = runMatch[1].toLowerCase();
      const wf = workflows.find(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.name.toLowerCase().replace(/\s+/g, '-').includes(query)
      );

      if (wf) {
        setStatus({ type: 'running', text: `Running "${wf.name}"...` });
        try {
          await triggerWorkflow(wf.id);
          setStatus({ type: 'success', text: `"${wf.name}" completed` });
          setTimeout(() => setStatus(null), 3000);
        } catch (err) {
          setStatus({ type: 'error', text: `Failed: ${err.message}` });
          setTimeout(() => setStatus(null), 5000);
        }
      } else {
        setStatus({ type: 'error', text: `No workflow matching "${runMatch[1]}"` });
        setTimeout(() => setStatus(null), 3000);
      }
      setInput('');
      return;
    }

    // Handle other commands
    if (trimmed.startsWith('/')) {
      setStatus({ type: 'info', text: 'Available: /run [workflow name]' });
      setTimeout(() => setStatus(null), 3000);
      setInput('');
      return;
    }

    // Plain text → open chat panel and send
    setInput('');
    try {
      await sendChat(trimmed);
    } catch {}
  };

  return (
    <div className="flex-shrink-0 border-t border-lumina-border bg-lumina-surface px-8 py-3">
      {/* Status message */}
      {status && (
        <div
          className={`text-xs mb-2 px-3 py-1.5 rounded-lg inline-block ${
            status.type === 'success'
              ? 'bg-lumina-success-light text-green-700'
              : status.type === 'error'
              ? 'bg-lumina-danger-light text-red-700'
              : status.type === 'running'
              ? 'bg-lumina-accent-light text-lumina-accent'
              : 'bg-lumina-border-light text-lumina-text-secondary'
          }`}
        >
          {status.type === 'running' && (
            <svg className="w-3 h-3 inline-block mr-1 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
          )}
          {status.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-2xl mx-auto">
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={chatLoading}
            placeholder="Ask a question or /run [workflow]..."
            className="w-full bg-lumina-bg border border-lumina-border rounded-xl px-4 py-2.5 text-sm placeholder:text-lumina-text-secondary/60 focus:ring-2 focus:ring-lumina-accent/20 focus:border-lumina-accent disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || chatLoading}
          className="px-4 py-2.5 bg-lumina-accent text-white rounded-xl text-sm font-medium hover:bg-lumina-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
