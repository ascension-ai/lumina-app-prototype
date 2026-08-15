import React, { useState } from 'react';

const NODE_TEMPLATES = [
  {
    section: 'Triggers',
    items: [
      { label: 'Daily Morning', sublabel: '8:00 AM', template: { type: 'trigger', config: { cron: '0 8 * * *', label: 'Every morning at 8 AM' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/></svg>,
        color: 'text-amber-600 bg-amber-50',
      },
      { label: 'Daily Night', sublabel: '11:00 PM', template: { type: 'trigger', config: { cron: '0 23 * * *', label: 'Every night at 11 PM' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
        color: 'text-indigo-600 bg-indigo-50',
      },
      { label: 'Hourly', sublabel: 'Every 60 min', template: { type: 'trigger', config: { cron: '0 * * * *', label: 'Every hour' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
        color: 'text-violet-600 bg-violet-50',
      },
    ],
  },
  {
    section: 'Sources',
    items: [
      { label: 'Slack', sublabel: 'All channels', template: { type: 'source', source: 'slack', config: { target: 'all', label: 'All Slack channels' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2a2.5 2.5 0 0 0 0 5H17V4.5A2.5 2.5 0 0 0 14.5 2z"/><path d="M7 8.5A2.5 2.5 0 0 0 9.5 11H17V8.5a2.5 2.5 0 0 0-5 0z"/></svg>,
        color: 'text-purple-600 bg-purple-50',
      },
      { label: 'Slack Mentions', sublabel: '@mentions only', template: { type: 'source', source: 'slack', config: { target: 'mentions', label: 'Slack mentions' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>,
        color: 'text-purple-600 bg-purple-50',
      },
      { label: 'Notion Page', sublabel: 'Monitor a page tree', template: { type: 'source', source: 'notion', config: { target: 'Engineering Docs', label: 'Notion page' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="M9 4v16"/><path d="M14 8l-5 8"/></svg>,
        color: 'text-gray-700 bg-gray-50',
      },
      { label: 'Meetings', sublabel: 'All recordings', template: { type: 'source', source: 'meetings', config: { target: 'all', label: 'Meeting recordings' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z"/><rect x="1" y="6" width="14" height="12" rx="2" ry="2"/></svg>,
        color: 'text-teal-600 bg-teal-50',
      },
    ],
  },
  {
    section: 'Outputs',
    items: [
      { label: 'Todoist', sublabel: 'Create tasks', template: { type: 'output', destination: 'todoist', config: { label: 'Todoist' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
        color: 'text-red-600 bg-red-50',
      },
      { label: 'In-App Feed', sublabel: 'Show in Lumina', template: { type: 'output', destination: 'in-app', config: { label: 'In-App Feed' } },
        icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16M4 6h16M4 18h10"/></svg>,
        color: 'text-violet-600 bg-violet-50',
      },
    ],
  },
];

const CRON_PRESETS = [
  { label: 'Every morning at 8 AM', value: '0 8 * * *' },
  { label: 'Every night at 11 PM', value: '0 23 * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
];

function NodeProperties({ node, onUpdate, onRemove }) {
  const data = node.data;
  const type = data.type;

  return (
    <div className="p-4 border-b border-lumina-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Properties</h4>
        <button onClick={() => onRemove(node.id)}
          className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
          Delete
        </button>
      </div>

      {type === 'trigger' && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Schedule</label>
            <select
              value={data.config?.cron || ''}
              onChange={(e) => {
                const preset = CRON_PRESETS.find((p) => p.value === e.target.value);
                onUpdate(node.id, { config: { cron: e.target.value, label: preset?.label || e.target.value } });
              }}
              className="w-full text-sm border border-lumina-border rounded-lg px-3 py-2 bg-white"
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Custom Cron</label>
            <input type="text" value={data.config?.cron || ''}
              onChange={(e) => onUpdate(node.id, { config: { cron: e.target.value, label: e.target.value } })}
              className="w-full text-sm border border-lumina-border rounded-lg px-3 py-2 font-mono"
              placeholder="0 8 * * *" />
          </div>
        </div>
      )}

      {type === 'source' && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Source</label>
            <select value={data.source || 'slack'}
              onChange={(e) => onUpdate(node.id, { source: e.target.value })}
              className="w-full text-sm border border-lumina-border rounded-lg px-3 py-2 bg-white">
              <option value="slack">Slack</option>
              <option value="notion">Notion</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Target</label>
            <input type="text" value={data.config?.target || ''}
              onChange={(e) => onUpdate(node.id, { config: { target: e.target.value, label: e.target.value } })}
              className="w-full text-sm border border-lumina-border rounded-lg px-3 py-2"
              placeholder="all, mentions, page name..." />
          </div>
        </div>
      )}

      {type === 'output' && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Destination</label>
            <select value={data.destination || 'in-app'}
              onChange={(e) => {
                const label = e.target.value === 'todoist' ? 'Todoist' : 'In-App Feed';
                onUpdate(node.id, { destination: e.target.value, config: { label } });
              }}
              className="w-full text-sm border border-lumina-border rounded-lg px-3 py-2 bg-white">
              <option value="todoist">Todoist</option>
              <option value="in-app">In-App Feed</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  selectedNode,
  onAddNode,
  onRemoveNode,
  onUpdateNode,
  showSkill,
  skillContent,
  onCloseSkill,
}) {
  const [tab, setTab] = useState('nodes');

  return (
    <aside className="w-72 flex-shrink-0 border-l border-lumina-border bg-lumina-surface flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-lumina-border">
        <button onClick={() => setTab('nodes')}
          className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
            tab === 'nodes' ? 'text-lumina-accent border-b-2 border-lumina-accent' : 'text-gray-400 hover:text-gray-600'
          }`}>
          Nodes
        </button>
        {showSkill && (
          <button onClick={() => setTab('skill')}
            className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
              tab === 'skill' ? 'text-lumina-accent border-b-2 border-lumina-accent' : 'text-gray-400 hover:text-gray-600'
            }`}>
            Skill
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Nodes tab */}
        {tab === 'nodes' && (
          <div>
            {/* Selected node properties */}
            {selectedNode && (
              <NodeProperties node={selectedNode} onUpdate={onUpdateNode} onRemove={onRemoveNode} />
            )}

            {/* Node palette */}
            <div className="p-4">
              <p className="text-[11px] text-gray-400 mb-3">
                {selectedNode ? 'Add more nodes' : 'Click to add nodes to the canvas'}
              </p>
              {NODE_TEMPLATES.map((section) => (
                <div key={section.section} className="mb-4">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {section.section}
                  </span>
                  <div className="space-y-1.5 mt-1.5">
                    {section.items.map((item, i) => (
                      <button key={i} onClick={() => onAddNode(item.template)}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left transition-all hover:shadow-card ${item.color}`}>
                        <div className="shrink-0">{item.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{item.label}</div>
                          <div className="text-[10px] opacity-60">{item.sublabel}</div>
                        </div>
                        <svg className="w-3.5 h-3.5 opacity-30 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skill tab */}
        {tab === 'skill' && showSkill && skillContent && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-lumina-success-light text-green-700 px-1.5 py-0.5 rounded font-medium">
                  Compiled
                </span>
                <span className="text-xs font-medium text-gray-500">SKILL.md</span>
              </div>
              <button onClick={onCloseSkill} className="text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {skillContent}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
}
