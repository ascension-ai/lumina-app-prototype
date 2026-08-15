import React from 'react';
import useLuminaStore from '../../stores/store';
import FeedCard from './FeedCard';
import CommandBar from './CommandBar';
import ChatPanel from './ChatPanel';

export default function FeedView() {
  const { feedItems, selectedWorkflowId, workflows, executingWorkflows, triggerWorkflow } = useLuminaStore();

  const filteredItems = selectedWorkflowId
    ? feedItems.filter((item) => item.workflowId === selectedWorkflowId)
    : feedItems;

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);
  const isRunning = selectedWorkflow && executingWorkflows.has(selectedWorkflow.id);

  return (
    <div className="h-full flex flex-col bg-lumina-bg relative">
      {/* Header */}
      <header className="flex-shrink-0 px-8 py-5 border-b border-lumina-border bg-lumina-surface">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {selectedWorkflow ? selectedWorkflow.name : 'Feed'}
            </h1>
            <p className="text-sm text-lumina-text-secondary mt-0.5">
              {selectedWorkflow
                ? selectedWorkflow.description
                : 'Your unified activity stream from all workflows'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedWorkflow && (
              <button
                onClick={() => triggerWorkflow(selectedWorkflow.id)}
                disabled={isRunning}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isRunning
                    ? 'bg-lumina-accent/10 text-lumina-accent cursor-wait'
                    : 'bg-lumina-accent text-white hover:bg-lumina-accent/90'
                }`}
              >
                {isRunning ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Run Now
                  </>
                )}
              </button>
            )}
            {selectedWorkflow && (
              <button
                onClick={() => useLuminaStore.getState().selectWorkflow(null)}
                className="text-sm text-lumina-text-secondary hover:text-lumina-text px-3 py-2 rounded-lg hover:bg-lumina-border-light transition-colors"
              >
                Show all
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {filteredItems.length > 0 ? (
          <div className="max-w-2xl mx-auto space-y-4">
            {filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className="animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <FeedCard item={item} />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-lumina-border-light flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-lumina-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12h16M4 6h16M4 18h10"/>
              </svg>
            </div>
            <h3 className="text-base font-medium text-lumina-text mb-1">No activity yet</h3>
            <p className="text-sm text-lumina-text-secondary text-center max-w-xs">
              {selectedWorkflow
                ? 'This workflow hasn\'t produced any output yet. Try running it manually.'
                : 'Your feed will populate as workflows run on their schedules.'}
            </p>
          </div>
        )}
      </div>

      {/* Command Bar */}
      <CommandBar />

      {/* Chat overlay */}
      <ChatPanel />
    </div>
  );
}
