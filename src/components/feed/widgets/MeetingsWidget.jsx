import React, { useState } from 'react';

const MAX_VISIBLE = 5;

export default function MeetingsWidget({ data }) {
  const { meetings = [], query } = data;
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? meetings : meetings.slice(0, MAX_VISIBLE);
  const hasMore = meetings.length > MAX_VISIBLE;

  return (
    <div>
      {query && (
        <p className="text-xs text-lumina-text-secondary mb-3">
          {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} found{query !== 'simulated' ? ` for "${query}"` : ''}
        </p>
      )}

      <div className="space-y-2">
        {visible.map((meeting, idx) => (
          <MeetingCard
            key={idx}
            meeting={meeting}
            expanded={expandedIdx === idx}
            onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          />
        ))}
      </div>

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs text-lumina-accent hover:underline"
        >
          Show {meetings.length - MAX_VISIBLE} more meeting{meetings.length - MAX_VISIBLE !== 1 ? 's' : ''}
        </button>
      )}

      {meetings.length === 0 && (
        <p className="text-sm text-lumina-text-secondary py-4 text-center">
          No meetings found.
        </p>
      )}
    </div>
  );
}

function MeetingCard({ meeting, expanded, onToggle }) {
  const initials = (meeting.account || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border border-lumina-border-light rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-lumina-bg/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-lumina-text truncate">
            {meeting.meetingUrl ? (
              <a
                href={meeting.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-teal-600"
                onClick={e => e.stopPropagation()}
              >
                {meeting.title}
              </a>
            ) : (
              meeting.title
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {meeting.account && (
              <span className="text-[10px] font-medium bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
                {meeting.account}
              </span>
            )}
            <span className="text-[10px] text-lumina-text-secondary">
              {meeting.date}
            </span>
            {meeting.duration && (
              <span className="text-[10px] text-lumina-text-secondary">
                {meeting.duration}
              </span>
            )}
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-lumina-text-secondary flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-lumina-border-light">
          {meeting.participants?.length > 0 && (
            <div className="pt-2">
              <div className="flex flex-wrap gap-1">
                {meeting.participants.slice(0, 8).map((p, i) => (
                  <span key={i} className="text-[10px] bg-lumina-bg px-1.5 py-0.5 rounded text-lumina-text-secondary">
                    {p}
                  </span>
                ))}
                {meeting.participants.length > 8 && (
                  <span className="text-[10px] text-lumina-text-secondary">
                    +{meeting.participants.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {meeting.keyTakeaways?.length > 0 && (
            <Section label="Key Takeaways" items={meeting.keyTakeaways} color="blue" />
          )}

          {meeting.goingWell?.length > 0 && (
            <Section label="Going Well" items={meeting.goingWell} color="green" />
          )}

          {meeting.notGoingWell?.length > 0 && (
            <Section label="Not Going Well" items={meeting.notGoingWell} color="red" />
          )}

          {meeting.nextSteps?.length > 0 && (
            <Section label="Next Steps" items={meeting.nextSteps} color="amber" />
          )}
        </div>
      )}
    </div>
  );
}

const SECTION_COLORS = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
};

function Section({ label, items, color }) {
  const styles = SECTION_COLORS[color] || SECTION_COLORS.blue;

  return (
    <div className={`rounded-lg border p-2 ${styles}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-70">
        {label}
      </div>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
