// Runs a program's design specs and writes a Word (.docx) report for the story.
//
//   npm run design:report -- <program-key>             run the design specs, then build the report
//   npm run design:report -- <program-key> --no-run    rebuild from the last saved run
//   npm run design:report -- <program-key> --story=<id> run only the specs whose title carries
//                                                       US-<id>, and tag the report with it
//
// Output: design-report/<program-key>-design-report.docx (gitignored) and the raw Playwright
// JSON next to it. No program knowledge here; everything comes from the Playwright results and
// the spec files themselves (the "Figma "<name>" (node <id>)" comment, if the spec has one).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';

const [programKey, ...rawFlags] = process.argv.slice(2);
const flags = rawFlags.filter((f) => f !== '--'); // tolerate an extra "--" typed after npm's own
if (!programKey) {
  console.error('Usage: npm run design:report -- <program-key> [--story=<id>] [--no-run]');
  process.exit(1);
}

// A story id (digits, optionally typed as US-123 / US123) selects specs titled "US-<id>...".
const storyFlag = flags.find((f) => f.startsWith('--story='));
const storyId = storyFlag?.slice('--story='.length).replace(/^US-?/i, '');
if (storyFlag && !/^\d+$/.test(storyId ?? '')) {
  console.error('--story must be a numeric user story id, e.g. --story=280439');
  process.exit(1);
}
const suffix = storyId ? `${programKey}-US-${storyId}` : programKey;
const outDir = path.resolve('design-report');
const jsonPath = path.join(outDir, `${suffix}-design-results.json`);
const docxPath = path.join(outDir, `${suffix}-design-report.docx`);
fs.mkdirSync(outDir, { recursive: true });

if (!flags.includes('--no-run')) {
  // Exit code 1 just means some checks failed; the report is still wanted.
  const run = spawnSync('npx', ['playwright', 'test', `--project=${programKey}-design`, '--reporter=json', ...(storyId ? [`--grep=US-${storyId}`] : [])], {
    shell: true,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: process.env,
  });
  const start = run.stdout?.search(/^\{\r?$/m) ?? -1; // dotenv may print a banner first
  if (start < 0) {
    console.error(run.stdout || '', run.stderr || '');
    console.error('Playwright did not produce a JSON result; no report written.');
    process.exit(1);
  }
  fs.writeFileSync(jsonPath, run.stdout.slice(start));
} else if (!fs.existsSync(jsonPath)) {
  console.error(`No saved run at ${jsonPath}; run without --no-run first.`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

// Flatten suites -> one entry per spec file. Each test carries its recorded design checks
// (see designCheck.ts) and its pass/fail status.
const files = [];
const walk = (suite, file, titles) => {
  const here = suite.title ? [...titles, suite.title] : titles;
  for (const spec of suite.specs ?? []) {
    const test = spec.tests?.[0];
    const last = test?.results?.at(-1);
    let entry = files.find((f) => f.file === file);
    if (!entry) files.push((entry = { file, describe: here[0] ?? file, tests: [] }));
    const records = (test?.annotations ?? [])
      .filter((a) => a.type === 'design-check')
      .map((a) => JSON.parse(a.description));
    entry.tests.push({
      title: spec.title,
      status: test?.status === 'skipped' ? 'skipped' : spec.ok ? 'passed' : 'failed',
      error: stripAnsi(last?.error?.message).split('\n').filter((l) => l.trim()).slice(0, 4).join(' / '),
      records,
    });
  }
  for (const child of suite.suites ?? []) walk(child, file, here);
};
// A top-level suite is the spec file itself; its children are the describe blocks.
for (const top of results.suites ?? []) {
  for (const spec of top.specs ?? []) walk({ specs: [spec] }, top.file ?? top.title, []);
  for (const child of top.suites ?? []) walk(child, top.file ?? top.title, []);
}

const tests = files.flatMap((f) => f.tests);
const records = tests.flatMap((t) => t.records);
const beyond = records.filter((r) => r.status === 'beyond');
const within = records.filter((r) => r.status === 'within');
// Failures that did not come from a recorded comparison (timeouts, missing elements, copy checks).
const otherFailed = tests.filter((t) => t.status === 'failed' && !t.records.some((r) => r.status === 'beyond'));
const failedCount = tests.filter((t) => t.status === 'failed').length;
const baseURL = results.config?.projects?.find((p) => p.name === `${programKey}-design`)?.use?.baseURL ?? '';
const date = new Date().toISOString().slice(0, 10);
// Every `Figma "<name>" (node <id>)` comment in a spec is a frame it compares against.
const figmaFrames = files.flatMap((f) => {
  const src = [f.file, path.join(results.config?.rootDir ?? '', f.file)].find((x) => fs.existsSync(x));
  if (!src) return [];
  return [...fs.readFileSync(src, 'utf8').matchAll(/Figma\s+"([^"]+)"\s*\(node\s+([\d:-]+)\)/g)].map(
    (m) => `"${m[1]}" (node ${m[2]})`,
  );
});

// ---- docx helpers ----
const FONT = 'Calibri';
const p = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, font: FONT, ...opts })], spacing: { after: 120 } });
const h1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (text, { bold = false, fill, width } = {}) =>
  new TableCell({
    borders,
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text).split('\n').map((line) => new Paragraph({ children: [new TextRun({ text: line, bold, font: FONT, size: 20 })] })),
  });
// widths: percentage per column; header row is shaded and bold.
const table = (header, rows, widths) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((c, i) => cell(c, { bold: true, fill: 'E7ECF4', width: widths[i] })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { width: widths[i] })) })),
    ],
  });
// Same element on consecutive rows is shown once, on the first row ("Checked values" layout).
const groupedRows = (list, cols) => {
  let last = null;
  return list.map((r) => {
    const first = r.element !== last;
    last = r.element;
    return [first ? r.element : '', ...cols.map((c) => r[c])];
  });
};

const verdict = beyond.length || otherFailed.length
  ? `${beyond.length} difference(s) are outside the agreed tolerances${otherFailed.length ? `; ${otherFailed.length} check(s) failed without a recorded value (see "Other failed checks")` : ''}.`
  : 'The live page matches the Figma design. No value is outside the agreed tolerances.';

const children = [
  new Paragraph({ text: 'Design validation report', heading: HeadingLevel.TITLE }),
  p(`${programKey}${storyId ? ` — User Story ${storyId}` : ''}`, { bold: true }),
  table(['Item', 'Detail'], [
    ['Program', programKey],
    ...(storyId ? [['User story', storyId]] : []),
    ...(figmaFrames.length ? [[figmaFrames.length > 1 ? 'Figma frames' : 'Figma frame', figmaFrames.join('\n')]] : []),
    ...(baseURL ? [['Live base URL', baseURL]] : []),
    ['Resolution checked', '1920 × 1080 (the Figma frame size, so values are compared exactly)'],
    ['Scope', 'Page body only (sidebar, header and footer excluded unless the story includes them)'],
    ['Date', date],
    ['Automated checks', `${tests.length - failedCount} of ${tests.length} passed`],
  ], [25, 75]),
  h1('Result'),
  p(verdict),
  p('Agreed tolerances: font size ±2px; padding / margin / gap ±10px. Colour, font family, weight, line-height, border colour and copy must match exactly. Line-height is compared in % (Figma’s unit).'),
];

// Same issue on several elements (same kind, property, Figma value, live value, difference)
// becomes ONE row: "Field - required asterisk: 9 of 12 fields: First Name, Last Name, ...".
// Elements are named "(<State>) <Kind with "<Name>" in quotes>[ - part]".
const parseElement = (element) => {
  const m = element.match(/^\((.+?)\) (.*)$/);
  const state = m ? m[1] : '';
  const rest = m ? m[2] : element;
  const n = rest.match(/"([^"]*)"/);
  return { state, name: n ? n[1] : '', kind: n ? rest.replace(/ ?"[^"]*"/, '').replace(/\s+/g, ' ').trim() : rest };
};
const totalsByKind = new Map(); // kind|property -> Set of names that were checked at all
for (const r of records) {
  const e = parseElement(r.element);
  if (!e.name) continue;
  const k = `${e.kind}|${r.property}`;
  if (!totalsByKind.has(k)) totalsByKind.set(k, new Set());
  totalsByKind.get(k).add(e.name);
}
const groupRecords = (list) => {
  const groups = new Map();
  for (const r of list) {
    const e = parseElement(r.element);
    const key = [e.kind, r.property, r.figma, r.live, r.difference, e.name ? '' : r.element].join('|');
    if (!groups.has(key)) groups.set(key, { ...r, kind: e.kind, names: [], states: [] });
    const g = groups.get(key);
    if (e.name && !g.names.includes(e.name)) g.names.push(e.name);
    if (e.state && !g.states.includes(e.state)) g.states.push(e.state);
  }
  return [...groups.values()].map((g) => {
    if (!g.names.length) return { ...g, label: g.element };
    const total = totalsByKind.get(`${g.kind}|${g.property}`)?.size ?? g.names.length;
    const where = g.states.length ? ` - ${g.states.join(' and ')} state${g.states.length > 1 ? 's' : ''}` : '';
    if (g.names.length === 1) return { ...g, label: `${g.kind}: "${g.names[0]}"${where}` };
    return { ...g, label: `${g.kind}
${g.names.length} of ${total}${where}
${g.names.join(', ')}` };
  });
};
const beyondGroups = groupRecords(beyond);
const withinGroups = groupRecords(within);
if (beyondGroups.length < beyond.length) {
  children.push(p(`Repeats of the same difference on several elements are shown as one row: ${beyond.length} values, ${beyondGroups.length} distinct differences.`));
}

// Same three layouts as the approved reports: beyond (numbered), within, checked values.
children.push(h1('Differences beyond tolerance'));
children.push(
  beyondGroups.length
    ? table(['#', 'Element', 'Property', 'Figma', 'Live', 'Difference'],
        beyondGroups.map((r, i) => [String(i + 1), r.label, r.property, r.figma, r.live, r.difference]), [5, 30, 15, 16, 16, 18])
    : p('None.'),
);

children.push(h1('Differences within tolerance'));
children.push(
  withinGroups.length
    ? table(['Item', 'Figma', 'Live', 'Difference'],
        withinGroups.map((r) => [`${r.label}
${r.property}`, r.figma, r.live, r.difference]), [46, 18, 18, 18])
    : p('None.'),
);

if (otherFailed.length) {
  children.push(h1('Other failed checks'));
  children.push(table(['Check', 'Detail'], otherFailed.map((t) => [t.title, t.error || 'No detail captured']), [40, 60]));
}

children.push(h1('Checked values'));
children.push(
  records.length
    ? table(['Element', 'Property', 'Figma', 'Live', 'Difference'], groupedRows(records, ['property', 'figma', 'live', 'difference']), [24, 22, 20, 20, 14])
    : p('No Figma-vs-live values were recorded. These specs do not use checkExact / checkTolerance from src/shared/design-validation/designCheck.ts, so no comparison table can be produced.'),
);

children.push(
  h1('Not covered by this report'),
  p('Items to confirm with design, "Verified as matching" notes and quick-access steps are not generated. Add them by hand if the story needs them (see docs/design-validation.md, "Report for a story").'),
);

const doc = new Document({ sections: [{ children }] });
const buffer = await Packer.toBuffer(doc);
let outPath = docxPath;
try {
  fs.writeFileSync(outPath, buffer);
} catch (err) {
  // The previous report is open in Word (Windows locks it): save next to it instead.
  if (err.code !== 'EBUSY' && err.code !== 'EPERM') throw err;
  outPath = docxPath.replace(/.docx$/, `-${new Date().toISOString().slice(11, 16).replace(':', '')}.docx`);
  fs.writeFileSync(outPath, buffer);
  console.log(`(${path.basename(docxPath)} is open in another program; saved a new copy instead)`);
}
console.log(`Report: ${outPath}\n${tests.length - failedCount}/${tests.length} passed; ${records.length} values recorded, ${beyond.length} beyond tolerance, ${within.length} within tolerance`);
