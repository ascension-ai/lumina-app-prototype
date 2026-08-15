import React, { useState } from 'react';

const CHANGE_TYPE_STYLES = {
  added: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
    icon: '+',
  },
  modified: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: '~',
  },
  deleted: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    icon: '-',
  },
};

export default function DiffWidget({ data }) {
  const [showMinor, setShowMinor] = useState(false);
  const { pageName, changes = [] } = data;

  const majorChanges = changes.filter((c) => c.severity === 'major');
  const minorChanges = changes.filter((c) => c.severity === 'minor');
  const displayChanges = showMinor ? changes : majorChanges;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-lumina-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="text-sm font-medium">{pageName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
            {changes.filter(c => c.type === 'added').length} added
          </span>
          <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
            {changes.filter(c => c.type === 'modified').length} modified
          </span>
          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
            {changes.filter(c => c.type === 'deleted').length} removed
          </span>
        </div>
      </div>

      {/* Changes list */}
      <div className="space-y-2">
        {displayChanges.map((change, idx) => {
          const style = CHANGE_TYPE_STYLES[change.type] || CHANGE_TYPE_STYLES.modified;
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg border ${style.bg} ${style.border}`}
            >
              <span className={`w-6 h-6 rounded flex items-center justify-center text-sm font-mono font-bold flex-shrink-0 ${style.badge}`}>
                {style.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-lumina-text">{change.section}</p>
                <p className="text-xs text-lumina-text-secondary mt-0.5 leading-relaxed">
                  {change.description}
                </p>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                change.severity === 'major' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {change.severity}
              </span>
            </div>
          );
        })}
      </div>

      {/* Show minor toggle */}
      {minorChanges.length > 0 && (
        <button
          onClick={() => setShowMinor(!showMinor)}
          className="mt-3 text-xs text-lumina-text-secondary hover:text-lumina-accent transition-colors"
        >
          {showMinor
            ? 'Hide minor changes'
            : `+ ${minorChanges.length} minor change${minorChanges.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
