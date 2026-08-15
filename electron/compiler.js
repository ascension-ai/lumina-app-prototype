/**
 * Workflow → SKILL.md compiler.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  SIMPLIFIED REFERENCE IMPLEMENTATION
 *
 *  This public repository ships a reduced version of the compiler. It has the
 *  same interface and produces a structurally valid SKILL.md, but the parts
 *  that make the real one work are not included:
 *
 *    · per-source search-plan synthesis (pre-computed, operator-aware queries
 *      derived from block config rather than emitted generically)
 *    · lookback inference from cron cadence, with overlap tuned per frequency
 *    · output-schema selection driven by the source × destination matrix
 *    · the tool-guidance and rule blocks that keep execution deterministic
 *
 *  What you see below is enough to understand the shape of the idea and to
 *  run the app end to end. It is not what runs in the real build.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The idea it demonstrates: a workflow is not handed to the model as a vague
 * instruction each night. It is compiled once, ahead of time, into a runbook —
 * frontmatter, an ordered plan, and a fixed output contract — so that repeated
 * scheduled runs behave the same way instead of improvising.
 */

const { writeSkillFile } = require('./database');

const DEFAULT_LOOKBACK_DAYS = 2;

async function compileSkill(workflow) {
  const sourceBlocks = workflow.blocks.filter((b) => b.type === 'source');
  const outputBlocks = workflow.blocks.filter((b) => b.type === 'output');
  const triggerBlock = workflow.blocks.find((b) => b.type === 'trigger');

  const cron = triggerBlock?.config?.cron || workflow.cron || '0 8 * * *';
  const sources = sourceBlocks.map((b) => `${b.source}:${b.config?.target || 'all'}`);
  const outputs = outputBlocks.map((b) => b.destination);

  const skillContent = generateSkillMd({
    name: slugify(workflow.name),
    displayName: workflow.name,
    description: workflow.description || `Processes ${sources.join(', ')} and routes to ${outputs.join(', ')}.`,
    cron,
    sources,
    outputs,
    sourceBlocks,
    outputBlocks,
    instructions: workflow.instructions,
  });

  const skillPath = writeSkillFile(workflow.name, skillContent);
  return { skillContent, skillPath };
}

function generateSkillMd({ name, displayName, description, cron, sources, outputs, sourceBlocks, outputBlocks, instructions }) {
  return `---
name: ${name}
description: ${description}
cron: "${cron}"
ingestion_sources: [${sources.map((s) => `"${s}"`).join(', ')}]
output_destinations: [${outputs.map((o) => `"${o}"`).join(', ')}]
lookback_days: ${DEFAULT_LOOKBACK_DAYS}
today: "{{TODAY}}"
---

# ${displayName}

## Role
You are an executive assistant. Execute the task below reliably and consistently.

## Core Task
${(instructions || '').trim() || 'Process data from the configured sources and route the results.'}

## Search Plan
${buildSearchPlan(sourceBlocks, outputBlocks)}

## Output Format
Respond with ONLY valid JSON (no markdown wrapping).
${outputSchema(sourceBlocks, outputBlocks)}

## Rules
- Only report data actually retrieved from tools. Do not invent results.
- Always apply the lookback date to time-filterable queries.
- Skip anything already covered by a previous run.
- If nothing matches, say what was searched and that nothing was found.
`;
}

// NOTE: the real compiler derives concrete, operator-aware queries per source
// block. This emits a generic step per block instead.
function buildSearchPlan(sourceBlocks, outputBlocks) {
  const steps = [];

  sourceBlocks.forEach((src) => {
    const target = src.config?.target || 'all';
    steps.push(`${steps.length + 1}. Search \`${src.source}\` (${target}) for items after {{LOOKBACK_DATE}} that relate to the Core Task.`);
  });

  if (sourceBlocks.length) {
    steps.push(`${steps.length + 1}. Open the most relevant results in full before judging them. Snippets are not enough.`);
  }

  outputBlocks.forEach((out) => {
    steps.push(out.destination === 'todoist'
      ? `${steps.length + 1}. List existing tasks, then create one task per new action item.`
      : `${steps.length + 1}. Format the findings as structured JSON for the feed.`);
  });

  return steps.join('\n\n') || '1. No sources configured.';
}

// NOTE: the real selection matrix is richer and covers more card types.
function outputSchema(sourceBlocks, outputBlocks) {
  const has = (list, key, val) => list.some((b) => b[key] === val);

  if (has(sourceBlocks, 'source', 'meetings')) {
    return `{"type": "meetings", "data": {"meetings": [{"title": "...", "account": "...", "date": "...", "keyTakeaways": [], "nextSteps": []}], "query": "..."}}`;
  }
  if (has(outputBlocks, 'destination', 'todoist')) {
    return `{"type": "todoist", "data": {"tasks": [{"title": "...", "dueDate": "...", "priority": "high|medium|low", "done": false}]}}`;
  }
  if (has(sourceBlocks, 'source', 'notion')) {
    return `{"type": "diff", "data": {"pageName": "...", "changes": [{"type": "added|modified|deleted", "section": "...", "description": "...", "severity": "major|minor"}]}}`;
  }
  if (has(sourceBlocks, 'source', 'slack')) {
    return `{"type": "slack_summary", "data": {"urgent": [{"author": "...", "channel": "...", "message": "...", "time": "..."}], "fyi": []}}`;
  }
  return `{"type": "text", "data": {"content": "..."}}`;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = { compileSkill };
