#!/usr/bin/env node
/**
 * Shift the Lumina demo dataset forward so its newest record lands on today.
 *
 * The corpus (Slack meeting summaries + the local feed/workflow DB) is a frozen
 * snapshot. As real time moves on, every "last week / last month" query stops
 * matching anything. This re-bases both datasets, preserving relative spacing so
 * the shape of the history is unchanged — only the origin moves.
 *
 * Each dataset gets its own whole-day delta, computed so its own newest record
 * lands exactly on today. Whole days keep time-of-day and weekday-vs-clock
 * alignment intact (IST has no DST, so the epoch shift is exact).
 *
 *   node scripts/shift-demo-dates.mjs                 # dry run — prints the plan
 *   node scripts/shift-demo-dates.mjs --apply         # write the changes
 *   node scripts/shift-demo-dates.mjs --apply --reset-last-run
 *
 *   --db=PATH         default ~/.lumina/db.json
 *   --meetings=DIR    default ../meetings_data
 *   --reset-last-run  drop the workflow `last_run` memory instead of shifting it,
 *                     so the next run re-processes history rather than deduping
 *                     everything away.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (k, d) => (argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=').slice(1).join('=');

const APPLY = has('--apply');
// --feed-within=N : ignore the shift logic and redistribute feed items across the
// last N minutes, newest first. For demos, where "13h ago" reads as stale but
// "15m ago" reads as a system that is actually running.
const FEED_WITHIN = argv.some((a) => a.startsWith('--feed-within'))
  ? Number(val('feed-within', 90)) || 90
  : null;
const RESET_LAST_RUN = has('--reset-last-run');
const DB_PATH = val('db', path.join(os.homedir(), '.lumina', 'db.json'));
const MEET_DIR = val('meetings', path.resolve(process.cwd(), '..', 'meetings_data'));

const DAY = 86400000;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const todayUTC = () => { const n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); };
const dayOf = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

// ── shifters — each preserves its input's exact format ──────────────────
const shiftIso = (s, days) => new Date(Date.parse(s) + days * DAY).toISOString();

const shiftNaive = (s, days) => {           // "2026-04-15 17:18:20"
  const [d, t = ''] = s.split(' ');
  const [y, mo, da] = d.split('-').map(Number);
  const n = new Date(Date.UTC(y, mo - 1, da) + days * DAY);
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getUTCFullYear()}-${p(n.getUTCMonth() + 1)}-${p(n.getUTCDate())}${t ? ' ' + t : ''}`;
};

const shiftEpoch = (s, days) => {           // "1776253700.674089" — keep precision
  const dec = String(s).includes('.') ? String(s).split('.')[1].length : 0;
  return (parseFloat(s) + days * 86400).toFixed(dec);
};

// "*Date*: Wed, Apr 15, 2026 05:00 PM IST" — weekday must be recomputed
const RE_DATE_LINE = /(\*Date\*:\s*)([A-Za-z]{3}), ([A-Za-z]{3}) (\d{1,2}), (\d{4})/g;
const shiftDateLines = (text, days) =>
  text.replace(RE_DATE_LINE, (m, head, _dow, mon, da, yr) => {
    const mi = MONTHS.indexOf(mon);
    if (mi < 0) return m;                                   // unknown month — leave alone
    const n = new Date(Date.UTC(+yr, mi, +da) + days * DAY);
    return `${head}${DOW[n.getUTCDay()]}, ${MONTHS[n.getUTCMonth()]} ${n.getUTCDate()}, ${n.getUTCFullYear()}`;
  });

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf-8');

// ── 1. ~/.lumina/db.json ────────────────────────────────────────────────
function planDb() {
  if (!fs.existsSync(DB_PATH)) return { skip: `no db at ${DB_PATH}` };
  const db = readJson(DB_PATH);
  const stamps = [
    ...(db.workflows || []).flatMap((w) => [w.createdAt, w.updatedAt]),
    ...(db.feedItems || []).map((f) => f.createdAt),
    ...(db.memory || []).flatMap((m) => [m.createdAt, typeof m.value === 'string' ? m.value : null]),
  ].filter((s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s));
  if (!stamps.length) return { skip: 'no timestamps found' };

  const newest = Math.max(...stamps.map(Date.parse));
  const days = Math.round((todayUTC() - dayOf(newest)) / DAY);
  return { db, days, newest: new Date(newest).toISOString().slice(0, 10), count: stamps.length };
}

function applyDb({ db, days }) {
  const s = (v) => shiftIso(v, days);
  for (const w of db.workflows || []) { if (w.createdAt) w.createdAt = s(w.createdAt); if (w.updatedAt) w.updatedAt = s(w.updatedAt); }
  for (const f of db.feedItems || []) { if (f.createdAt) f.createdAt = s(f.createdAt); }
  if (RESET_LAST_RUN) {
    db.memory = (db.memory || []).filter((m) => m.key !== 'last_run');
  } else {
    for (const m of db.memory || []) {
      if (m.createdAt) m.createdAt = s(m.createdAt);
      if (typeof m.value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(m.value)) m.value = s(m.value);
    }
  }
  writeJson(DB_PATH, db);
}

// ── 2. meetings_data ────────────────────────────────────────────────────
function planMeetings() {
  if (!fs.existsSync(MEET_DIR)) return { skip: `no dir at ${MEET_DIR}` };
  const files = fs.readdirSync(MEET_DIR).filter((f) => f.startsWith('olivbot-') && f.endsWith('.json'));
  if (!files.length) return { skip: 'no olivbot-*.json' };

  let newest = 0, msgs = 0;
  for (const f of files) {
    for (const m of readJson(path.join(MEET_DIR, f)).messages || []) {
      msgs++;
      const t = parseFloat(m.ts) * 1000;
      if (!isNaN(t) && t > newest) newest = t;
    }
  }
  const days = Math.round((todayUTC() - dayOf(newest)) / DAY);
  return { files, days, msgs, newest: new Date(newest).toISOString().slice(0, 10) };
}

function applyMeetings({ files, days }) {
  for (const f of files) {
    const p = path.join(MEET_DIR, f);
    const d = readJson(p);
    if (d.last_synced) d.last_synced = shiftNaive(d.last_synced, days);
    if (d.date_range) {
      if (d.date_range.oldest) d.date_range.oldest = shiftNaive(d.date_range.oldest, days);
      if (d.date_range.newest) d.date_range.newest = shiftNaive(d.date_range.newest, days);
    }
    for (const m of d.messages || []) {
      if (m.ts) m.ts = shiftEpoch(m.ts, days);
      if (m.thread_ts) m.thread_ts = shiftEpoch(m.thread_ts, days);
      if (m.date) m.date = shiftNaive(m.date, days);
      if (m.text) m.text = shiftDateLines(m.text, days);
    }
    writeJson(p, d);
  }
  const sp = path.join(MEET_DIR, 'sync-state.json');
  if (fs.existsSync(sp)) {
    const st = readJson(sp);
    for (const ch of Object.values(st)) {
      if (ch && typeof ch === 'object') {
        if (ch.last_ts) ch.last_ts = shiftEpoch(ch.last_ts, days);
        if (ch.last_synced) ch.last_synced = shiftNaive(ch.last_synced, days);
      }
    }
    writeJson(sp, st);
  }
}

// ── feed-within mode ────────────────────────────────────────────────────
// Offsets curve outward (i^1.4) so the newest few cluster tightly at "just now"
// and older ones spread out — the shape real activity has, not an even ladder.
function applyFeedWithin(minutes) {
  const db = readJson(DB_PATH);
  const items = (db.feedItems || []).slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!items.length) { console.log('  no feed items'); return; }

  const now = Date.now();
  const n = items.length;
  let prev = -1;
  items.forEach((item, i) => {
    const frac = n === 1 ? 0 : i / (n - 1);
    let off = Math.round(minutes * Math.pow(frac, 1.4));
    if (off <= prev) off = prev + 1;                 // keep strictly ordered
    prev = off;
    item.createdAt = new Date(now - off * 60000).toISOString();
  });
  writeJson(DB_PATH, db);
  console.log(`  re-dated ${n} feed items across the last ${minutes} minutes:`);
  console.log('    ' + items.map((it, i) => {
    const m = Math.round((now - Date.parse(it.createdAt)) / 60000);
    return m === 0 ? 'just now' : `${m}m`;
  }).join(', '));
}

// ── run ─────────────────────────────────────────────────────────────────
if (FEED_WITHIN !== null) {
  console.log(`Feed items -> spread across the last ${FEED_WITHIN} minutes\n`);
  if (!APPLY) {
    const db = readJson(DB_PATH);
    console.log(`  ${(db.feedItems || []).length} feed items would be re-dated.`);
    console.log('\nDry run. Re-run with --apply to write.');
  } else {
    applyFeedWithin(FEED_WITHIN);
    console.log('\nDone. Restart Lumina (or reopen the app) to see it.');
  }
  process.exit(0);
}

const today = new Date(todayUTC()).toISOString().slice(0, 10);
console.log(`Target: newest record of each dataset lands on ${today}\n`);

const dbPlan = planDb();
const mPlan = planMeetings();

for (const [label, p, extra] of [
  ['db.json  ', dbPlan, () => `${dbPlan.count} timestamps`],
  ['meetings ', mPlan, () => `${mPlan.files.length} files, ${mPlan.msgs} messages`],
]) {
  if (p.skip) { console.log(`  ${label} SKIP — ${p.skip}`); continue; }
  console.log(`  ${label} newest ${p.newest}  ->  shift +${p.days}d  (${extra()})`);
  if (p.days < 0) console.log(`  ${label} REFUSING: newest is in the future — already shifted?`);
  if (p.days === 0) console.log(`  ${label} already current, nothing to do`);
}

if (!APPLY) { console.log('\nDry run. Re-run with --apply to write.'); process.exit(0); }

const bad = [dbPlan, mPlan].some((p) => !p.skip && p.days < 0);
if (bad) { console.error('\nAborted: a dataset is already ahead of today.'); process.exit(1); }

if (!dbPlan.skip && dbPlan.days > 0) { applyDb(dbPlan); console.log(`\n  wrote ${DB_PATH}`); }
if (!mPlan.skip && mPlan.days > 0) { applyMeetings(mPlan); console.log(`  wrote ${mPlan.files.length + 1} files in ${MEET_DIR}`); }
if (RESET_LAST_RUN) console.log('  last_run memory cleared');
console.log('\nDone.');
