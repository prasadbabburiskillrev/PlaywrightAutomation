// Splits a raw Figma section dump (baseline/raw/*.txt, saved from the Figma MCP
// get_figma_data tool) into one text file per page frame, grouped by flow number
// (the leading integer of the Figma frame name) and ordered by step number.
// Output is gitignored with the rest of baseline/.
//
// Usage: npm run design:split -- <program-key> <raw-file-name>
//   e.g. npm run design:split -- summit-ivonescimab section-1001-5183.2026-10-05.txt
//   or to a folder outside the programs: npm run design:split -- dyne-therapeutics <raw-file> --dir=testmeta/dyne-therapeutics
// Then run 'npm run design:convert -- <program-key>' to produce body-only JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dirFlag = args.find((a) => a.startsWith('--dir='));
const [programKey, rawName] = args.filter((a) => !a.startsWith('--'));
if (!programKey || !rawName) {
  console.error('Usage: node split-baseline.mjs <program-key> <raw-file-name> [--dir=<baseline-dir>]');
  process.exit(1);
}
const programsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'programs');
const baseline = dirFlag
  ? path.resolve(dirFlag.slice('--dir='.length))
  : path.join(programsDir, programKey, 'design-validation', 'baseline');
const lines = fs.readFileSync(path.join(baseline, 'raw', rawName), 'utf8').split('\n');

const nodesAt = lines.findIndex((l) => l === 'NODES:');
if (nodesAt < 0) throw new Error('No NODES: section in ' + rawName);
const pagesDir = path.join(baseline, 'pages');
fs.mkdirSync(pagesDir, { recursive: true });
fs.writeFileSync(path.join(pagesDir, '_shared-definitions.txt'), lines.slice(0, nodesAt).join('\n'));

const starts = [];
for (let i = nodesAt + 1; i < lines.length; i++) if (/^  \[/.test(lines[i])) starts.push(i);

const frames = starts.map((s, k) => {
  const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
  const m = lines[s].match(/^  \[(\w+)\] "([^"]*)" #(\S+)/);
  if (!m) throw new Error('Unparseable frame line: ' + lines[s].slice(0, 100));
  return { name: m[2], id: m[3], text: lines.slice(s, end).map((x) => x.replace(/^ {2}/, '')).join('\n') };
});

const key = (name) => {
  const m = name.match(/^(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), m[2] ? Number(m[2]) : 0] : [999, 0];
};
frames.sort((a, b) => {
  const x = key(a.name);
  const y = key(b.name);
  return x[0] - y[0] || x[1] - y[1] || a.id.localeCompare(b.id);
});

const index = [];
for (const f of frames) {
  const [flow, step] = key(f.name);
  const slug = f.name.replace(/^[\d.]+\s*/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dir = path.join(pagesDir, `flow-${String(flow).padStart(2, '0')}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${String(step).padStart(2, '0')}-${slug}.${f.id.replace(':', '-')}.txt`;
  fs.writeFileSync(path.join(dir, file), f.text);
  index.push({ figmaName: f.name, nodeId: f.id, file: `pages/${path.basename(dir)}/${file}` });
}
fs.writeFileSync(path.join(pagesDir, 'index.json'), JSON.stringify(index, null, 1));
console.log(`${programKey}: split ${index.length} frames`);
