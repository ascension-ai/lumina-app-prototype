#!/usr/bin/env node
/**
 * Seed a set of example workflows so a first-time user can see what Lumina does
 * without having to author anything.
 *
 * Idempotent — matches on name, so re-running never duplicates and never touches
 * workflows you created yourself. Uses the app's own database + compiler modules,
 * so seeded workflows are indistinguishable from ones built in the Studio,
 * including a compiled SKILL.md visible in the Studio's Skill tab.
 *
 *   node scripts/seed-example-workflows.mjs            # dry run — lists what it would add
 *   node scripts/seed-example-workflows.mjs --apply
 *   node scripts/seed-example-workflows.mjs --apply --replace   # overwrite same-named examples
 */
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const db = require('../electron/database.js');
const { compileSkill } = require('../electron/compiler.js');

const APPLY = process.argv.includes('--apply');
const REPLACE = process.argv.includes('--replace');

const b = (type, extra, config) => ({ id: `b-${crypto.randomUUID().slice(0, 8)}`, type, ...extra, config });

const EXAMPLES = [
  {
    name: 'Morning Meeting Digest',
    description: 'Summarises yesterday\'s customer calls and flags which accounts need attention today.',
    cron: '0 8 * * *',
    active: true,
    blocks: [
      b('trigger', {}, { cron: '0 8 * * *', label: 'Every morning at 8 AM' }),
      b('source', { source: 'meetings' }, { target: 'all', label: 'Meeting recordings' }),
      b('output', { destination: 'in-app' }, { label: 'In-App Feed' }),
    ],
    instructions:
      'Summarise the customer calls from the last day. For each one give me the account, what was ' +
      'actually decided, and anything that was promised with a date attached. Put the accounts where ' +
      'something went wrong at the top. Skip internal syncs and anything with no customer on the call.',
  },
  {
    name: 'Account Risk Radar',
    description: 'Weekly scan for accounts showing friction, ranked by how bad it looks.',
    cron: '0 9 * * 1',
    active: true,
    blocks: [
      b('trigger', {}, { cron: '0 9 * * 1', label: 'Mondays at 9 AM' }),
      b('source', { source: 'meetings' }, { target: 'all', label: 'Meeting recordings' }),
      b('output', { destination: 'in-app' }, { label: 'In-App Feed' }),
    ],
    instructions:
      'Look across last week\'s calls for accounts where things are not going well — blocked ' +
      'onboarding, unhappy stakeholders, missed timelines, pricing pushback, or a champion going ' +
      'quiet. Rank them worst first. For each, quote the specific thing that was said rather than ' +
      'summarising it away, and say what the obvious next move is. If an account looks fine, leave it out.',
  },
  {
    name: 'Unanswered Mentions',
    description: 'Hourly sweep for Slack mentions that nobody has replied to yet.',
    cron: '0 * * * *',
    active: false,
    blocks: [
      b('trigger', {}, { cron: '0 * * * *', label: 'Every hour' }),
      b('source', { source: 'slack' }, { target: 'mentions', label: 'Slack mentions' }),
      b('output', { destination: 'in-app' }, { label: 'In-App Feed' }),
    ],
    instructions:
      'Find messages where I was mentioned and no one has answered yet. Read the thread before ' +
      'deciding — if someone already handled it, drop it. Split what you find into things that ' +
      'genuinely need me to reply versus things I only need to be aware of.',
  },
  {
    name: 'Weekly Client Follow-ups',
    description: 'Turns commitments made on calls into dated Todoist tasks.',
    cron: '0 17 * * 5',
    active: true,
    blocks: [
      b('trigger', {}, { cron: '0 17 * * 5', label: 'Fridays at 5 PM' }),
      b('source', { source: 'meetings' }, { target: 'all', label: 'Meeting recordings' }),
      b('output', { destination: 'todoist' }, { label: 'Todoist' }),
    ],
    instructions:
      'Go through this week\'s calls and pull out every next step we committed to a customer — ' +
      'sending something over, scheduling something, chasing an answer internally. Make one task ' +
      'per commitment, name the account in the title, and set the due date from whatever was said ' +
      'on the call. If no date was given, make it early next week. Check existing tasks first so ' +
      'nothing gets created twice.',
  },
];

const existing = db.getAllWorkflows();
const byName = new Map(existing.map((w) => [w.name.toLowerCase(), w]));

console.log(`Existing workflows: ${existing.length}`);
existing.forEach((w) => console.log(`  keep  ${w.name}`));
console.log();

const todo = [];
for (const ex of EXAMPLES) {
  const hit = byName.get(ex.name.toLowerCase());
  if (hit && !REPLACE) console.log(`  skip  ${ex.name}  (already present)`);
  else if (hit) { console.log(`  replace  ${ex.name}`); todo.push({ ex, replacing: hit }); }
  else { console.log(`  add   ${ex.name}`); todo.push({ ex, replacing: null }); }
}

if (!APPLY) {
  console.log(`\nDry run — ${todo.length} change(s). Re-run with --apply to write.`);
  process.exit(0);
}
if (!todo.length) { console.log('\nNothing to do.'); process.exit(0); }

console.log();
for (const { ex, replacing } of todo) {
  let wf;
  if (replacing) {
    wf = db.updateWorkflow(replacing.id, ex);
  } else {
    wf = db.createWorkflow({ id: crypto.randomUUID(), ...ex });
  }
  // Compile so the Studio's Skill tab has real content, exactly as the app would.
  try {
    const { skillContent } = await compileSkill(wf);
    db.updateWorkflow(wf.id, { skillContent });
    console.log(`  ok  ${ex.name.padEnd(26)} ${ex.cron.padEnd(12)} skill ${skillContent.length}ch`);
  } catch (err) {
    console.log(`  ok  ${ex.name.padEnd(26)} ${ex.cron.padEnd(12)} (compile failed: ${err.message})`);
  }
}

console.log(`\nDone — ${db.getAllWorkflows().length} workflows total. Restart Lumina to see them.`);
