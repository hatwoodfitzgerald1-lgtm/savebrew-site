#!/usr/bin/env node
// The no dashes rule: no em dash, en dash, spaced hyphen or double hyphen as punctuation in any shipped text.
// Scans the string tables and long form JSON (src/data), and the template text of every .astro file
// (outside frontmatter, <style>, <script> and attribute values). Hyphens inside code, slugs, CSS custom
// properties and the verbatim SMS and legal blocks are allowed. Fails the build on a hit.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const hits = [];
const EMEN = /[–—]/;
const SPACED = /\s-\s|--/;
// the verbatim blocks that keep their hyphens
const ALLOWED = [/\(888\) 338-8809/, /Terms-of-Service|privacy-policy/];

function scanJson(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  (function walk(v, key) {
    if (typeof v === 'string') {
      if (key.startsWith('_') || /source|url|href|slug|path|graphic|photoSlot|id$/.test(key)) return;
      const clean = ALLOWED.reduce((s, re) => s.replace(re, ''), v);
      if (EMEN.test(clean)) hits.push(`${path.relative(ROOT, file)} ${key}: em or en dash: ${v.slice(0, 80)}`);
      else if (SPACED.test(clean) && !/^https?:|^\//.test(v)) hits.push(`${path.relative(ROOT, file)} ${key}: a hyphen used as a dash: ${v.slice(0, 80)}`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${key}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, key ? `${key}.${k}` : k);
  })(data, '');
}
function scanAstro(file) {
  let text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  if (EMEN.test(text)) hits.push(`${rel}: an em or en dash character is in the file`);
  // template text only: drop frontmatter, style and script blocks, tags and expressions
  text = text.replace(/^---[\s\S]*?---/, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  text = text.replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]+>/g, ' ');
  for (const line of text.split('\n')) if (SPACED.test(line)) hits.push(`${rel}: a hyphen used as a dash in template text: ${line.trim().slice(0, 80)}`);
}
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json') && dir.endsWith('data') && !/asset-plan|asset-status|product-ui/.test(e.name)) scanJson(p);
    else if (e.name.endsWith('.astro')) scanAstro(p);
  }
})(path.join(ROOT, 'src'));
if (hits.length) { console.error('check-dashes: dashes used as punctuation:\n  ' + hits.join('\n  ')); process.exit(1); }
console.log('check-dashes: no em dash, en dash or hyphen used as punctuation in shipped text');
