/*
 * The same ~30-line markdown renderer the bar has always used (links, bold, bullets),
 * lifted out of FloatingBar so every skin shares one copy. Still no markdown dependency.
 */
export default function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*)/g);
    const rendered = parts.map((part, j) => {
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return (
          <a key={j} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="lp-link">
            {linkMatch[1]}
          </a>
        );
      }
      const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
      if (boldMatch) return <strong key={j} className="lp-strong">{boldMatch[1]}</strong>;
      return part;
    });
    if (line.match(/^\s*[-*]\s/)) {
      return (
        <div key={i} className="lp-bullet">
          <span className="lp-bullet-dot" />
          <span>{rendered}</span>
        </div>
      );
    }
    return <div key={i} className={line.trim() === '' ? 'lp-gap' : ''}>{rendered}</div>;
  });
}
