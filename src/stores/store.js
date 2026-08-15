import { create } from 'zustand';

const useLuminaStore = create((set, get) => ({
  // App mode
  appMode: 'floating', // 'floating' | 'expanded'
  barState: 'sleeping', // 'sleeping' | 'awake' | 'conversing'

  // View state
  view: 'feed', // 'feed' | 'studio'
  selectedWorkflowId: null,
  editingWorkflow: null,

  // Data
  workflows: [],
  feedItems: [],

  // Loading states
  loading: false,
  compiling: false,
  executingWorkflows: new Set(), // workflow IDs currently running
  chatOpen: false,
  chatLoading: false,
  chatMessages: [], // { role: 'user'|'assistant', content: string, toolCalls?: string[] }

  // Actions — App mode
  wakeBar: async () => {
    if (window.lumina?.wakeWindow) await window.lumina.wakeWindow();
    set({ barState: 'awake' });
  },
  sleepBar: async () => {
    if (window.lumina?.sleepWindow) await window.lumina.sleepWindow();
    set({ barState: 'sleeping' });
  },
  expandApp: async () => {
    if (window.lumina?.expandWindow) await window.lumina.expandWindow();
    set({ appMode: 'expanded' });
  },
  collapseApp: async () => {
    if (window.lumina?.collapseWindow) await window.lumina.collapseWindow();
    set({ appMode: 'floating', barState: 'sleeping' });
  },

  // Actions — View
  setView: (view) => set({ view }),
  selectWorkflow: (id) => set({ selectedWorkflowId: id }),

  openStudio: (workflow = null) => {
    if (workflow) {
      set({ view: 'studio', editingWorkflow: { ...workflow } });
    } else {
      // New workflow
      set({
        view: 'studio',
        editingWorkflow: {
          id: null,
          name: 'Untitled Workflow',
          description: '',
          cron: '0 8 * * *',
          active: false,
          blocks: [],
          instructions: '',
          skillContent: '',
        },
      });
    }
  },

  closeStudio: () => set({ view: 'feed', editingWorkflow: null }),

  updateEditingWorkflow: (updates) => {
    const current = get().editingWorkflow;
    if (!current) return;
    set({ editingWorkflow: { ...current, ...updates } });
  },

  // Actions — Data
  loadWorkflows: async () => {
    if (!window.lumina) return;
    const workflows = await window.lumina.getWorkflows();
    set({ workflows });
  },

  loadFeedItems: async (limit = 50) => {
    if (!window.lumina) return;
    const feedItems = await window.lumina.getFeedItems(limit);
    set({ feedItems });
  },

  saveWorkflow: async () => {
    if (!window.lumina) return;
    const { editingWorkflow } = get();
    if (!editingWorkflow) return null;

    set({ loading: true });
    try {
      let saved;
      if (editingWorkflow.id) {
        saved = await window.lumina.updateWorkflow(editingWorkflow.id, editingWorkflow);
      } else {
        saved = await window.lumina.createWorkflow(editingWorkflow);
      }

      await get().loadWorkflows();
      set({ editingWorkflow: saved, loading: false });
      return saved;
    } catch (err) {
      console.error('Failed to save workflow:', err);
      set({ loading: false });
      return null;
    }
  },

  deleteWorkflow: async (id) => {
    if (!window.lumina) return;
    await window.lumina.deleteWorkflow(id);
    await get().loadWorkflows();
    await get().loadFeedItems();

    const { selectedWorkflowId, editingWorkflow } = get();
    if (selectedWorkflowId === id) set({ selectedWorkflowId: null });
    if (editingWorkflow?.id === id) set({ view: 'feed', editingWorkflow: null });
  },

  toggleWorkflow: async (id) => {
    if (!window.lumina) return;
    const wf = get().workflows.find(w => w.id === id);
    if (!wf) return;
    await window.lumina.updateWorkflow(id, { active: !wf.active });
    await get().loadWorkflows();
  },

  compileSkill: async () => {
    if (!window.lumina) return;
    const { editingWorkflow } = get();
    if (!editingWorkflow?.id) {
      // Save first
      const saved = await get().saveWorkflow();
      if (!saved) return null;
    }

    set({ compiling: true });
    try {
      const result = await window.lumina.compileSkill(get().editingWorkflow.id);
      set((state) => ({
        compiling: false,
        editingWorkflow: state.editingWorkflow
          ? { ...state.editingWorkflow, skillContent: result.skillContent }
          : null,
      }));
      await get().loadWorkflows();
      return result;
    } catch (err) {
      console.error('Failed to compile skill:', err);
      set({ compiling: false });
      return null;
    }
  },

  triggerWorkflow: async (id) => {
    if (!window.lumina) return;
    set((state) => {
      const next = new Set(state.executingWorkflows);
      next.add(id);
      return { executingWorkflows: next };
    });
    try {
      const result = await window.lumina.triggerWorkflow(id);
      await get().loadFeedItems();
      return result;
    } finally {
      set((state) => {
        const next = new Set(state.executingWorkflows);
        next.delete(id);
        return { executingWorkflows: next };
      });
    }
  },

  addFeedItem: (item) => {
    set((state) => ({
      feedItems: [item, ...state.feedItems],
    }));
  },

  closeChat: () => set({ chatOpen: false }),

  // Chat scope: 'workspace' (default) | 'context_graph' | 'all'
  chatScope: 'workspace',
  chatScopesAvailable: ['workspace'],
  setChatScope: (scope) => set({ chatScope: scope }),
  refreshChatScopesAvailable: async () => {
    if (!window.lumina?.getChatScopesAvailable) return;
    try {
      const scopes = await window.lumina.getChatScopesAvailable();
      set({ chatScopesAvailable: scopes });
      // If the current scope isn't available (e.g., user picked context_graph but MCP
      // isn't running), fall back to a safe default.
      const { chatScope } = get();
      if (!scopes.includes(chatScope)) set({ chatScope: scopes[0] || 'workspace' });
    } catch {}
  },

  sendChat: async (message) => {
    if (!window.lumina) return;
    const { chatScope } = get();

    // Add user message
    set((s) => ({
      chatMessages: [...s.chatMessages, { role: 'user', content: message, scope: chatScope }],
      chatLoading: true,
      chatOpen: true,
      barState: 'conversing',
    }));

    try {
      const result = await window.lumina.sendChat(message, chatScope);
      // Add assistant message
      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          { role: 'assistant', content: result.data.answer, toolCalls: result.data.toolCalls, toolScopes: result.data.toolScopes, model: result.data.model, mode: result.data.mode, scope: result.data.scope },
        ],
      }));
      return result;
    } catch (err) {
      // Electron wraps handler errors as "Error invoking remote method 'x': Error: real
      // message" — the wrapper tells the user nothing, so show only the real message.
      const clean = String(err?.message || err)
        .replace(/^Error invoking remote method '[^']*':\s*/, '')
        .replace(/^Error:\s*/, '');
      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          { role: 'assistant', content: `**Couldn't answer that.** ${clean}` },
        ],
      }));
      throw err;
    } finally {
      set({ chatLoading: false });
    }
  },

  clearChat: () => set({ chatMessages: [] }),
}));

export default useLuminaStore;
