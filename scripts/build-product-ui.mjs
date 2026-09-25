#!/usr/bin/env node
// Imports the three real dashboard views from /home/claude/savebrew/assets/product-ui (today.html, rates.html,
// goals.html with app-shell.css and tokens.css) into src/data/product-ui.json as scoped CSS and body markup.
// The CSS is wrapped in native nesting under .sb-app__stage so it cannot leak into the site; the phone media
// query becomes the .is-phone variant, so the same markup renders the desktop window (1440 by 900) and the
// frameless phone view (375 by 812). Rerunnable; runs before every build.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.env.SB_PRODUCT_UI || '/home/claude/savebrew/assets/product-ui';
const OUT = path.resolve(new URL('..', import.meta.url).pathname, 'src/data/product-ui.json');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

function scope(css) {
  let s = css;
  s = s.replace(/@font-face\s*\{[^}]*\}/g, '');                // the site serves the fonts
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');                      // comments
  s = s.replace(/html,\s*body\s*\{[^}]*\}/g, '');              // the document sizing
  s = s.replace(/:root\s*\{/g, '& {');
  s = s.replace(/(^|\n)\s*body\s*\{/g, '$1& {');
  s = s.replace(/@media \(max-width: 600px\)\s*\{/g, '&.is-phone {');
  // the app fills the stage, not the viewport
  s = s.replace(/width:\s*100vw;/g, 'width: 100%;').replace(/height:\s*100vh;/g, 'height: 100%;');
  return s.trim();
}
const shell = scope(read('tokens.css') + '\n' + read('app-shell.css'));

const views = {};
for (const view of ['today', 'rates', 'goals']) {
  const html = read(`${view}.html`);
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  let body = (html.match(/<body>([\s\S]*?)<\/body>/) || [])[1] || '';
  body = body.replace(/<script>[\s\S]*?<\/script>/g, '').trim();
  // one shared symbol block per page: strip the per view copy, keep the ids
  const symbols = (body.match(/<svg[^>]*style="display:none"[\s\S]*?<\/svg>/) || [])[0] || '';
  body = body.replace(symbols, '').trim();
  // the tabs and links: data attributes for the site's own wiring, no dead hrefs
  body = body.replace(/<a class="tab" href="#"( aria-current="page")?>([A-Za-z]+)<\/a>/g, (m, cur, name) => `<a class="tab" href="/${name.toLowerCase()}" data-tab="${name.toLowerCase()}"${cur || ''}>${name}</a>`);
  body = body.replace(/<a class="lockup" href="#"/, '<a class="lockup" href="/today"');
  body = body.replace(/<a class="link" href="#"/g, '<a class="link" href="#" data-product-link');
  body = body.replace(/ id="(app|toggle1|goalbar|bankA-change|ef-bar|ef-pct)"/g, ` data-id="$1"`);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || view;
  views[view] = { css: scope(style), html: body, title, symbols };
}
const out = { generated: new Date().toISOString(), source: SRC, shellCss: shell, symbols: views.today.symbols, views };
for (const v of Object.values(out.views)) delete v.symbols;
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('build-product-ui: wrote src/data/product-ui.json (' + Object.keys(views).join(', ') + ')');
const dashes = Object.values(views).filter((v) => /[–—]/.test(v.html));
if (dashes.length) console.warn('build-product-ui: WARNING an em or en dash is inside a product view');
