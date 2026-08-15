const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumina', {
  // Workflows
  getWorkflows: () => ipcRenderer.invoke('get-workflows'),
  getWorkflow: (id) => ipcRenderer.invoke('get-workflow', id),
  createWorkflow: (workflow) => ipcRenderer.invoke('create-workflow', workflow),
  updateWorkflow: (id, updates) => ipcRenderer.invoke('update-workflow', id, updates),
  deleteWorkflow: (id) => ipcRenderer.invoke('delete-workflow', id),

  // Feed
  getFeedItems: (limit) => ipcRenderer.invoke('get-feed-items', limit),
  getFeedItemsByWorkflow: (workflowId, limit) => ipcRenderer.invoke('get-feed-items-by-workflow', workflowId, limit),

  // Skill compilation
  compileSkill: (workflowId) => ipcRenderer.invoke('compile-skill', workflowId),

  // Workflow execution
  triggerWorkflow: (workflowId) => ipcRenderer.invoke('trigger-workflow', workflowId),

  // Scheduler
  refreshScheduler: () => ipcRenderer.invoke('refresh-scheduler'),

  // Agent status
  getAgentStatus: () => ipcRenderer.invoke('agent-status'),

  // Window mode
  wakeWindow: () => ipcRenderer.invoke('wake-window'),
  sleepWindow: () => ipcRenderer.invoke('sleep-window'),
  expandWindow: () => ipcRenderer.invoke('expand-window'),
  collapseWindow: () => ipcRenderer.invoke('collapse-window'),
  resizeFloating: (height) => ipcRenderer.invoke('resize-floating', height),

  onToggleWake: (callback) => {
    ipcRenderer.on('toggle-wake', (_event) => callback());
    return () => ipcRenderer.removeAllListeners('toggle-wake');
  },

  // Chat. Scope selects which MCP tools the agent can call:
  //   'workspace' (default) | 'context_graph' | 'all'
  sendChat: (message, scope) => ipcRenderer.invoke('send-chat', message, scope),
  getChatScopesAvailable: () => ipcRenderer.invoke('chat-scopes-available'),

  // Events from main process
  onChatThinking: (callback) => {
    ipcRenderer.on('chat-thinking', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('chat-thinking');
  },

  onFeedItemAdded: (callback) => {
    ipcRenderer.on('feed-item-added', (_event, item) => callback(item));
    return () => ipcRenderer.removeAllListeners('feed-item-added');
  },

  onWorkflowExecuting: (callback) => {
    ipcRenderer.on('workflow-executing', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('workflow-executing');
  },

  onToolCall: (callback) => {
    ipcRenderer.on('tool-call', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('tool-call');
  },

  onAgentStatus: (callback) => {
    ipcRenderer.on('agent-status', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('agent-status');
  },
});
