const path = require('path');
const os = require('os');
const fs = require('fs');

const LUMINA_DIR = path.join(os.homedir(), '.lumina');
const SKILLS_DIR = path.join(LUMINA_DIR, 'skills');
const DB_PATH = path.join(LUMINA_DIR, 'db.json');

// Ensure directories exist
if (!fs.existsSync(LUMINA_DIR)) fs.mkdirSync(LUMINA_DIR, { recursive: true });
if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });

// Simple JSON-file database (fast enough for a desktop app with small data)
let data = { workflows: [], feedItems: [], memory: [] };

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      data = JSON.parse(raw);
      if (!data.workflows) data.workflows = [];
      if (!data.feedItems) data.feedItems = [];
      if (!data.memory) data.memory = [];
    }
  } catch {
    data = { workflows: [], feedItems: [], memory: [] };
  }
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Initialize
loadDb();

// Workflow CRUD
function getAllWorkflows() {
  return data.workflows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function getWorkflow(id) {
  return data.workflows.find((w) => w.id === id) || null;
}

function createWorkflow(workflow) {
  const now = new Date().toISOString();
  const record = {
    id: workflow.id,
    name: workflow.name || 'Untitled',
    description: workflow.description || '',
    cron: workflow.cron || '',
    active: !!workflow.active,
    blocks: workflow.blocks || [],
    instructions: workflow.instructions || '',
    skillContent: workflow.skillContent || '',
    createdAt: now,
    updatedAt: now,
  };
  data.workflows.push(record);
  saveDb();
  return { ...record };
}

function updateWorkflow(id, updates) {
  const idx = data.workflows.findIndex((w) => w.id === id);
  if (idx === -1) return null;

  const wf = data.workflows[idx];
  if (updates.name !== undefined) wf.name = updates.name;
  if (updates.description !== undefined) wf.description = updates.description;
  if (updates.cron !== undefined) wf.cron = updates.cron;
  if (updates.active !== undefined) wf.active = !!updates.active;
  if (updates.blocks !== undefined) wf.blocks = updates.blocks;
  if (updates.instructions !== undefined) wf.instructions = updates.instructions;
  if (updates.skillContent !== undefined) wf.skillContent = updates.skillContent;
  wf.updatedAt = new Date().toISOString();

  data.workflows[idx] = wf;
  saveDb();
  return { ...wf };
}

function deleteWorkflow(id) {
  data.workflows = data.workflows.filter((w) => w.id !== id);
  data.feedItems = data.feedItems.filter((f) => f.workflowId !== id);
  saveDb();
}

// Feed item CRUD
function getFeedItems(limit = 50) {
  return data.feedItems
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, limit);
}

function getFeedItemsByWorkflow(workflowId, limit = 20) {
  return data.feedItems
    .filter((f) => f.workflowId === workflowId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, limit);
}

function createFeedItem(item) {
  const record = {
    id: item.id,
    workflowId: item.workflowId,
    workflowName: item.workflowName || '',
    type: item.type,
    data: item.data || {},
    createdAt: new Date().toISOString(),
  };
  data.feedItems.push(record);
  saveDb();
  return { ...record };
}

// Memory CRUD
function getMemory(workflowId, key) {
  return data.memory.find((m) => m.workflowId === workflowId && m.key === key) || null;
}

function setMemory(workflowId, key, value) {
  const idx = data.memory.findIndex((m) => m.workflowId === workflowId && m.key === key);
  const record = {
    id: require('crypto').randomUUID(),
    workflowId,
    key,
    value,
    createdAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    data.memory[idx] = record;
  } else {
    data.memory.push(record);
  }
  saveDb();
}

// Skill file management
function writeSkillFile(workflowName, content) {
  const slug = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const skillDir = path.join(SKILLS_DIR, slug);
  if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
  const skillPath = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(skillPath, content, 'utf-8');
  return skillPath;
}

function readSkillFile(workflowName) {
  const slug = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const skillPath = path.join(SKILLS_DIR, slug, 'SKILL.md');
  if (fs.existsSync(skillPath)) return fs.readFileSync(skillPath, 'utf-8');
  return null;
}

module.exports = {
  getAllWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getFeedItems,
  getFeedItemsByWorkflow,
  createFeedItem,
  getMemory,
  setMemory,
  writeSkillFile,
  readSkillFile,
  LUMINA_DIR,
  SKILLS_DIR,
};
