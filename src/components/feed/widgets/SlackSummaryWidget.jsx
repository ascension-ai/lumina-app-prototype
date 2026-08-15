import React, { useState } from 'react';

export default function SlackSummaryWidget({ data }) {
  const [activeTab, setActiveTab] = useState('urgent');
  const { urgent = [], fyi = [] } = data;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-lumina-border-light">
        <button
          onClick={() => setActiveTab('urgent')}
          className={`px-3 py-2 text-sm transition-colors ${
            activeTab === 'urgent' ? 'tab-active' : 'tab-inactive'
          }`}
        >
          Urgent
          {urgent.length > 0 && (
            <span className="ml-1.5 bg-lumina-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {urgent.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('fyi')}
          className={`px-3 py-2 text-sm transition-colors ${
            activeTab === 'fyi' ? 'tab-active' : 'tab-inactive'
          }`}
        >
          FYI
          {fyi.length > 0 && (
            <span className="ml-1.5 bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {fyi.length}
            </span>
          )}
        </button>
      </div>

      {/* Messages list */}
      <div className="space-y-3">
        {(activeTab === 'urgent' ? urgent : fyi).map((msg, idx) => (
          <SlackMessage key={idx} message={msg} isUrgent={activeTab === 'urgent'} />
        ))}

        {(activeTab === 'urgent' ? urgent : fyi).length === 0 && (
          <p className="text-sm text-lumina-text-secondary py-4 text-center">
            Nothing here — you're all caught up.
          </p>
        )}
      </div>
    </div>
  );
}

function SlackMessage({ message, isUrgent }) {
  return (
    <div className={`flex gap-3 p-3 rounded-lg ${isUrgent ? 'bg-red-50/60' : 'bg-lumina-bg'}`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lumina-accent/30 to-lumina-accent/10 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-lumina-accent">
          {message.author?.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium">{message.author}</span>
          <span className="text-[11px] text-lumina-text-secondary bg-lumina-border-light px-1.5 py-0.5 rounded">
            {message.channel}
          </span>
          <span className="text-[11px] text-lumina-text-secondary ml-auto flex-shrink-0">
            {message.time}
          </span>
        </div>
        <p className="text-sm text-lumina-text/80 leading-relaxed">{message.message}</p>
      </div>
    </div>
  );
}
