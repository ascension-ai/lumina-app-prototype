import React from 'react';

/*
 * Markdown renderer for feed cards.
 *
 * Feed text comes straight from the model, so it arrives as real markdown —
 * `## headings`, `**bold**`, `- bullets`, `inline code`, blank-line paragraph
 * breaks. Rendering it into a bare <p> collapsed every newline into a space and
 * printed the syntax literally, which is what made cards read as one grey wall.
 *
 * Block-level first (headings / lists / paragraphs), then inline within each.
 * Still no markdown dependency — this handles what the model actually emits.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text, keyPrefix = '') {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;

    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={key} className="font-semibold text-lumina-text">{bold[1]}</strong>;

    const code = part.match(/^`([^`]+)`$/);
    if (code) {
      return (
        <code key={key} className="font-mono text-[0.85em] px-1 py-0.5 rounded bg-lumina-bg border border-lumina-border-light text-lumina-text">
          {code[1]}
        </code>
      );
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer"
           className="text-lumina-accent hover:underline underline-offset-2">
          {link[1]}
        </a>
      );
    }

    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

const HEADING = /^(#{1,4})\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;

export default function Markdown({ content, className = '' }) {
  if (!content) return null;

  const lines = String(content).split('\n');
  const blocks = [];
  let list = null;          // { ordered, items[] }
  let para = [];            // buffered plain lines
  let fence = null;         // { lines[] } while inside a ``` block

  const flushPara = () => {
    if (!para.length) return;
    blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({ kind: 'list', ...list });
    list = null;
  };

  for (const line of lines) {
    // Fenced code — models sometimes leak a raw JSON payload into a text card.
    // Far better as a scrollable <pre> than as a mangled paragraph.
    const f = line.match(/^\s*```(\w*)\s*$/);
    if (f) {
      if (fence) { blocks.push({ kind: 'code', text: fence.lines.join('\n') }); fence = null; }
      else { flushPara(); flushList(); fence = { lines: [] }; }
      continue;
    }
    if (fence) { fence.lines.push(line); continue; }

    if (!line.trim()) { flushPara(); flushList(); continue; }

    const h = line.match(HEADING);
    if (h) { flushPara(); flushList(); blocks.push({ kind: 'h', level: h[1].length, text: h[2] }); continue; }

    const b = line.match(BULLET);
    if (b) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(b[1]);
      continue;
    }

    const o = line.match(ORDERED);
    if (o) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(o[2]);
      continue;
    }

    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  if (fence) blocks.push({ kind: 'code', text: fence.lines.join('\n') });  // unterminated fence

  return (
    <div className={`text-sm text-lumina-text leading-relaxed space-y-2.5 ${className}`}>
      {blocks.map((blk, i) => {
        if (blk.kind === 'h') {
          const size = blk.level <= 2 ? 'text-[15px]' : 'text-sm';
          return (
            <h4 key={i} className={`${size} font-semibold text-lumina-text ${i > 0 ? 'pt-1' : ''}`}>
              {renderInline(blk.text, `h${i}`)}
            </h4>
          );
        }

        if (blk.kind === 'code') {
          return (
            <pre key={i} className="text-[11px] font-mono leading-relaxed bg-lumina-bg border border-lumina-border-light rounded-lg p-3 overflow-x-auto text-lumina-text-secondary">
              {blk.text}
            </pre>
          );
        }

        if (blk.kind === 'list') {
          const Tag = blk.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className="space-y-1.5">
              {blk.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  {blk.ordered ? (
                    <span className="text-lumina-text-secondary tabular-nums shrink-0 text-[13px]">{j + 1}.</span>
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-lumina-accent/50 shrink-0 mt-[0.55rem]" />
                  )}
                  <span className="flex-1 min-w-0">{renderInline(item, `l${i}-${j}`)}</span>
                </li>
              ))}
            </Tag>
          );
        }

        return <p key={i}>{renderInline(blk.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
