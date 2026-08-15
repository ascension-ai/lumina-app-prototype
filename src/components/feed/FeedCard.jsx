import React from 'react';
import SlackSummaryWidget from './widgets/SlackSummaryWidget';
import TodoistWidget from './widgets/TodoistWidget';
import DiffWidget from './widgets/DiffWidget';
import MeetingsWidget from './widgets/MeetingsWidget';
import Markdown from './Markdown';

function formatTimestamp(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_META = {
  slack_summary: {
    label: 'Slack Summary',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2a2.5 2.5 0 0 0 0 5H17V4.5A2.5 2.5 0 0 0 14.5 2z"/>
        <path d="M7 8.5A2.5 2.5 0 0 0 9.5 11H17V8.5a2.5 2.5 0 0 0-5 0z"/>
      </svg>
    ),
    color: 'text-purple-600 bg-purple-50',
  },
  todoist: {
    label: 'Tasks Created',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    color: 'text-red-600 bg-red-50',
  },
  diff: {
    label: 'Change Detected',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18"/><path d="M3 12h18"/><path d="M5 5l14 14"/>
      </svg>
    ),
    color: 'text-amber-600 bg-amber-50',
  },
  meetings: {
    label: 'Meeting Insights',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z"/>
        <rect x="1" y="6" width="14" height="12" rx="2" ry="2"/>
      </svg>
    ),
    color: 'text-teal-600 bg-teal-50',
  },
  text: {
    label: 'Update',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
    color: 'text-blue-600 bg-blue-50',
  },
  chat: {
    label: 'Answer',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    color: 'text-indigo-600 bg-indigo-50',
  },
};

export default function FeedCard({ item }) {
  const meta = TYPE_META[item.type] || TYPE_META.text;

  return (
    <div className="bg-lumina-surface rounded-xl border border-lumina-border shadow-card hover:shadow-card-hover transition-shadow">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-lumina-border-light">
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
            {meta.icon}
          </div>
          <div>
            <span className="text-sm font-medium">{item.workflowName || 'Workflow'}</span>
            <span className="text-lumina-text-secondary text-sm ml-2">{meta.label}</span>
          </div>
        </div>
        <span className="text-xs text-lumina-text-secondary">
          {formatTimestamp(item.createdAt)}
        </span>
      </div>

      {/* Card body — renders the appropriate widget */}
      <div className="p-5">
        {item.type === 'slack_summary' && <SlackSummaryWidget data={item.data} />}
        {item.type === 'todoist' && <TodoistWidget data={item.data} />}
        {item.type === 'diff' && <DiffWidget data={item.data} />}
        {item.type === 'meetings' && <MeetingsWidget data={item.data} />}
        {item.type === 'chat' && <ChatWidget data={item.data} />}
        {item.type === 'text' && <TextWidget data={item.data} />}
      </div>
    </div>
  );
}

function ChatWidget({ data }) {
  return (
    <div className="space-y-3">
      {data.question && (
        <p className="text-xs text-lumina-text-secondary font-medium uppercase tracking-wide">
          {data.question}
        </p>
      )}
      <Markdown content={data.answer} />
      {data.toolCalls?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[...new Set(data.toolCalls)].map((tool) => (
            <span key={tool} className="text-[10px] px-2 py-0.5 rounded-full bg-lumina-bg border border-lumina-border text-lumina-text-secondary">
              {tool.replace('slack_', '').replace('notion_', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TextWidget({ data }) {
  return <Markdown content={data.content} />;
}
