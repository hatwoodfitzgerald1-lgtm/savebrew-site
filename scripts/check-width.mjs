#!/usr/bin/env node
// THE FULL WIDTH RULE lint (Art Direction 3.17, design document 3.3): fails the build when any stylesheet
// (src/**/*.css and the <style> blocks of src/**/*.astro) declares a max-width under 100 percent (or in px,
// rem, ch, vw, calc, min or max) on a section level element, a margin auto centred container, a .container
// class, or the named forbidden expressions max(1720px, 86vw) and min(100% minus two gutters, 1800px).
// Small, inline and control elements (images, icons, buttons, fields, the drawer panel) may cap their width.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SRC = path.join(ROOT, 'src');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(css|astro)$/.test(e.name)) files.push(p);
  }
})(SRC);

// selectors whose last compound is an inline, media or control element are allowed a width cap
const SMALL = /(^|[\s>+~(])(img|svg|video|canvas|picture|button|input|select|textarea|label|a|span|small|strong|em|li|dt|dd|code|figure|figcaption|\.icon|\.knot|\.seal[\w-]*|\.bobbin[\w-]*|\.chip|\.switch[\w-]*|\.check|\.band__[\w-]+|\.menu[\w-]*|\.cart-drawer__[\w-]+|\.cadence[\w-]*|\.loader[\w-]*|\.scene[\w-]*|\.sb-app[\w-]*|\.picture|\.threadstrip[\w-]*|\.selvedge[\w-]*|\.weft-pass[\w-]*|\.tabstrip__[\w-]+|\.field[\w-]*|\.error-summary|\.demo-icon|\.compact__seal|\.footer__seal-svg|\.skip|\.live|\.sr-only|\.fig[\w-]*|\.pull-thread|\.disclaimer[\w-]*|\.hv[\w-]*|\.knot-letter|\.g|\.ent-item|::?[\w-]+)$/;
const findings = [];

function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
function* rules(css, chain = []) {
  // yields { selector, body } for every rule, following nesting; at-rules are kept in the chain for context
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) return;
    const head = css.slice(i, open).trim().split(/[;}]/).pop().trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    const sel = head.startsWith('@') ? head : (chain.filter((c) => !c.startsWith('@')).length ? chain.filter((c) => !c.startsWith('@')).join(' ') + ' ' + head : head);
    const own = body.replace(/[^{}]*\{[\s\S]*?\}/g, (m) => '');
    // own declarations: strip nested blocks
    const decls = stripNested(body);
    if (!head.startsWith('@')) yield { selector: sel.replace(/&/g, '').replace(/\s+/g, ' ').trim(), body: decls };
    if (/\{/.test(body)) yield* rules(body, [...chain, head]);
    i = j;
  }
}
function stripNested(body) {
  let out = '', depth = 0;
  for (const ch of body) { if (ch === '{') depth++; else if (ch === '}') depth--; else if (depth === 0) out += ch; }
  return out;
}
function check(file, css, offsetLabel) {
  css = stripComments(css);
  for (const { selector, body } of rules(css)) {
    const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
    const decl = body.replace(/\s+/g, ' ');
    const maxW = decl.match(/(?:^|;)\s*max-width\s*:\s*([^;]+)/i);
    const badMax = maxW && !/^(none|100%|inherit|unset|initial|revert)$/i.test(maxW[1].trim());
    const marginAuto = /(?:^|;)\s*margin\s*:\s*0\s+auto\b/i.test(decl) || /(?:^|;)\s*margin-inline\s*:\s*auto/i.test(decl) || (/margin-left\s*:\s*auto/i.test(decl) && /margin-right\s*:\s*auto/i.test(decl));
    const namedBad = /max\(\s*1720px\s*,\s*86vw\s*\)|min\(\s*100%\s*-[^,]*,\s*1800px\s*\)/i.test(decl);
    const widthPx = decl.match(/(?:^|;)\s*width\s*:\s*(\d+px)/i);
    for (const p of parts) {
      const small = SMALL.test(p);
      if (/\.container\b|\.wrapper\b|\.inner\b(?!-)/.test(p) && !small) findings.push(`${file}: "${p}" is a centred container class`);
      if (badMax && !small) findings.push(`${file}: "${p}" declares max-width: ${maxW[1].trim()} on a section level block`);
      if (marginAuto && !small) findings.push(`${file}: "${p}" is centred with margin auto`);
      if (namedBad) findings.push(`${file}: "${p}" uses a forbidden width expression`);
      if (widthPx && /(^|\s)(\.pass|\.board|\.heading-pass|\.wide|section|main|\.footer|\.sms|\.compact)\b/.test(p) && !/\.sb-app/.test(p)) findings.push(`${file}: "${p}" has a fixed pixel width (${widthPx[1]})`);
    }
  }
}
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const text = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.css')) check(rel, text);
  else for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) check(rel, m[1]);
}
if (findings.length) {
  console.error('check-width: THE FULL WIDTH RULE fails:\n  ' + findings.join('\n  '));
  process.exit(1);
}
console.log(`check-width: ${files.length} files, no fixed centred container, no max-width on a section level block`);
