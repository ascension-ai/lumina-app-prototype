const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Load .env from parent directory
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^(\w+)=["']?(.+?)["']?$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
  console.log('[Lumina] Loaded .env file');
}

let mainWindow;
let chatAgent = null;
let appMode = 'floating'; // 'floating' | 'expanded'
let barState = 'sleeping'; // main-process mirror of renderer barState

// Dock Notch geometry. The bar is fused to the bottom edge of the work area, so every
// floating window size is bottom-anchored and horizontally centred.
//
// Asleep, the window is only as large as the tab itself — that is what makes the tab a
// real click target without having to toggle click-through per pixel, and it leaves no
// invisible strip swallowing desktop clicks. Waking resizes the window first; the
// renderer then morphs the notch inside it.
const SLEEP_WIDTH = 160;   // tab is 104 wide; the rest is room for its shadow
const SLEEP_HEIGHT = 34;   // tab is 20 tall, 26 when it swells under the cursor
const AWAKE_WIDTH = 640;   // bar is 560 wide; the rest is room for its shadow
const AWAKE_HEIGHT = 94;   // one input row (54) + shadow headroom (40) — matches METRICS in notchSkin.jsx
const MAX_FLOATING_HEIGHT = 640;
const SLEEP_SHRINK_DELAY = 460; // let the notch finish collapsing before the window follows

let sleepShrinkTimer = null;
let screenHooked = false;
let agentFailure = null;   // why the agent could not connect at boot, if it could not

// workArea (not workAreaSize) so the menu bar and Dock are accounted for on every
// display — workAreaSize alone drops the origin and pushes the window off the edge.
function getDockedBounds(width, height) {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + workArea.height - height),
    width,
    height,
  };
}

function dockFloating(width, height) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setBounds(getDockedBounds(width, height));
}

function cancelSleepShrink() {
  if (sleepShrinkTimer) { clearTimeout(sleepShrinkTimer); sleepShrinkTimer = null; }
}

function createWindow() {
  // Start as the sleeping tab, docked flush to the bottom edge.
  const bounds = getDockedBounds(SLEEP_WIDTH, SLEEP_HEIGHT);

  mainWindow = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // The sleeping window *is* the tab, so it stays interactive — hovering swells it and
  // clicking opens the bar. Click-through is only needed while a full-size bar collapses.
  mainWindow.setIgnoreMouseEvents(false);

  // Re-dock when the Dock is hidden, the menu bar changes, or the resolution moves.
  // Registered once: createWindow runs again on `activate` after all windows close.
  if (!screenHooked) {
    screenHooked = true;
    screen.on('display-metrics-changed', () => {
      if (!mainWindow || mainWindow.isDestroyed() || appMode !== 'floating') return;
      const { width, height } = mainWindow.getBounds();
      dockFloating(width, height);
    });
  }

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function setupIPC() {
  const db = require('./database');
  const { compileSkill } = require('./compiler');
  const sched = require('./scheduler');

  // Workflow CRUD
  ipcMain.handle('get-workflows', () => db.getAllWorkflows());
  ipcMain.handle('get-workflow', (_e, id) => db.getWorkflow(id));

  ipcMain.handle('create-workflow', (_e, workflow) => {
    workflow.id = workflow.id || crypto.randomUUID();
    return db.createWorkflow(workflow);
  });

  ipcMain.handle('update-workflow', (_e, id, updates) => {
    const result = db.updateWorkflow(id, updates);
    sched.loadAndScheduleAll(mainWindow);
    return result;
  });

  ipcMain.handle('delete-workflow', (_e, id) => {
    db.deleteWorkflow(id);
    sched.unscheduleWorkflow(id);
    return true;
  });

  // Feed
  ipcMain.handle('get-feed-items', (_e, limit) => db.getFeedItems(limit));
  ipcMain.handle('get-feed-items-by-workflow', (_e, workflowId, limit) => db.getFeedItemsByWorkflow(workflowId, limit));

  // Skill compilation
  ipcMain.handle('compile-skill', async (_e, workflowId) => {
    const workflow = db.getWorkflow(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const { skillContent, skillPath } = await compileSkill(workflow);
    db.updateWorkflow(workflowId, { skillContent });
    return { skillContent, skillPath };
  });

  // Trigger workflow manually
  ipcMain.handle('trigger-workflow', async (_e, workflowId) => {
    return sched.triggerWorkflow(workflowId, mainWindow);
  });

  // Refresh scheduler
  ipcMain.handle('refresh-scheduler', () => {
    sched.loadAndScheduleAll(mainWindow);
    return true;
  });

  // Window mode — wake/sleep. The window leads on the way up (it must be big enough
  // before React paints the open bar) and follows on the way down (it must not clip the
  // bar while the bar is still collapsing into it).
  ipcMain.handle('wake-window', () => {
    if (!mainWindow || appMode !== 'floating') return;
    cancelSleepShrink();
    const wasSleeping = barState === 'sleeping';
    barState = 'awake';
    mainWindow.setIgnoreMouseEvents(false);
    // Only grow from the tab. Waking an already-open bar must not throw away the height
    // the renderer asked for via resize-floating.
    if (wasSleeping) dockFloating(AWAKE_WIDTH, AWAKE_HEIGHT);
    mainWindow.focus();
    return 'awake';
  });

  ipcMain.handle('sleep-window', () => {
    if (!mainWindow || appMode !== 'floating') return;
    barState = 'sleeping';
    // Clicks pass through immediately so the collapsing bar is never in the way;
    // `forward` keeps mouse-move events flowing so hover still works.
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    cancelSleepShrink();
    sleepShrinkTimer = setTimeout(() => {
      sleepShrinkTimer = null;
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (barState !== 'sleeping' || appMode !== 'floating') return;
      dockFloating(SLEEP_WIDTH, SLEEP_HEIGHT);
      mainWindow.setIgnoreMouseEvents(false); // the tab is a click target again
    }, SLEEP_SHRINK_DELAY);
    return 'sleeping';
  });

  ipcMain.handle('expand-window', () => {
    if (!mainWindow) return;
    appMode = 'expanded';
    cancelSleepShrink();
    const { workArea } = screen.getPrimaryDisplay();
    const w = 1280, h = 820;
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(900, 600);
    mainWindow.setBounds({
      x: Math.round(workArea.x + (workArea.width - w) / 2),
      y: Math.round(workArea.y + (workArea.height - h) / 2),
      width: w,
      height: h,
    }, true);
    mainWindow.setHasShadow(true);
    return 'expanded';
  });

  ipcMain.handle('collapse-window', () => {
    if (!mainWindow) return;
    appMode = 'floating';
    barState = 'sleeping';
    cancelSleepShrink();
    mainWindow.setResizable(false);
    mainWindow.setMinimumSize(0, 0);
    dockFloating(SLEEP_WIDTH, SLEEP_HEIGHT);
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setHasShadow(false);
    mainWindow.setIgnoreMouseEvents(false); // straight back to the tab, straight back to clickable
    return 'sleeping';
  });

  // The renderer owns the bar's height and reports it here. Re-docking from scratch (as
  // opposed to nudging the current bounds) means the window cannot drift off the edge
  // over a long conversation, or after the Dock is shown or hidden mid-session.
  ipcMain.handle('resize-floating', (_e, height) => {
    if (!mainWindow || appMode !== 'floating' || barState === 'sleeping') return;
    const clamped = Math.max(AWAKE_HEIGHT, Math.min(Math.round(height) || 0, MAX_FLOATING_HEIGHT));
    dockFloating(AWAKE_WIDTH, clamped);
  });

  // Agent status. Reports what is actually true rather than merely whether a key exists —
  // a present key with a dead MCP connection is still a broken chat.
  ipcMain.handle('agent-status', () => {
    return {
      connected: !!(chatAgent && chatAgent.isReady()),
      hasKey: !!process.env.ANTHROPIC_API_KEY,
      error: agentFailure,
    };
  });

  // Chat (Anthropic-powered). `scope` selects which MCP tools the agent can call:
  //   'workspace'     — the connected MCP workspace tools. Default.
  //   'context_graph' — only Phase-1 context graph tools (cg_*). For evaluation.
  //   'all'           — both.
  ipcMain.handle('send-chat', async (_e, message, scope) => {
    if (!chatAgent || !chatAgent.isReady()) {
      const why = agentFailure
        ? `startup error: ${agentFailure}`
        : !process.env.ANTHROPIC_API_KEY
          ? 'ANTHROPIC_API_KEY was not found in ../.env'
          : 'the agent never finished connecting';
      throw new Error(`Chat agent not connected — ${why}. Lumina connects to the MCP server once at startup, so if it came up later, restart Lumina.`);
    }

    if (mainWindow) {
      mainWindow.webContents.send('chat-thinking', { message });
    }

    const { answer, toolCalls, toolScopes, model, mode, scope: resolvedScope } = await chatAgent.sendMessage(message, (toolName) => {
      if (mainWindow) {
        mainWindow.webContents.send('tool-call', { toolName });
      }
    }, scope);

    return { data: { question: message, answer, toolCalls, toolScopes, model, mode, scope: resolvedScope } };
  });

  // Which scopes are actually usable right now. Renderer uses this to enable/
  // disable the 'Context Graph' option in the dropdown.
  ipcMain.handle('chat-scopes-available', () => {
    if (!chatAgent || !chatAgent.isReady()) return ['workspace'];
    return chatAgent.getScopesAvailable();
  });
}

function seedSampleData() {
  const db = require('./database');

  const existing = db.getAllWorkflows();
  if (existing.length > 0) return;

  console.log('[Lumina] Seeding sample data...');

  const wf1Id = crypto.randomUUID();
  const wf2Id = crypto.randomUUID();

  db.createWorkflow({
    id: wf1Id,
    name: 'Slack Follow-up Tracker',
    description: 'Scans Slack for forgotten follow-ups and routes them to Todoist with inferred due dates.',
    cron: '0 23 * * *',
    active: true,
    blocks: [
      { id: 'b1', type: 'trigger', config: { cron: '0 23 * * *', label: 'Every night at 11 PM' } },
      { id: 'b2', type: 'source', source: 'slack', config: { target: 'mentions', label: 'Slack mentions' } },
      { id: 'b3', type: 'output', destination: 'todoist', config: { label: 'Todoist' } },
    ],
    instructions: `I get tagged to get back to people, and sometimes I tell people I'll get back but forget. Find messages where I was mentioned or where I made commitments like "I'll get back", "will check", "on it". Create Todoist tasks for unresolved follow-ups with the right due dates.`,
    skillContent: '',
  });

  db.createWorkflow({
    id: wf2Id,
    name: 'Notion Change Monitor',
    description: 'Monitors Engineering Docs for major changes and alerts in-app.',
    cron: '0 8 * * *',
    active: true,
    blocks: [
      { id: 'b4', type: 'trigger', config: { cron: '0 8 * * *', label: 'Every morning at 8 AM' } },
      { id: 'b5', type: 'source', source: 'notion', config: { target: 'Engineering Docs', label: 'Engineering Docs' } },
      { id: 'b6', type: 'output', destination: 'in-app', config: { label: 'In-App Feed' } },
    ],
    instructions: `Find changes to the 'Engineering Docs' page and remind me whenever there is a major change in this set of pages and subpages. Ignore minor typos and formatting changes.`,
    skillContent: '',
  });

  console.log('[Lumina] Sample data seeded.');
}

app.whenReady().then(async () => {
  setupIPC();
  seedSampleData();
  createWindow();

  const sched = require('./scheduler');

  // Initialize MeetingsSearch (local, no MCP dependency)
  const { MeetingsSearch } = require('./meetingsSearch');
  let meetingsSearch = null;
  try {
    const meetingsDataDir = path.join(__dirname, '..', '..', 'meetings_data');
    meetingsSearch = new MeetingsSearch(meetingsDataDir);
    console.log(`[Lumina] MeetingsSearch loaded: ${meetingsSearch.messageCount} meetings`);
  } catch (err) {
    console.warn('[Lumina] MeetingsSearch failed to load:', err.message);
  }

  // Initialize the real agent
  const { LuminaAgent } = require('./agent');
  const agent = new LuminaAgent();

  try {
    await agent.connect();
    if (meetingsSearch) agent.setMeetingsSearch(meetingsSearch);
    sched.setAgent(agent);
    console.log('[Lumina] Agent connected successfully');
    if (mainWindow) {
      mainWindow.webContents.send('agent-status', { connected: true });
    }

    // Initialize ChatAgent — shares MCP client from LuminaAgent
    const { ChatAgent } = require('./chatAgent');
    chatAgent = new ChatAgent();
    chatAgent.connect(agent._mcpClient, agent._tools, meetingsSearch);
    console.log('[Lumina] ChatAgent (Haiku) connected');
  } catch (err) {
    agentFailure = err.message || String(err);
    console.warn('[Lumina] Agent connection failed:', err.message);
    console.warn('[Lumina] Workflows will use simulated execution. Set ANTHROPIC_API_KEY to enable real execution.');
    if (mainWindow) {
      mainWindow.webContents.send('agent-status', { connected: false, error: err.message });
    }
  }

  // Register global shortcut: Option+Space to toggle wake/sleep.
  // Notification only — the renderer owns the decision and calls wake-window /
  // sleep-window, which are the only places allowed to move the window. Setting
  // barState here would make wake-window think the bar was already awake and skip
  // resizing the window out of its tab-sized bounds.
  globalShortcut.register('Alt+Space', () => {
    if (!mainWindow) return;
    mainWindow.webContents.send('toggle-wake');
  });

  sched.startScheduler(mainWindow);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
