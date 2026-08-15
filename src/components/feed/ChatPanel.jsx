import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import useLuminaStore from '../../stores/store';

function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*)/g);
    const rendered = parts.map((part, j) => {
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return (
          <a key={j} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
            className="text-lumina-accent hover:text-lumina-accent/80 underline underline-offset-2">
            {linkMatch[1]}
          </a>
        );
      }
      const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
      if (boldMatch) {
        return <strong key={j} className="text-lumina-text font-semibold">{boldMatch[1]}</strong>;
      }
      return <span key={j}>{part}</span>;
    });

    const isBullet = line.match(/^\s*[-*]\s/);
    if (isBullet) {
      return (
        <div key={i} className="flex gap-2 py-0.5">
          <span className="text-lumina-accent mt-0.5 shrink-0">-</span>
          <span>{rendered}</span>
        </div>
      );
    }

    return <div key={i} className={line.trim() === '' ? 'h-2' : ''}>{rendered}</div>;
  });
}

// Local hint used only to choose the loader copy; the real routing happens server-side.
const RE_ANALYTICAL_HINT = /\b(how\s+many|across|compare|analyz\w*|aggregate|score|evaluate|framework)\b/i;

function modelLabel(model) {
  if (!model) return 'Haiku';
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  return 'Haiku';
}

const SCOPE_LABELS = {
  workspace: 'Workspace',
  context_graph: 'Context Graph',
  all: 'Both',
};
const SCOPE_HINTS = {
  workspace: 'Slack + Notion + meeting recordings',
  context_graph: 'Phase-1 context graph (14 customer accounts, cited answers only)',
  all: 'Workspace + context graph (everything)',
};

export default function ChatPanel() {
  const {
    chatOpen, closeChat, chatMessages, chatLoading, sendChat, clearChat,
    chatScope, chatScopesAvailable, setChatScope, refreshChatScopesAvailable,
  } = useLuminaStore();
  const [input, setInput] = useState('');
  const [pendingMode, setPendingMode] = useState('quick');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant');
  const activeModel = modelLabel(lastAssistant?.model);
  const loaderText = pendingMode === 'analytical' ? 'Analyzing…' : 'Searching…';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    if (chatOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
    if (chatOpen) refreshChatScopesAvailable?.();
  }, [chatOpen, refreshChatScopesAvailable]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || chatLoading) return;
    setPendingMode(RE_ANALYTICAL_HINT.test(trimmed) ? 'analytical' : 'quick');
    setInput('');
    try {
      await sendChat(trimmed);
    } catch {}
  };

  return (
    <AnimatePresence mode="sync">
      {chatOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={closeChat}
            className="absolute inset-0 z-40"
            style={{
              background: 'linear-gradient(to bottom, rgba(250,250,250,0.1) 0%, rgba(250,250,250,0.5) 100%)',
              backdropFilter: 'blur(8px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(8px) saturate(1.4)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="chat-panel"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{
              type: 'spring',
              damping: 35,
              stiffness: 200,
              mass: 1,
              restDelta: 0.5,
            }}
            className="absolute inset-x-0 bottom-0 z-50 flex flex-col"
            style={{ height: '78%' }}
          >
            <div
              className="flex-1 flex flex-col mx-3 mb-3 rounded-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(170deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.62) 40%, rgba(245,243,255,0.58) 100%)',
                backdropFilter: 'blur(60px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(60px) saturate(1.8)',
                border: '1px solid rgba(255,255,255,0.55)',
                boxShadow: '0 -2px 40px rgba(124, 58, 237, 0.06), 0 8px 60px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
              }}
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="w-10 h-1 rounded-full bg-lumina-text/10" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-2 border-b border-lumina-text/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-lumina-accent" style={{ boxShadow: '0 0 8px rgba(124,58,237,0.4)' }} />
                  <span className="text-sm font-semibold text-lumina-text/85">Ask Lumina</span>
                  <span className="text-[10px] text-lumina-text-secondary/60 px-1.5 py-0.5 rounded-md bg-lumina-text/[0.04] font-medium">
                    {activeModel}
                  </span>
                  {/* Scope selector — route this chat to Workspace / Context Graph / Both */}
                  <div className="flex items-center gap-1.5" title={SCOPE_HINTS[chatScope] || ''}>
                    <span className="text-[10px] text-lumina-text-secondary/60">scope:</span>
                    <select
                      value={chatScope}
                      onChange={(e) => setChatScope(e.target.value)}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-lumina-text/[0.04] text-lumina-text/80 border border-lumina-text/[0.06] focus:outline-none focus:border-lumina-accent/40 cursor-pointer"
                    >
                      {['workspace', 'context_graph', 'all'].map((s) => {
                        const disabled = !chatScopesAvailable.includes(s);
                        return (
                          <option key={s} value={s} disabled={disabled}>
                            {SCOPE_LABELS[s]}{disabled ? ' (MCP offline)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {chatMessages.length > 0 && (
                    <button
                      onClick={clearChat}
                      className="text-lumina-text-secondary/50 hover:text-lumina-text-secondary p-1.5 rounded-lg hover:bg-lumina-text/[0.05] transition-colors text-xs"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={closeChat}
                    className="text-lumina-text-secondary/50 hover:text-lumina-text-secondary p-1.5 rounded-lg hover:bg-lumina-text/[0.05] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {chatMessages.length === 0 && !chatLoading && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                      style={{
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.06) 100%)',
                        border: '1px solid rgba(124,58,237,0.1)',
                      }}
                    >
                      <svg className="w-7 h-7 text-lumina-accent/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    </div>
                    <p className="text-lumina-text/60 text-sm font-medium">Ask anything about your workspace</p>
                    <p className="text-lumina-text-secondary/40 text-xs mt-1">Searches Slack, Notion, and meeting recordings</p>
                  </motion.div>
                )}

                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {msg.role === 'user' ? (
                      <div className="flex justify-end">
                        <div
                          className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm text-lumina-text/90"
                          style={{
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(124,58,237,0.06) 100%)',
                            border: '1px solid rgba(124,58,237,0.12)',
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div
                          className="max-w-[90%] text-sm text-lumina-text/75 leading-relaxed p-4 rounded-2xl rounded-tl-md"
                          style={{
                            background: 'rgba(255,255,255,0.5)',
                            border: '1px solid rgba(0,0,0,0.04)',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                          }}
                        >
                          {renderMarkdown(msg.content)}
                        </div>
                        {(msg.toolCalls?.length > 0 || msg.scope) && (
                          <div className="flex flex-wrap gap-1.5 pl-1 items-center">
                            {msg.scope && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${msg.scope === 'context_graph' ? 'bg-lumina-accent/10 border-lumina-accent/30 text-lumina-accent' : msg.scope === 'all' ? 'bg-blue-500/10 border-blue-500/30 text-blue-700' : 'bg-lumina-text/[0.03] border-lumina-text/[0.06] text-lumina-text-secondary/70'}`}
                                title={SCOPE_HINTS[msg.scope]}
                              >
                                {SCOPE_LABELS[msg.scope] || msg.scope}
                              </span>
                            )}
                            {[...new Set(msg.toolCalls || [])].map((tool) => (
                              <span key={tool} className="text-[10px] px-2 py-0.5 rounded-full bg-lumina-text/[0.03] border border-lumina-text/[0.06] text-lumina-text-secondary/50">
                                {tool.replace('slack_', '').replace('notion_', '').replace('cg_', '')}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Query-scope transparency: for cg_* tools, show the exact scope the tool ran. Catches silent-default bugs — if this says "lifetime" but the user asked "last 2 weeks", something's off. */}
                        {msg.toolScopes?.length > 0 && (
                          <div className="pl-1 mt-1 space-y-0.5">
                            {msg.toolScopes.map((s, i) => (
                              <div
                                key={i}
                                className="text-[11px] text-lumina-text-secondary/70 italic leading-snug"
                                title={JSON.stringify(s.scope, null, 2)}
                              >
                                <span className="font-mono text-lumina-accent/90 not-italic">{s.name.replace('cg_', '')}</span>
                                <span className="mx-1 text-lumina-text-secondary/40">·</span>
                                {s.query_summary}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Thinking indicator */}
                {chatLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-2.5 text-lumina-text-secondary/50 text-sm pl-1"
                  >
                    <div className="flex gap-1">
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut', delay: 0 }}
                        className="w-1.5 h-1.5 rounded-full bg-lumina-accent/60"
                      />
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
                        className="w-1.5 h-1.5 rounded-full bg-lumina-accent/60"
                      />
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut', delay: 0.4 }}
                        className="w-1.5 h-1.5 rounded-full bg-lumina-accent/60"
                      />
                    </div>
                    <span>{loaderText}</span>
                  </motion.div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-lumina-text/[0.05]">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={chatLoading}
                    placeholder="Ask about deals, people, projects..."
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm text-lumina-text placeholder:text-lumina-text-secondary/40 disabled:opacity-50 outline-none"
                    style={{
                      background: 'rgba(0,0,0,0.03)',
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || chatLoading}
                    className="px-3.5 py-2.5 bg-lumina-accent text-white rounded-xl text-sm font-medium hover:bg-lumina-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    style={{ boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
