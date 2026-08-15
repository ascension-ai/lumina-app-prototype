import React, { useEffect } from 'react';
import useLuminaStore from './stores/store';
import Sidebar from './components/Sidebar';
import FeedView from './components/feed/FeedView';
import StudioView from './components/studio/StudioView';
import FloatingBar from './components/FloatingBar';

export default function App() {
  const { view, appMode, loadWorkflows, loadFeedItems, addFeedItem, collapseApp } = useLuminaStore();

  useEffect(() => {
    loadWorkflows();
    loadFeedItems();

    // Listen for real-time feed updates from the scheduler
    if (window.lumina?.onFeedItemAdded) {
      const cleanup = window.lumina.onFeedItemAdded((item) => {
        addFeedItem(item);
      });
      return cleanup;
    }
  }, []);

  if (appMode === 'floating') {
    return <FloatingBar />;
  }

  return (
    <div className="h-screen flex flex-col bg-lumina-bg overflow-hidden rounded-xl">
      {/* Title bar drag region */}
      <div className="titlebar-drag h-8 flex-shrink-0 flex items-center px-4">
        {/* Custom window controls since frame: false */}
        <div className="flex items-center gap-2 titlebar-no-drag">
          <button
            onClick={collapseApp}
            className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500 transition-colors"
            title="Collapse to floating bar"
          />
        </div>
        <span className="titlebar-no-drag text-xs font-medium text-lumina-text-secondary tracking-wide uppercase ml-4">
          Lumina
        </span>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {view === 'feed' && <FeedView />}
          {view === 'studio' && <StudioView />}
        </main>
      </div>
    </div>
  );
}
