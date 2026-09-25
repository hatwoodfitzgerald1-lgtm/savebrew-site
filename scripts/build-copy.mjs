#!/usr/bin/env node
// Parses /home/claude/savebrew/spec/copy/copy.md (an id in backticks on its own line, the string on the
// next line) into src/data/copy.json keyed by id. Rerunnable; runs before every build (npm run data).
// "ref <id>" values are resolved to the referenced string so t('footer.disclaimer') returns the text.
// Multi id refs ("ref a, b, c" or "ref a through b") are kept as written under the same id and listed in _refs.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.env.SB_COPY || '/home/claude/savebrew/spec/copy/copy.md';
const OUT = path.resolve(new URL('..', import.meta.url).pathname, 'src/data/copy.json');

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const raw = {};
const order = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^`([a-z0-9][a-z0-9.]*)`\s*$/i);
  if (!m) continue;
  let j = i + 1;
  while (j < lines.length && lines[j].trim() === '') j++;
  const value = j < lines.length ? lines[j].trim() : '';
  if (raw[m[1]] !== undefined) console.warn(`build-copy: duplicate id ${m[1]} (line ${i + 1}); the later one wins`);
  raw[m[1]] = value;
  order.push(m[1]);
}

const out = {};
const refs = {};
const dashes = [];
for (const id of order) {
  let v = raw[id];
  if (/^\(empty alt/.test(v)) v = '';
  const single = v.match(/^ref ([a-z0-9.]+)$/i);
  if (single) {
    refs[id] = single[1];
    v = raw[single[1]];
    if (v === undefined) { console.warn(`build-copy: ${id} refers to unknown id ${single[1]}`); v = ''; }
  } else if (/^ref /.test(v)) {
    refs[id] = v.slice(4);
  }
  out[id] = v;
  // guard: no em dash, en dash or hyphen used as punctuation in shipped strings (the verbatim SMS block keeps its hyphen)
  if (/[–—]|\s-\s|--/.test(v)) dashes.push(id);
}
out._refs = refs;
out._count = order.length;
out._source = SRC;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`build-copy: ${order.length} ids -> ${path.relative(process.cwd(), OUT)}`);
if (dashes.length) console.warn('build-copy: WARNING dash punctuation found in: ' + dashes.join(', '));
