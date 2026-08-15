import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

const NODE_CONFIGS = {
  trigger: {
    accent: '#7C3AED',
    bg: 'bg-violet-50',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    label: 'Trigger',
  },
  source: {
    accent: '#3B82F6',
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    label: 'Source',
  },
  output: {
    accent: '#10B981',
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    label: 'Output',
  },
};

const ICONS = {
  // Triggers
  'cron-morning': (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    </svg>
  ),
  'cron-night': (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  'cron-hourly': (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  'cron-default': (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  // Sources
  slack: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2a2.5 2.5 0 0 0 0 5H17V4.5A2.5 2.5 0 0 0 14.5 2z"/>
      <path d="M7 8.5A2.5 2.5 0 0 0 9.5 11H17V8.5A2.5 2.5 0 0 0 12 8.5z"/>
    </svg>
  ),
  notion: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z"/><path d="M9 4v16"/><path d="M14 8l-5 8"/>
    </svg>
  ),
  meetings: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z"/>
      <rect x="1" y="6" width="14" height="12" rx="2" ry="2"/>
    </svg>
  ),
  // Outputs
  todoist: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  'in-app': (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16M4 6h16M4 18h10"/>
    </svg>
  ),
};

function getIcon(data) {
  if (data.type === 'trigger') {
    const cron = data.config?.cron || '';
    if (cron.includes('8 *')) return ICONS['cron-morning'];
    if (cron.includes('23 *')) return ICONS['cron-night'];
    if (cron === '0 * * * *') return ICONS['cron-hourly'];
    return ICONS['cron-default'];
  }
  if (data.type === 'source') return ICONS[data.source] || ICONS.meetings || ICONS.slack;
  if (data.type === 'output') return ICONS[data.destination] || ICONS['in-app'];
  return ICONS['cron-default'];
}

function getTitle(data) {
  if (data.type === 'trigger') return data.config?.label || 'Schedule';
  if (data.type === 'source') {
    const name = data.source === 'slack' ? 'Slack' : data.source === 'notion' ? 'Notion' : data.source === 'meetings' ? 'Meetings' : data.source || 'Source';
    return name;
  }
  if (data.type === 'output') {
    return data.destination === 'todoist' ? 'Todoist' : data.destination === 'in-app' ? 'In-App Feed' : data.destination || 'Output';
  }
  return 'Node';
}

function getSubtitle(data) {
  if (data.type === 'trigger') return data.config?.cron || '';
  if (data.type === 'source') return data.config?.target || '';
  if (data.type === 'output') return data.config?.label || '';
  return '';
}

const handleStyle = {
  width: 8,
  height: 8,
  border: '2px solid white',
  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
};

function WorkflowNode({ data, selected }) {
  const config = NODE_CONFIGS[data.type] || NODE_CONFIGS.source;
  const icon = getIcon(data);
  const title = getTitle(data);
  const subtitle = getSubtitle(data);

  return (
    <>
      {data.type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ ...handleStyle, background: config.accent }}
        />
      )}

      <div
        className={`px-4 py-3 rounded-xl min-w-[180px] max-w-[220px] transition-shadow ${
          selected ? 'shadow-card-hover ring-2 ring-offset-1' : 'shadow-card hover:shadow-card-hover'
        }`}
        style={{
          background: 'white',
          borderLeft: `3px solid ${config.accent}`,
          ringColor: selected ? config.accent : undefined,
          '--tw-ring-color': selected ? config.accent : undefined,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.iconBg} ${config.iconColor}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
              {config.label}
            </div>
            <div className="text-sm font-medium text-gray-800 truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-[11px] text-gray-400 truncate mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
        </div>
      </div>

      {data.type !== 'output' && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ ...handleStyle, background: config.accent }}
        />
      )}
    </>
  );
}

function PromptNode({ data, selected }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ ...handleStyle, background: '#F59E0B' }}
      />

      <div
        className={`rounded-xl transition-shadow ${
          selected ? 'shadow-card-hover ring-2 ring-offset-1' : 'shadow-card hover:shadow-card-hover'
        }`}
        style={{
          background: 'white',
          borderLeft: '3px solid #F59E0B',
          width: expanded ? 440 : 320,
          '--tw-ring-color': selected ? '#F59E0B' : undefined,
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 text-amber-600">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Prompt</div>
              <div className="text-xs font-medium text-gray-700">Instructions</div>
            </div>
          </div>
          <button
            className="nodrag text-gray-300 hover:text-gray-500 p-1 rounded hover:bg-gray-50 transition-colors"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {expanded ? (
                <>
                  <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                  <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
                </>
              ) : (
                <>
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </>
              )}
            </svg>
          </button>
        </div>

        <textarea
          className="nodrag nowheel nopan w-full px-3 py-2.5 text-sm text-gray-700 leading-relaxed resize-none outline-none placeholder:text-gray-300 bg-transparent"
          value={data.instructions || ''}
          onChange={(e) => data.onInstructionsChange?.(e.target.value)}
          rows={expanded ? 8 : 3}
          placeholder="Describe what this workflow should do..."
          style={{ borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ ...handleStyle, background: '#F59E0B' }}
      />
    </>
  );
}

export const TriggerNode = memo((props) => <WorkflowNode {...props} />);
export const SourceNode = memo((props) => <WorkflowNode {...props} />);
export const OutputNode = memo((props) => <WorkflowNode {...props} />);
const PromptNodeMemo = memo((props) => <PromptNode {...props} />);

export const nodeTypes = {
  trigger: TriggerNode,
  source: SourceNode,
  output: OutputNode,
  prompt: PromptNodeMemo,
};
