import React from 'react';
import useLuminaStore from '../stores/store';

const ICONS = {
  slack: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2a2.5 2.5 0 0 0 0 5H17V4.5A2.5 2.5 0 0 0 14.5 2z"/>
      <path d="M7 8.5A2.5 2.5 0 0 0 9.5 11H17V8.5a2.5 2.5 0 0 0-5 0z"/>
    </svg>
  ),
  notion: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z"/><path d="M9 4v16"/><path d="M14 8l-5 8"/>
    </svg>
  ),
  default: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  ),
};

function getWorkflowIcon(workflow) {
  const sources = workflow.blocks?.filter(b => b.type === 'source') || [];
  if (sources.some(b => b.source === 'slack')) return ICONS.slack;
  if (sources.some(b => b.source === 'notion')) return ICONS.notion;
  return ICONS.default;
}

export default function Sidebar() {
  const {
    workflows,
    selectedWorkflowId,
    view,
    executingWorkflows,
    selectWorkflow,
    setView,
    openStudio,
    toggleWorkflow,
    triggerWorkflow,
  } = useLuminaStore();

  const handleRunNow = async (e, wfId) => {
    e.stopPropagation();
    try {
      await triggerWorkflow(wfId);
    } catch (err) {
      console.error('Run failed:', err);
    }
  };

  return (
    <aside className="w-64 flex-shrink-0 border-r border-lumina-border bg-lumina-surface flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-lumina-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-lumina-accent flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          </div>
          <span className="text-base font-semibold tracking-tight">Lumina</span>
        </div>
      </div>

      {/* Workflows list */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-4 mb-2">
          <span className="text-[11px] font-semibold text-lumina-text-secondary uppercase tracking-wider">
            Workflows
          </span>
        </div>

        <div className="space-y-0.5 px-2">
          {workflows.map((wf) => {
            const isRunning = executingWorkflows.has(wf.id);
            return (
              <div key={wf.id} className="group">
                <button
                  onClick={() => {
                    selectWorkflow(wf.id);
                    if (view !== 'feed') setView('feed');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    selectedWorkflowId === wf.id
                      ? 'bg-lumina-accent/8 text-lumina-accent'
                      : 'text-lumina-text hover:bg-lumina-border-light'
                  }`}
                >
                  {/* Icon with active indicator */}
                  <div className="relative flex-shrink-0">
                    <span className={`text-lumina-text-secondary ${
                      selectedWorkflowId === wf.id ? 'text-lumina-accent' : ''
                    }`}>
                      {isRunning ? (
                        <svg className="w-4 h-4 animate-spin text-lumina-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a10 10 0 0 1 10 10"/>
                        </svg>
                      ) : (
                        getWorkflowIcon(wf)
                      )}
                    </span>
                    {wf.active && !isRunning && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-lumina-success rounded-full border border-lumina-surface" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-[13px]">{wf.name}</div>
                    <div className="text-[11px] text-lumina-text-secondary truncate mt-0.5">
                      {isRunning ? (
                        <span className="text-lumina-accent">Running...</span>
                      ) : (
                        wf.cron ? describeCron(wf.cron) : 'No schedule'
                      )}
                    </div>
                  </div>

                  {/* Run Now + Toggle */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Run Now button */}
                    <button
                      onClick={(e) => handleRunNow(e, wf.id)}
                      disabled={isRunning}
                      title="Run now"
                      className={`titlebar-no-drag p-1 rounded-md transition-all ${
                        isRunning
                          ? 'opacity-30 cursor-not-allowed'
                          : 'opacity-0 group-hover:opacity-100 hover:bg-lumina-accent/10 text-lumina-text-secondary hover:text-lumina-accent'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </button>

                    {/* Toggle active */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWorkflow(wf.id);
                      }}
                      className={`titlebar-no-drag w-8 h-[18px] rounded-full transition-colors relative ${
                        wf.active ? 'bg-lumina-success' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                          wf.active ? 'left-[16px]' : 'left-[2px]'
                        }`}
                      />
                    </button>
                  </div>
                </button>
              </div>
            );
          })}

          {workflows.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-lumina-text-secondary">
              No workflows yet. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="p-3 border-t border-lumina-border space-y-2">
        <button
          onClick={() => openStudio()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lumina-accent text-white rounded-lg text-sm font-medium hover:bg-lumina-accent/90 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Workflow
        </button>

        <button
          onClick={() => {
            const wf = workflows.find(w => w.id === selectedWorkflowId) || workflows[0];
            if (wf) openStudio(wf);
          }}
          disabled={workflows.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-lumina-border rounded-lg text-sm font-medium text-lumina-text-secondary hover:bg-lumina-border-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          Manage Workflows
        </button>
      </div>
    </aside>
  );
}

function describeCron(cron) {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [min, hour] = parts;
  const h = parseInt(hour);
  const m = parseInt(min);

  if (hour === '*') return `Every hour`;

  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const displayM = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;

  return `Daily at ${displayH}${displayM} ${period}`;
}
