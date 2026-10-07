#!/usr/bin/env node
// track-tokens — manual start/stop token accounting per task.
// Reads real usage numbers from the active Claude Code session transcript
// (JSONL) — never estimates. Same technique as caveman-stats: sum the
// `usage` block on each assistant entry.
//
// Usage:
//   node token_tracker.js start "<task name>"
//   node token_tracker.js status
//   node token_tracker.js end
//   node token_tracker.js report [--today|--all|--since Nd|Nh]

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const STATE_DIR = path.join(CLAUDE_DIR, 'task-tracking');
const ACTIVE_PATH = path.join(STATE_DIR, 'active.json');
const LOG_PATH = path.join(STATE_DIR, 'log.jsonl');

// USD per million tokens. Match by model-id prefix (checked in order, first
// match wins). Update if pricing changes.
const PRICING = [
  ['claude-fable-5',    { input: 10.00, output: 50.00 }],
  ['claude-mythos-5',   { input: 10.00, output: 50.00 }],
  ['claude-opus-5',     { input: 5.00,  output: 25.00 }],
  ['claude-sonnet-5',   { input: 3.00,  output: 15.00 }],
  ['claude-opus-4',     { input: 5.00,  output: 25.00 }],
  ['claude-sonnet-4',   { input: 3.00,  output: 15.00 }],
  ['claude-haiku-4',    { input: 1.00,  output: 5.00  }],
  ['claude-3-5-sonnet', { input: 3.00,  output: 15.00 }],
  ['claude-3-5-haiku',  { input: 1.00,  output: 4.00  }],
  ['claude-3-opus',     { input: 15.00, output: 75.00 }],
];

function priceForModel(model) {
  if (!model) return null;
  for (const [prefix, price] of PRICING) {
    if (model.startsWith(prefix)) return price;
  }
  return null;
}

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function findRecentSession() {
  const projectsDir = path.join(CLAUDE_DIR, 'projects');
  let entries;
  try { entries = fs.readdirSync(projectsDir, { withFileTypes: true }); }
  catch { return null; }

  let best = null;
  const stack = entries.map(e => path.join(projectsDir, e.name));
  while (stack.length) {
    const p = stack.pop();
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      try { for (const child of fs.readdirSync(p)) stack.push(path.join(p, child)); }
      catch {}
    } else if (p.endsWith('.jsonl') && (!best || st.mtimeMs > best.mtime)) {
      best = { file: p, mtime: st.mtimeMs };
    }
  }
  return best ? best.file : null;
}

// Sum every assistant `usage` block in the transcript. Returns cumulative
// totals — callers diff two snapshots to get a task's delta.
function parseSession(filePath) {
  const totals = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, turns: 0, model: null };
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch { return totals; }

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== 'assistant' || !entry.message) continue;
    const usage = entry.message.usage;
    if (!usage) continue;
    totals.input       += usage.input_tokens              || 0;
    totals.output      += usage.output_tokens             || 0;
    totals.cacheRead    += usage.cache_read_input_tokens   || 0;
    totals.cacheCreate  += usage.cache_creation_input_tokens || 0;
    totals.turns++;
    if (!totals.model && entry.message.model) totals.model = entry.message.model;
  }
  return totals;
}

function currentBranch() {
  try { return execSync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return null; }
}

function diffTotals(end, start) {
  return {
    input: end.input - start.input,
    output: end.output - start.output,
    cacheRead: end.cacheRead - start.cacheRead,
    cacheCreate: end.cacheCreate - start.cacheCreate,
  };
}

function totalOf(d) { return d.input + d.output + d.cacheRead + d.cacheCreate; }

function estUsd(d, model) {
  const price = priceForModel(model);
  if (!price) return null;
  // Cache rates are multiples of the model's own input price (Anthropic-wide,
  // not model-specific): reads ~0.1x, writes 1.25x for the default 5-minute
  // TTL (2x for 1h TTL — not distinguishable from the transcript, so this
  // assumes 5m). Previously this function ignored cache tokens entirely,
  // which understates cost badly on any cache-heavy session.
  const cacheReadRate = price.input * 0.1;
  const cacheWriteRate = price.input * 1.25;
  return (
    d.input * price.input +
    d.output * price.output +
    d.cacheRead * cacheReadRate +
    d.cacheCreate * cacheWriteRate
  ) / 1_000_000;
}

function fmtUsd(n) {
  if (n == null) return 'n/a';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function cmdStart(name) {
  if (!name) { console.error('usage: token_tracker.js start "<task name>"'); process.exit(2); }
  ensureStateDir();
  if (fs.existsSync(ACTIVE_PATH)) {
    const active = JSON.parse(fs.readFileSync(ACTIVE_PATH, 'utf8'));
    console.error(`task already active: "${active.name}" (started ${active.startedAt}). Run 'end' first.`);
    process.exit(1);
  }
  const sessionFile = findRecentSession();
  if (!sessionFile) { console.error('no Claude Code session found.'); process.exit(1); }
  const baseline = parseSession(sessionFile);
  const state = {
    name,
    sessionFile,
    branch: currentBranch(),
    startedAt: new Date().toISOString(),
    baseline,
  };
  fs.writeFileSync(ACTIVE_PATH, JSON.stringify(state, null, 2));
  console.log(`task started: "${name}"${state.branch ? ` (branch ${state.branch})` : ''}`);
}

function loadActive() {
  if (!fs.existsSync(ACTIVE_PATH)) { console.error('no active task. Run: start "<task name>"'); process.exit(1); }
  return JSON.parse(fs.readFileSync(ACTIVE_PATH, 'utf8'));
}

function cmdStatus() {
  const active = loadActive();
  const end = parseSession(active.sessionFile);
  const d = diffTotals(end, active.baseline);
  const model = end.model || active.baseline.model;
  const usd = estUsd(d, model);
  console.log(`active: "${active.name}" since ${active.startedAt}`);
  console.log(`  input=${d.input} output=${d.output} cacheRead=${d.cacheRead} cacheCreate=${d.cacheCreate} total=${totalOf(d)} est=${fmtUsd(usd)}`);
}

function cmdEnd() {
  const active = loadActive();
  const end = parseSession(active.sessionFile);
  const d = diffTotals(end, active.baseline);
  const model = end.model || active.baseline.model;
  const usd = estUsd(d, model);
  const record = {
    ts: Date.now(),
    name: active.name,
    branch: active.branch,
    sessionFile: active.sessionFile,
    startedAt: active.startedAt,
    endedAt: new Date().toISOString(),
    model,
    input_tokens: d.input,
    output_tokens: d.output,
    cache_read_tokens: d.cacheRead,
    cache_creation_tokens: d.cacheCreate,
    total_tokens: totalOf(d),
    est_usd: usd,
  };
  ensureStateDir();
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n');
  fs.unlinkSync(ACTIVE_PATH);
  console.log(`task ended: "${active.name}"`);
  console.log(`  total=${record.total_tokens} (in=${record.input_tokens} out=${record.output_tokens} cacheRead=${record.cache_read_tokens} cacheCreate=${record.cache_creation_tokens}) est=${fmtUsd(usd)}`);
}

function parseDuration(spec) {
  if (!spec) return null;
  const m = /^(\d+)([dh])$/.exec(spec.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return m[2] === 'd' ? n * 86_400_000 : n * 3_600_000;
}

function readLog() {
  let raw;
  try { raw = fs.readFileSync(LOG_PATH, 'utf8'); } catch { return []; }
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

function cmdReport(args) {
  const all = args.includes('--all');
  const today = args.includes('--today');
  const sinceIdx = args.indexOf('--since');
  const sinceArg = sinceIdx !== -1 ? args[sinceIdx + 1] : null;

  let rows = readLog();
  if (!all) {
    let cutoff = null;
    if (today) {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      cutoff = d.getTime();
    } else if (sinceArg) {
      const ms = parseDuration(sinceArg);
      if (ms === null) { console.error(`--since takes Nh or Nd, got: ${sinceArg}`); process.exit(2); }
      cutoff = Date.now() - ms;
    }
    if (cutoff !== null) rows = rows.filter(r => r.ts >= cutoff);
  }

  if (rows.length === 0) { console.log('no completed tasks logged for this window.'); return; }

  const byTask = new Map();
  for (const r of rows) {
    const key = r.name;
    const prev = byTask.get(key) || { name: r.name, branch: r.branch, total: 0, input: 0, output: 0, usd: 0, hasUsd: false, runs: 0 };
    prev.total += r.total_tokens || 0;
    prev.input += r.input_tokens || 0;
    prev.output += r.output_tokens || 0;
    if (r.est_usd != null) { prev.usd += r.est_usd; prev.hasUsd = true; }
    prev.runs += 1;
    byTask.set(key, prev);
  }

  const list = Array.from(byTask.values()).sort((a, b) => b.total - a.total);
  const grandTotal = list.reduce((s, r) => s + r.total, 0);
  const anyUsd = list.some(r => r.hasUsd);
  const grandUsd = list.reduce((s, r) => s + r.usd, 0);

  console.log('');
  console.log('Task                              Branch          Runs   Input    Output   Total     Est USD');
  console.log('─'.repeat(96));
  for (const r of list) {
    console.log(
      `${r.name.slice(0, 34).padEnd(34)} ${(r.branch || '-').slice(0, 14).padEnd(14)} ${String(r.runs).padStart(4)}   ${String(r.input).padStart(6)}   ${String(r.output).padStart(6)}   ${String(r.total).padStart(7)}   ${r.hasUsd ? fmtUsd(r.usd) : 'n/a'}`
    );
  }
  console.log('─'.repeat(96));
  console.log(`TOTAL: ${grandTotal.toLocaleString()} tokens, est ${anyUsd ? fmtUsd(grandUsd) : 'n/a'}`);
  console.log('');
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'start': return cmdStart(rest.join(' '));
    case 'status': return cmdStatus();
    case 'end': return cmdEnd();
    case 'report': return cmdReport(rest);
    default:
      console.error('usage: token_tracker.js <start "<name>"|status|end|report [--today|--all|--since Nd]>');
      process.exit(2);
  }
}

main();
