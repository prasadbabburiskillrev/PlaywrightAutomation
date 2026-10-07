// Converts the saved Figma text dumps (baseline/pages/**/*.txt) into resolved, body-only
// JSON (header/footer stripped). Output is gitignored with the rest of baseline/.
// Usage: npm run design:convert -- <program-key>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dirFlag = args.find((a) => a.startsWith('--dir='));
const programKey = args.find((a) => !a.startsWith('--'));
if (!programKey) {
  console.error('Usage: npm run design:convert -- <program-key> [--dir=<baseline-dir>]');
  process.exit(1);
}
const programsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'programs');
const pagesDir = dirFlag
  ? path.join(path.resolve(dirFlag.slice('--dir='.length)), 'pages')
  : path.join(programsDir, programKey, 'design-validation', 'baseline', 'pages');
// Header/footer are validated once per program, so drop them from every page body. Matches
// the component names used across programs: "Header", "Footer", "Tyruko Header", "Tyruko Footer".
const STRIP_NAME = /(^|\s)(header|footer)$/i;
const BS = String.fromCharCode(92);
const ESCAPABLE = '()[]*"_#$' + BS;

// Figma escapes markdown-ish characters with a backslash; drop the escape.
function unescapeText(s) {
  let out = '';
  for (let k = 0; k < s.length; k++) {
    if (s[k] === BS && k + 1 < s.length && ESCAPABLE.includes(s[k + 1])) {
      out += s[k + 1];
      k++;
    } else out += s[k];
  }
  return out;
}

// --- minimal YAML subset parser (maps, lists, quoted/plain scalars) ---
function scalar(raw) {
  const v = raw.trim();
  if (v === '[]') return [];
  if (v.startsWith("'") && v.endsWith("'")) return unescapeText(v.slice(1, -1).split("''").join("'"));
  if (v.startsWith('"') && v.endsWith('"')) return unescapeText(v.slice(1, -1));
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v;
}
function parseYaml(text) {
  const lines = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  let i = 0;
  const indentOf = (l) => l.match(/^ */)[0].length;
  const isItem = (l) => l.trim().startsWith('- ');
  function parseBlock(indent) {
    return isItem(lines[i]) ? parseList(indent) : parseMap(indent);
  }
  function parseMap(indent) {
    const obj = {};
    while (i < lines.length && indentOf(lines[i]) === indent && !isItem(lines[i])) {
      const m = lines[i].trim().match(/^(.+?):(?: (.*))?$/);
      i++;
      if (!m) continue;
      const [, key, val] = m;
      if (val !== undefined && val !== '') obj[key] = scalar(val);
      else if (i < lines.length && (indentOf(lines[i]) > indent || (isItem(lines[i]) && indentOf(lines[i]) === indent)))
        obj[key] = parseBlock(indentOf(lines[i]));
      else obj[key] = null;
    }
    return obj;
  }
  function parseList(indent) {
    const arr = [];
    while (i < lines.length && indentOf(lines[i]) === indent && isItem(lines[i])) {
      const rest = lines[i].trim().slice(2);
      if (rest.startsWith('- ')) {
        // nested list ("- - 1"): rewrite as an item one level deeper
        lines[i] = ' '.repeat(indent + 2) + rest;
        arr.push(parseList(indent + 2));
      } else if (!rest.startsWith("'") &&!rest.startsWith('"') && /^[^'"]+?:(?: |$)/.test(rest)) {
        // list item that is a map: rewrite as a map entry one level deeper
        lines[i] = ' '.repeat(indent + 2) + rest;
        arr.push(parseMap(indent + 2));
      } else {
        arr.push(scalar(rest));
        i++;
      }
    }
    return arr;
  }
  const root = {};
  while (i < lines.length) {
    const before = i;
    Object.assign(root, parseMap(indentOf(lines[i])));
    if (i === before) throw new Error('YAML parse stuck at: ' + lines[i].slice(0, 100));
  }
  return root;
}

// --- NODES line parser ---
function readValue(s, p) {
  if (s[p] === '{') {
    let depth = 0;
    let inStr = false;
    for (let q = p; q < s.length; q++) {
      const c = s[q];
      if (inStr) {
        if (c === BS) q++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return [JSON.parse(s.slice(p, q + 1)), q + 1];
    }
  }
  if (s[p] === '"') {
    for (let q = p + 1; q < s.length; q++) {
      if (s[q] === BS) q++;
      else if (s[q] === '"') {
        const raw = s.slice(p + 1, q);
        try {
          return [JSON.parse('"' + raw + '"'), q + 1];
        } catch {
          return [unescapeText(raw), q + 1];
        }
      }
    }
  }
  const e = s.indexOf(' ', p);
  const end = e < 0 ? s.length : e;
  return [s.slice(p, end), end];
}
function parseNodeLine(line) {
  const m = line.match(/^( *)\[([A-Z-]+)\] (?:"(.*?)" )?#(\S+)([\s\S]*)$/);
  if (!m) throw new Error('Unparseable node line: ' + line.slice(0, 120));
  const node = { depth: m[1].length / 2, type: m[2], id: m[4] };
  if (m[3] !== undefined) node.name = m[3];
  const attrs = {};
  const rest = m[5];
  let p = 0;
  while (p < rest.length) {
    if (rest[p] === ' ') {
      p++;
      continue;
    }
    const eq = rest.indexOf('=', p);
    const key = rest.slice(p, eq);
    const [val, np] = readValue(rest, eq + 1);
    attrs[key] = val;
    p = np;
  }
  return { node, attrs };
}

// --- resolution ---
const defs = parseYaml(fs.readFileSync(path.join(pagesDir, '_shared-definitions.txt'), 'utf8'));
const ref = (v) => (typeof v === 'string' && defs[v] !== undefined && typeof defs[v] === 'object' ? defs[v] : v);
const REF_FIELDS = new Set(['layout', 'fills', 'strokes', 'textStyle', 'effects']);
function resolveFields(src) {
  const out = {};
  for (const [k, v] of Object.entries(src)) out[k] = REF_FIELDS.has(k) ? ref(v) : v;
  return out;
}
function resolveText(o) {
  if (typeof o.text !== 'string') return o;
  const spans = {};
  for (const m of o.text.matchAll(/\{(ts\d+)\}/g)) if (defs[m[1]]) spans[m[1]] = defs[m[1]];
  if (Object.keys(spans).length) o.textSpanStyles = spans;
  return o;
}
function build(lines) {
  const root = [];
  const stack = [];
  for (const line of lines) {
    const { node, attrs } = parseNodeLine(line);
    const tpl = attrs.template ? defs[attrs.template] : {};
    delete attrs.template;
    const { type: _t, ...tplRest } = tpl || {};
    const out = resolveText({
      id: node.id,
      ...(node.name ? { name: node.name } : {}),
      type: node.type,
      ...resolveFields(tplRest),
      ...resolveFields(attrs),
    });
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    const holder = stack.length ? (stack[stack.length - 1].out.children ??= []) : root;
    holder.push(out);
    stack.push({ depth: node.depth, out });
  }
  return root[0];
}
function strip(n) {
  if (!n.children) return n;
  n.children = n.children.filter((c) => !(c.type === 'INSTANCE' && STRIP_NAME.test(c.name ?? ''))).map(strip);
  return n;
}

const index = JSON.parse(fs.readFileSync(path.join(pagesDir, 'index.json'), 'utf8'));
let count = 0;
for (const e of index) {
  const src = path.join(pagesDir, e.file.replace(/^pages\//, ''));
  const tree = strip(build(fs.readFileSync(src, 'utf8').split('\n').filter((l) => l.trim())));
  const jsonFile = src.replace(/\.txt$/, '.json');
  fs.writeFileSync(
    jsonFile,
    JSON.stringify({ figmaName: e.figmaName, nodeId: e.nodeId, excludes: ['header', 'footer'], body: tree }, null, 2),
  );
  e.json = e.file.replace(/\.txt$/, '.json');
  count++;
}
fs.writeFileSync(path.join(pagesDir, 'index.json'), JSON.stringify(index, null, 1));
console.log(`converted ${count} pages`);
