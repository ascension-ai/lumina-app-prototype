import React, { useState } from 'react';

const PRIORITY_STYLES = {
  high: 'border-l-red-500 bg-red-50/40',
  medium: 'border-l-amber-500 bg-amber-50/40',
  low: 'border-l-blue-500 bg-blue-50/40',
};

const PRIORITY_BADGE = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

export default function TodoistWidget({ data }) {
  const [tasks, setTasks] = useState(data.tasks || []);

  const toggleTask = (idx) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, done: !t.done } : t))
    );
  };

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-lumina-text">
          {pending.length} task{pending.length !== 1 ? 's' : ''} pending
        </span>
        {done.length > 0 && (
          <span className="text-xs text-lumina-success font-medium">
            {done.length} completed
          </span>
        )}
      </div>

      <div className="space-y-2">
        {tasks.map((task, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 p-3 rounded-lg border-l-3 transition-all ${
              task.done
                ? 'bg-lumina-bg border-l-gray-300 opacity-60'
                : PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.low
            }`}
          >
            {/* Checkbox */}
            <button
              onClick={() => toggleTask(idx)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                task.done
                  ? 'bg-lumina-success border-lumina-success'
                  : 'border-gray-300 hover:border-lumina-accent'
              }`}
            >
              {task.done && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug ${task.done ? 'line-through text-lumina-text-secondary' : 'text-lumina-text'}`}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] text-lumina-text-secondary">
                  Due: {task.dueDate}
                </span>
                {!task.done && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low}`}>
                    {task.priority}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
