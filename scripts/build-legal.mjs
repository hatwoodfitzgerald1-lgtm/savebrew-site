#!/usr/bin/env node
// Extracts the two legal documents from the design document's section 8 (the text between the VERBATIM BEGIN and
// VERBATIM END markers, pasted there unchanged from the generated .docx files) into src/data/legal.json, keeping
// every clause, line, bullet, hyphen and the [EIN Address] and [INSERT SHORT CODE] placeholders exactly as written.
// Run: node scripts/build-legal.mjs (rerunnable; the JSON is committed so the build does not depend on the spec).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SPEC = process.env.SB_DESIGN_DOC || '/home/claude/savebrew/spec/SaveBrew_Website_Design.md';
const OUT = path.join(ROOT, 'src/data/legal.json');
const text = fs.readFileSync(SPEC, 'utf8');

function extract(name) {
  const begin = text.indexOf(`[[VERBATIM BEGIN: ${name}]]`);
  const end = text.indexOf(`[[VERBATIM END: ${name}]]`);
  if (begin < 0 || end < 0) throw new Error(`build-legal: markers for ${name} not found`);
  const body = text.slice(begin + `[[VERBATIM BEGIN: ${name}]]`.length, end).replace(/^\s+|\s+$/g, '');
  const lines = body.split('\n');
  const doc = { title: '', entity: '', intro: [], clauses: [] };
  let clause = null;
  let i = 0;
  // the title line "### Terms of Service", then the entity line, then the intro paragraphs until the first "#### " clause
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^### /.test(line)) { doc.title = line.replace(/^### /, '').trim(); continue; }
    if (/^#### /.test(line)) break;
    if (!doc.entity && line.trim()) { doc.entity = line.trim(); continue; }
    if (line.trim()) doc.intro.push(line.trim());
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^#### /.test(line)) { clause = { heading: line.replace(/^#### /, '').trim(), id: '', blocks: [] }; clause.id = clause.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); doc.clauses.push(clause); continue; }
    if (!clause) continue;
    if (!line.trim()) continue;
    if (/^- /.test(line)) {
      const last = clause.blocks[clause.blocks.length - 1];
      if (last && last.type === 'list') last.items.push(line.replace(/^- /, ''));
      else clause.blocks.push({ type: 'list', items: [line.replace(/^- /, '')] });
    } else {
      clause.blocks.push({ type: 'p', text: line.trim() });
    }
  }
  return doc;
}
const out = { generated: new Date().toISOString(), source: SPEC, terms: extract('SaveBrew_TOS.docx'), privacy: extract('SaveBrew_Privacy_Policy.docx') };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const count = (d) => d.clauses.length;
console.log(`build-legal: wrote src/data/legal.json (terms: ${count(out.terms)} clauses, privacy: ${count(out.privacy)} clauses)`);
for (const [k, d] of Object.entries({ terms: out.terms, privacy: out.privacy })) {
  const all = JSON.stringify(d);
  if (!all.includes('[EIN Address]')) console.warn(`build-legal: WARNING ${k} has no [EIN Address] placeholder`);
  if (k === 'terms' && (all.match(/\[INSERT SHORT CODE\]/g) || []).length !== 2) console.warn('build-legal: WARNING the terms should carry [INSERT SHORT CODE] twice');
}
