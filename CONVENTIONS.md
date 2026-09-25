# SaveBrew site conventions

The foundation for savebrew.com (finalshot Step 7, Stage A). Three page agents build the pages on top of it in parallel without talking to the foundation author, so everything shared lives here: the project, the tokens, the layout system, the chrome, the kit, the motion system, the loader, the data loaders and the rules. Read this whole file before adding a page. The contract is /home/claude/savebrew/spec/BUILD_DIRECTIVE.md; the design document is /home/claude/savebrew/spec/SaveBrew_Website_Design.md (section 7 has every route); the art direction is /home/claude/savebrew/spec/art_direction_spec.md.

No dashes are used in this file as punctuation, and none may be used in anything you ship (see "The no dashes rule").

## 1. Framework and deploy

- Astro 7 with `output: 'server'` and the Cloudflare based Webflow Cloud adapter, `@astrojs/cloudflare` 14. Decision recorded here: browser_deploy.md names "the Webflow Cloud adapter (Cloudflare based)" without a package name, and no `@webflow/astro` package exists on npm. Webflow Cloud's own Astro starter (github.com/Webflow-Examples/hello-world-astro-minimal) pins `astro ^7` with `@astrojs/cloudflare ^14`, `output: "server"`, `adapter: cloudflare({ platformProxy: { enabled: true } })`, a `webflow.json` with `{ "cloud": { "framework": "astro" } }` and a `wrangler.json` with the assets binding, and Webflow's framework customisation docs say the platform injects the same adapter version at deploy time and sets the base path from the environment's mount path (mounted at `/`), so `base` is not set in `astro.config.mjs`. That is exactly what this project has. `npm install && npm run build` passes in the sandbox; the built worker is `dist/_worker.js`, the static files are `dist/client`.
- `src/pages/[...slug].astro` is the server rendered catch all (`export const prerender = false`). Every path resolves through it against the route map in `src/routes/index.ts`, so no static directory file exists to trigger Webflow Cloud's trailing slash redirect loop. `/terms-of-service` and `/privacy-policy` are 301s to `/terms` and `/privacy` (the `aliases` map). Unknown paths render the 404 entry with a 404 status and an `x-robots-tag: noindex` header, never the home HTML.
- Static files live under `public/` and are served at the same paths: `public/assets/...` at `/assets/...` and `public/data/moves.json` at `/data/moves.json`. Files with extensions never go through the catch all. RSS feeds go in `public/roundup/feed.xml` and `public/guides/feed.xml` (the roundup and guides agents write them; they are static files).
- Because the pages are server rendered on Cloudflare, `.astro` frontmatter runs at request time in a worker with no filesystem: never use `node:fs`, `node:path` or `process.cwd()` in a component or a route. Read data through the JSON in `src/data` (built before every build by the scripts) and inline files with `?raw` imports (`import raw from '../../public/assets/kit/knot.svg?raw'`), which Vite bundles at build time. Build time work goes in `scripts/*.mjs`.
- Scripts (`npm run ...`): `data` (copy.md, the long form, the product UI and the asset status into `src/data`), `assets` (copies the shipped assets from /home/claude/savebrew/assets into `public/assets`, rerun when the photos and the hero loop land), `fonts` (subsets the two variable fonts to Latin woff2), `twill` (pre renders the twill tile to `public/assets/texture/twill.webp`), `check:width`, `check:dashes`, `build` (runs `data` and both checks first through `prebuild`), `dev`, `shoot`.
- Commit nothing yet (no git in Stage A). The deploy is Step 8, through the browser.

## 2. Where things are

```
site/
  astro.config.mjs, webflow.json, wrangler.json, tsconfig.json, package.json
  CONVENTIONS.md                     this file
  scripts/                           build-copy, build-longform, build-product-ui, build-fonts.py, build-twill,
                                     copy-assets, check-assets, check-width, check-dashes, shoot
  public/assets/                     brand/ (favicons, OG image, logo lockups), kit/ (the graphic kit SVGs),
                                     product/ (the six shots), video/, texture/ (fabric, twill), fonts/ (woff2),
                                     photo/ (the awaiting stills land here), js/ (scroll-timeline.js, three-lines-r128.js)
  public/data/moves.json             the ranker candidates
  src/pages/[...slug].astro          the catch all
  src/routes/index.ts                the route map (path to page component); Stub.astro; _demo.astro
  src/layouts/Layout.astro           the global chrome and head hygiene
  src/components/                    Header, Footer, TabStrip, CartDrawer, SmsOptIn, Bobbin, HeadingPass, Board, Cell,
                                     Disclaimer, CompactMembership, MotionControl, PageScene, Picture
  src/components/kit/                Knot, Seal, ThreadStrip, WeftPass, Icon, Selvedge, Twill, Spool
  src/components/product/            ProductToday, ProductRates, ProductGoals (ProductView underneath)
  src/styles/                        tokens.css, base.css, layout.css, kit.css, motion.css
  src/scripts/                       motion.ts, loader.ts, surfaces.ts, ease.ts, cart.ts, cart-drawer.ts, header.ts,
                                     sms.ts, motion-control.ts, product-ui.ts, twill-tile.js, scenes/base.ts, scenes/contact-knot.ts
  src/lib/                           copy.ts (t, fmt, THREADS), longform.ts, assets.ts, svg.ts
  src/data/                          copy.json, add.json, about.json, roundup.json, brief.json, guides.json, moves.json,
                                     product-ui.json, asset-plan.json, asset-status.json (all generated except add.json)
  shots/                             screenshots from scripts/shoot.mjs (ignored by git)
```

## 3. Adding a route

1. Create your page component in `src/routes/`, for example `src/routes/brief.astro`. It receives `path` (the resolved path) plus whatever props the route entry gives it. It renders `<Layout ...>` and its sections.
2. In `src/routes/index.ts` replace the Stub entry for your path: `'/brief': { component: Brief }` (import it at the top). Extra props go in `props`, for example the roundup issue: `'/roundup/2026-09-19': { component: Roundup, props: { issue: '2026-09-19' } }`. Give the 404 page to `notFound`.
3. Paths are matched without a trailing slash and are case insensitive at the first letter. The planned paths, all present as stubs now: `/`, `/brief`, `/membership`, `/roundup`, `/roundup/2026-09-19`, `/guides`, `/guides/make-a-rotating-category-pay`, `/guides/the-national-average-is-a-warning`, `/guides/four-percent-against-the-account-you-have`, `/guides/why-patio-furniture-is-cheap-in-october`, `/your-moves`, `/about`, `/contact`, `/cart`, `/checkout`, `/confirmation`, `/today`, `/rates`, `/goals`, `/archive`, `/sign-in`, `/terms`, `/privacy`, the 404, and `/_demo` (the foundation demo, not in the nav; Astro ignores underscore files in `src/pages`, so the demo lives in `src/routes/_demo.astro` and is mapped by the catch all).
4. Run `npm run dev` and open http://localhost:4321/your-path, then `node scripts/shoot.mjs /your-path 1280,1440,1920,2560,375` and look at the screenshots with your own eyes.

## 4. The Layout and head hygiene

```astro
---
import Layout from '../layouts/Layout.astro';
import { t } from '../lib/copy';
---
<Layout title={t('head.about.title')} description={t('head.about.meta')} route="/about" hover="dye">
  ...sections...
</Layout>
```
Props: `title` and `description` (always the `head.*` ids from copy.md), `route` (the path; sets the canonical URL and the active nav link), `hover` (this page's text hover, one of `pluck | tighten | stitch | knot | lift | dye | dash | unspool`), `noindex` (true on /today, /rates, /goals, /archive, /sign-in, /cart, /checkout, /confirmation), `rss` (an array of `{ title, href }` for the public routes: `[{ title: 'The Weekly Roundup', href: '/roundup/feed.xml' }]`), `preload` (extra `<link rel="preload">` objects, for example the home poster: `[{ href: '/assets/video/hero-loop-poster.webp', as: 'image' }]`), `ogImage` (defaults to the kit OG banner), `bodyClass`, `loader` (false only where the stitch must not run), `footer` and `tabstrip` (false only on the checkout if section 7 says so). The layout sets `lang="en"`, the favicon set, OG and Twitter tags, the theme colour, the font preloads, the reduce motion restore script (before paint), the skip link, the loader, the heading band, the tab strip, `<main id="content">`, the footer, the cart drawer and the live region `#sb-live`. A `head` slot adds anything else to `<head>`.

## 5. Copy: fetch every string by id

```ts
import { t, fmt, fill, has, THREADS } from '../lib/copy';
t('home.hero.h1')                                            // the string for a copy.md id; throws at build when the id is unknown
fmt('cart.renewal.monthly.pattern', { 'date in words': 'October 24, 2026', amount: '$7.99' })
THREADS   // [{ key: 'rates', name: 'Rates', icon: 'rates' }, ...] in the fixed order Rates, Cashback, Coupons, Seasonal, Paycheck
```
`src/data/copy.json` is generated from /home/claude/savebrew/spec/copy/copy.md (619 ids). `ref` values are resolved to the referenced string. Never retype a string that has an id. The `add.` strings the design document adds for states copy.md lacks live in `src/data/add.json`: append the ones your route needs, verbatim from the design document, with their `add.` ids (the SMS states are already there).

The long form (verbatim, parsed by `scripts/build-longform.mjs`):
```ts
import { about, roundup, brief, guides, moves, guideBySlug, guidesForThread } from '../lib/longform';
about.heading, about.bodyHtml, about.chosen.noClaim.html, about.where.*          // ship about.chosen.noReferralFees only on the owner's confirmation
roundup.heading, roundup.date, roundup.moves[i].{thread, headline, span, paragraphs[{kind, text}]}, roundup.rates.rows, roundup.past.entries
brief.today.items[5], brief.yesterday.items[5], brief.lastWeek.days[5].items[5] (the 25 knot matrix, also brief.lastWeek.matrix), brief.thisWeek.days
guides[4]: { title, slug, thread, dek, reading_minutes, pull_thread, membership_line, button_label, h1, bodyHtml, sections[{heading, html}], graphic, photoSlot, wordCount }
moves: { editors_order, toggle_order, candidates[7] }     // also served at /data/moves.json
```
Guide bodies come as `bodyHtml` (marked's rendering, verbatim text) and as `sections` (the intro, then each question heading with its paragraphs) so a guide agent can lay the pull thread across the columns at `pullThreadParagraphIndex`. The trailing membership line, button and disclaimer are peeled off the body and supplied separately (`membershipLine`, `button`, `disclaimer`).

## 6. Components

Every component takes `class` for extra classes. Strings shown are examples; use `t()`.

| Component | Props | Example |
|---|---|---|
| `HeadingPass` | `title` (the question), `id`, `level` (2), `intro` (columns one to two), `aside` (columns four to five, or the `aside` slot), `photoSlot` (a photo slot at 20 percent behind it), `wideTitle`, `entrance` (default `stitch`) | `<HeadingPass title={t('home.pass.heading')} id="pass" intro={t('home.pass.intro')} />` |
| `Board` | `id` (required), `cells` (5), `strip` (thread strip at the head, true), `stripMobile`, `edge` (selvedge at the foot, true), `entrance` (`weft-left` default, or `weft-right | dock | knots | stitch | pop | none`), `stagger` (ms), `items` (selector for the staggered items, `.cell`), `twill`, `label`, `tag` | `<Board id="today" entrance="dock" stagger={70}>...five cells...</Board>` |
| `Cell` | `thread` (`rates | cashback | coupons | seasonal | paycheck`, sets `data-thread` for the tab strip), `head` (the cell head text, defaults to the thread name), `icon` (a kit icon instead of the knot), `span` (1, 2, 3 or `full`), `headLevel`, `tag` | `<Cell thread="rates"><p>...</p><button class="chip">Open tracker</button></Cell>` |
| `Bobbin` | `label`, one of `sku` (adds to the cart and opens the drawer), `href` (a link) or `type="submit"`; `variant` (`primary` indigo, `secondary` white with an indigo stitch), `compact`, `wide`, `ariaLabel`, `disabled`, any `data-*` | `<Bobbin label={t('home.hero.cta')} sku="SB101" />`, `<Bobbin label={t('cart.checkout')} href="/checkout" wide />` |
| `Disclaimer` | `compact`, `id` | `<Disclaimer />` (the section 12 text) |
| `CompactMembership` | `line` (the route's own one line), `id`, `entrance` | `<CompactMembership line={t('brief.compact.line')} />` |
| `SmsOptIn` | `variant` (`row` the full width inline row for Home, `card` stacked for the confirmation and the Texts card), `id` (`sms`) | `<SmsOptIn />`, `<SmsOptIn variant="card" id="sms-confirm" />` |
| `Picture` | `slot` (an ASSET_PLAN slot id), `alt` (overrides the drafted alt), `sizes`, `loading`, `fetchpriority`, `graded` (true), `decorative` | `<Picture slot="photo.about-hero" sizes="100vw" loading="eager" />` |
| `PageScene` | `kind` (the scene module name), `height`, `label` (an accessible name, else decorative), any `data-*` the scene reads | `<PageScene kind="contact-knot" height="120px" data-anchor="0.34" />` |
| `MotionControl` | `id` | already in the footer and the menu; add it nowhere else |
| kit `Knot` | `size` (24), `draw` (draws in when `.is-in` arrives), `label` | `<Knot size={16} />` beside a cell head |
| kit `Seal` | `size` (160 or 96), `animate` (weave in, true), `label` | `<Seal size={96} />` on About, the confirmation, a card corner |
| kit `ThreadStrip` | `compact`, `labels`, `id` | `<ThreadStrip />` (the five threads with per load sag) |
| kit `WeftPass` | none | under a heading (HeadingPass already draws one) |
| kit `Icon` | `name` (`rates cashback coupons seasonal paycheck goals texts archive your-moves roundup membership`), `size`, `label` | `<Icon name="roundup" size={18} />` |
| kit `Selvedge` | `id` (the seed, required), `orientation` (`horizontal | vertical`), `thickness` | `<Selvedge id="about-card" />` as a divider or a card edge |
| kit `Twill` | `tag`, `id` | `<Twill tag="section" class="pass">...</Twill>` (footer, membership ground, legal margins only) |
| kit `Spool` | `size` | the cart glyph (used in the band) |
| product `ProductToday`, `ProductRates`, `ProductGoals` | `phone` (the frameless 375 by 812 view), `interactive` (true), `label`, `id` | `<ProductRates />`, `<ProductToday phone />` |

Product views: the real dashboard HTML from the asset engine, CSS scoped under `.sb-app__stage` so nothing leaks, rendered at native size and scaled to the container. The toggles click, the filter chips switch, the action chips press. Wrap several in `<div data-product-group data-view="today">` with `[data-show-view="rates"]` controls to switch between them (the demo shows it). On /today, /rates and /goals the dashboard agent renders them full width (`interactive`) and rewires the tab links (`a[data-tab]`, real hrefs) and the app bar.

Plain classes you can use without a component: `.pass` (a five column row, full width), `.wide` (full width, gutter padding, no grid), `.pass--two` (a 3:2 two track pass for prose beside a module), `.span-2 .span-3 .span-4 .span-full .span-fill`, breakpoint overrides `.l-span-1 .l-span-2 .l-span-3 .l-span-full` (1024 to 1279) and `.m-span-1 .m-span-2 .m-span-full` (768 to 1023), `.prose-cols` (CSS multicolumn 34ch), `.pull-thread` (spans all prose columns), `.edge` (edge to edge inside a pass), `.bleed`, `.cell`, `.cell-head`, `.standfirst`, `.label`, `.muted`, `.small`, `.fig`, `.fig-em`, `.chip` (`.is-on`, `.is-pressed`), `.switch` with `.switch__track[role=switch]` `.switch__label` `.switch__state`, `.field` with `.field__label .field__hint .field__control .field__input .field__error` (`.is-error` on the field), `.error-summary`, `.check` (a 24px checkbox in a 44px target), `.graded` (the one grade for sourced media, never on product screens or the kit), `.sr-only`, `.live`.

## 7. THE FULL WIDTH RULE (3.17) and the width check

- Every row is a `.pass` or a `.board`: `width: 100%; max-width: none; padding-inline: var(--gutter); display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: var(--gap)`. Nothing is centred in a container. No `max-width` in px, rem, ch, vw, calc, min or max on any section level block; no `margin: 0 auto`; no `.container`; no `max(1720px, 86vw)`; no `min(100% minus two gutters, 1800px)`. Small things (images, icons, buttons, fields, the drawer panel) may cap their width.
- Long text is `.prose-cols` (two columns at 1280, three at 1440, four at 1920, five at 2560) or beside a module in `.pass--two`. Never a lone measure with butter either side. Each column of running text measures 30 to 55ch at the four widths.
- The collapse rules are built into `.pass` and `Board` (0.2): five columns at 1440 and up; five at 1280 to 1439 (prose boards use `.prose-cols` and get four); three plus two at 1024 to 1279 with the thread strip filling the spare track (`data-cells="5"`); two plus two plus one at 768 to 1023 (the fifth cell spans the row); one column under the sticky tab strip below 768. Spanning cells collapse with `.span-*` (span 3 becomes full at 1024 to 1279, everything spanning becomes full at 768 to 1023) and the boards use dense packing, so nothing sits empty; use the `.l-*` and `.m-*` overrides when a row needs a different fold.
- Butter is structural in five places only: the ground between and around the white boards, the heading passes, the two outer gutters, the hero and the footer's twill. No body prose on butter; no two adjacent butter rows.
- `node scripts/check-width.mjs` (part of `npm run build`) fails the build on any of the forbidden declarations in `src/**/*.css` and the `<style>` blocks of `src/**/*.astro`. Do not work around it.

## 8. Tokens

Colours (CSS custom properties on `:root`, nothing else anywhere): `--butter #F6E7A1`, `--butter-deep #EBD77A`, `--butter-pale #FBF3CF`, `--white`, `--indigo #2B2F8F`, `--indigo-deep #1B1E5C`, `--ink #14163A`, `--muted #4F5280`, and inside the product views only `--up #1F7A4D`, `--down #B3261E`, `--unchanged`, `--behind #8A5A00`; hairlines `--hairline`, `--hairline-soft`. Type: `--font-display` (Big Shoulders Display, variable 100 to 900) and `--font-ui` (Manrope, variable 200 to 800, `font-feature-settings: "tnum" 1` on the body), the fluid scale `--fs-h1 --fs-h2 --fs-h3 --fs-body --fs-standfirst --fs-label --fs-cell-head` built on `--vwc: min(1vw, 25.6px)`. Layout: `--gutter`, `--gap` (both `clamp(16px, 1.25vw, 32px)`), `--col`, `--reveal` (the butter reveal between boards), `--band-h` (84px, 64px below 768), `--tabstrip-h` (44px), `--radius-board 4px`, `--radius-card 12px`. Motion: `--ease-shuttle cubic-bezier(0.36, 0.01, 0.10, 1)`, `--ease-knot cubic-bezier(0.22, 1.12, 0.36, 1)`, `--dur-fast 0.11s`, `--dur-base 0.38s`, `--dur-slow 1.2s`, `--idle 11s`, `--glyph-stagger 18ms` (9ms below 768). Use only these curves and durations in CSS, GSAP and canvas; the eighteen sister curves of the exclusion brief are grepped for at QA. No uppercase, no letter spacing, no monospace, no kickers, no numbering.

## 9. Motion: entrances, hovers, scenes, the Tightening, the reduce motion contract

`src/scripts/motion.ts` is loaded once by the Layout and exposes `window.sbMotion` (`loadGsap, ensureScrollTimeline, initEntrances, initHovers, initScenes, initSurfaces, tighten, motionReduced, SHUTTLE, KNOT, DUR, EASE_CSS, tween, scenes`).

Entrances (one per row, distinct on the page; the weft pass wipe is the base language): put `data-entrance` on the row.
- `weft-left` and `weft-right`: MOT-018, `clip-path: inset(0 100% 0 0)` to `inset(0 0 0 0)` on the native scroll timeline (`animation-timeline: view(); animation-range: entry 0% cover 35%`, Shuttle), the self hosted polyfill `/assets/js/scroll-timeline.js` on Safari, an IntersectionObserver transition if neither works (`html.no-scroll-timeline`).
- `dock` (items rise and settle onto their warp positions, Knot), `knots` (items tie in, a scale with the overshoot), `stitch` (the row's stitches draw first, then the items fade in), `pop` (the knots pop, then the text wipes in): class based; the row gets `.is-in` when it enters the viewport and its items get `.ent-item` with `--i`. Items are the direct children unless `data-entrance-items=".cell"` names a selector; `data-stagger="70"` sets the per item delay in ms. `Board` sets `data-entrance-items=".cell"` for you.
- Anything else you invent for a row must still be built from these primitives (`.is-in`, `--i`, Shuttle and Knot at the three durations) and have a static end state.
- The Seal, the WeftPass and `<Knot draw />` draw themselves when they get `.is-in` (added by the motion system when they scroll into view, or by their row's entrance).

Text hovers: `hover="..."` on the Layout sets `data-hover` on the body and the class `hv-<kind>`; the CSS in motion.css applies the treatment to links, headings and `.hv` words on the page, mirrored on `:focus-visible` and `:active`. The assignment from 3.23: home `pluck` (the plucked thread, headings only, pointer only, keyboard gets a stitch outline), /brief `tighten` (wght 500 to 800), /membership `stitch` (a running stitch underline whose stitches run), /roundup `knot` (the first letter knots, 1.12 overshoot), /your-moves `lift` (the word lifts 2px on a thread shadow), /about `dye` (a butter dye wash behind the word), /contact `dash` (stitch dashes under links), /guides and the guide posts `unspool` (the thread underline unspools). The cart, the checkout, the dashboard and the legal pages use `none` (standard link states). Add `class="hv"` to a key phrase to include it.

Scenes: `<PageScene kind="x" />` mounts `src/scripts/scenes/x.ts`, which exports `default function mount(root) { return new MyScene(root) }` where `MyScene extends Scene` from `scenes/base.ts` and implements `resize()` and `frame(t, dt)` on `this.ctx` (a 2D canvas the size of the root, dpr capped at 1.5, 1.0 on touch). The base class pauses the loop offscreen and on hidden tabs, disposes on pagehide, redraws once on resize, and sets `this.reduced` (draw the static end state and return when it is true). `this.progress()` is the root's scroll progress through the viewport. The example is `contact-knot` (a knot tied at the address line). One scene per page, lazy after first paint, never the loom itself (the loom is Home's Three.js scene, which the home agent builds in its own module and registers with the loader through `window.sbLoader.track(fetchPromise, 'three')`).

The Tightening (TYP-003): `<h1 data-tighten>` runs once when fonts are ready and the heading is in view (grapheme spans via `Intl.Segmenter`, `--wght` through a registered `@property`, 500 to 800 left to right at 18ms per glyph, half on phones); `data-tighten="manual"` waits for `window.sbMotion.tighten(el)` (the home hero times it to the weft pass). Reduced motion renders 800 at once. Interior H1s arrive tight (no attribute).

The reduce motion contract: `prefers-reduced-motion: reduce`, the root attribute `data-motion="reduced"` (the footer and menu switch, persisted as `savebrew.motion`, restored before paint) and `?qa=rm` all give the static end state of every technique. In CSS write both selectors, `@media (prefers-reduced-motion: reduce)` and `:root[data-motion="reduced"]`; in JS call `motionReduced()` from `./ease` before animating and listen for the `data-motion` attribute if your scene runs long. Nothing essential is conveyed by motion or colour alone.

GSAP: `const { gsap, ScrollTrigger, Flip } = await window.sbMotion.loadGsap()` loads GSAP 3.12.5 core, ScrollTrigger and Flip from cdnjs once (deferred) and registers the eases `'shuttle'` and `'knot'`; use them by name and the durations `DUR.base / 1000` etc. No Lenis, no SplitText, no Draggable, no MorphSVG.

Surfaces: `selvedge(canvas, seed, { orientation })`, `twill(canvas)`, `threadStrip(canvas)` in `src/scripts/surfaces.ts`; the components above call them for you, and any `[data-selvedge]`, `[data-twill]` or `[data-threadstrip]` you add is picked up on load (call `window.sbMotion.initSurfaces(root)` for markup added later).

The loader: `src/scripts/loader.ts` draws the selvedge stitch down the left gutter on every route, bound to fonts, the parsed document, any `<img data-loader-track>` (decode) and anything registered through `window.sbLoader.track(promise, label)` before it finishes; ties off at ready, `document.documentElement.dataset.loaded = 'true'` and the `sb:ready` event fire; skip link "Go straight in" from 0s; hard cap 4s from navigation start; reduced motion renders complete and fades. It never covers content: keep the left gutter free of fixed elements.

## 10. The cart store

`src/scripts/cart.ts` (also `window.sbCart`): `get()`, `count()`, `subscribe(fn)` (fires at once), `add(sku)` (returns `{ kind: 'added' | 'replaced', state, previous }`), `setCadence('monthly' | 'yearly')` (swaps SB101 to SB102, SB201 to SB202 and back), `remove()`, and the words: `money(n)`, `product(state)`, `price(state)`, `charge(state)`, `line(state, pattern)`, `renewalSentence(state, { monthly, yearly })`, `cadenceNote(state, { monthly, yearly })`, `renewalDate(cadence)`, `dateInWords(date)`, `nextWeekday()`. `PRODUCTS` and `SKUS` hold the four SKUs (SB101 $7.99 monthly, SB102 $72 yearly, SB201 $11.98 monthly, SB202 $108 yearly), the names and the short names. Storage key `savebrew.cart` holding `{ sku, cadence, addedAt }`, an in memory fallback when storage throws, cross tab sync, quantity fixed at 1, one membership at a time.

Events on `document`: `sb:cart` (any change, detail the state), `sb:cart-add` (detail `{ kind, state, previous, trigger }`), `sb:cart-open` (opens the drawer). Any element with `data-add-sku="SB101"` adds and opens the drawer on click (the Bobbin's `sku` prop does this); any element with `data-cart-open` opens it. The drawer (`CartDrawer.astro`, `cart-drawer.ts`, `window.sbCartDrawer.open()/close()`) renders the line, today's charge, the renewal sentence, the tax line, the cadence radiogroup, Remove, "Go to checkout" and the empty state, announces the add, replace and remove strings, traps focus, closes on Escape. The commerce agent completes the drawer's scene (`[data-cart-scene]`, the knot sliding along a thread into the spool) and builds /cart, /checkout and /confirmation on the store.

## 11. Assets

```ts
import { picture, file, slot, isPresent, missingSlots, ALT, brand, kit } from '../lib/assets';
file('product.today-desktop')            // '/assets/product/today-desktop.webp'
file('video.product-pan', 'poster')      // '/assets/video/product-pan-poster.webp'
picture('photo.about-hero')              // { src, srcset, phoneSrcset, avif, width, height, alt, present }
```
`<Picture slot="..."/>` renders a real `<picture>` with the phone crop under 768 and the desktop srcset (800, 1200, 1600, 2400) with width and height, never a placeholder box. Thirteen slots are awaiting transfer from the asset engine (all photo.* slots and video.hero-loop); their markup is emitted for the named paths and `scripts/check-assets.mjs` prints a loud MISSING list in every build until the files land under `public/assets/photo` and `public/assets/video` (then run `npm run assets` or copy them in, and rebuild). Product shots, the product pan clip and poster, the fabric texture, the kit and the brand kit are present. Apply `.graded` to sourced and generated media only.

## 12. Rules that apply to every page

- The disclaimer: every content page renders `<Disclaimer />` where section 7 places it (visible without scrolling on /brief, above the fold on the guides, at the foot of /your-moves, beside the date on /roundup); the footer carries it too.
- The no dashes rule: no em dash, no en dash, no hyphen used as a dash, no double hyphen anywhere in shipped text, including microcopy you add, alt text, aria labels, titles and the product UI. Hyphens survive only in code, URL slugs, CSS custom properties, autocomplete tokens, the verbatim SMS block and the verbatim legal text. Compound words are written open (high yield, two click, sign in, opt in, 30 day). `node scripts/check-dashes.mjs` runs before every build.
- The refused vocabulary (Offering Spec 16, Art Direction 3.24): plan, never, every, sample, calendar, month, log, row, figure, page, guaranteed, hack, "you should", "we saved you", subscribe, free member, and the exclusion brief's list (file, desk, day, kept, keep, killed, cite, nothing, memo, queue, tape, receipt, gate, climb, base camp, switchback, route); the excluded CTA verbs Purchase, Buy, Use, Subscribe, Order, Run, Start, Empty, Check, Compare, Read, See, Submit (Submit only as the verbatim SMS button). Exceptions: "Daily" as the product name, "12 month CD", "this month" in the fixed Seasonal item, "subscribed" in the compliance flow copy. Words the site uses: brief, thread, pass, morning, weekday, tracked, membership, reader, deposit, illustrative. Voice: the obsessive craftsman, first person plural for the work, second person for the reader's money, questions as headings.
- Compliance: 660 American Ave, King Of Prussia, PA 19406, (888) 338 8809 (spaced; hyphenated only inside the verbatim SMS block and the legal text; href tel:+18883388809), support@savebrew.com; SaveBrew Inc.; [EIN Address] and [INSERT SHORT CODE] only on /terms and /privacy; no testimonials, press, ratings or social links; the SMS block only through `<SmsOptIn>`; no SMS consent on the checkout; no scarcity, countdown, preselection, confirmshaming or retention wall.
- No hairline grid, no column rules, no numbered lists with numerals, no kickers, no MOST POPULAR badge, no $0 card, no candour section, no fade up reveals, no lift and depress and breathe, no pinned hero.
- Keep `src/routes/index.ts` and `src/data/add.json` the only shared files you edit; everything else you add is yours.

## 13. The shoot script

`node scripts/shoot.mjs <route> <widths> [--rm] [--fold]` starts the dev server if none is running, fulfils the cdnjs requests (GSAP, Three.js) from node_modules so motion runs in the sandbox, scrolls through the page so every entrance fires, takes `shots/<route>-<width>-fold.png` (the first viewport) and `shots/<route>-<width>.png` (the full page, taken from the foot of the page so scroll driven reveals are complete), and reports horizontal overflow, any row narrower than the viewport minus two gutters, any `max-width` on a section level block, dashes in the rendered text and console errors (the 404s for the awaiting photos are expected until the files land). `--rm` shoots the reduced motion path (`?qa=rm`). Look at the PNGs with the Read tool; do not trust the code alone.

## 14. Definition of done for a page

Every item, observed on the served page: its own scene (`PageScene`, distinct kind, paused offscreen, static under reduced motion); its own text hover from the table in section 9; a distinct entrance per section, none repeated on the page; every button, link, heading, card, chip, toggle, icon and field moves (idle, hover or focus, press) on Shuttle and Knot; at least one photo slot through `<Picture>`; the disclaimer where section 7 places it; head hygiene (the `head.*` title and description, canonical, noindex where listed, RSS where public); screenshots at 1280, 1440, 1920, 2560 and 375 looked at, with no empty outer third, no overflow, no butter block of running text taller than 40 percent of the viewport, no lone measure; no dashes; every string from copy.md, the long form or an `add.` string; `npm run build` green with both checks.

## 15. What the foundation did not build (the page agents' boundaries)

Not built here, stubs only: Home (the loom, THE PASS, the Tightening on the H1, the week strip, the FAQ index, PULL A THREAD at 375, the `?qa=arc` hook); every interior page (/brief, /membership with the cadence control and the cards, /roundup and the issue address and its RSS feed, /guides and the four guide posts and their feed, /your-moves and the ranker with Flip, /about, /contact and its form); the commerce pages (/cart, /checkout with the GOV.UK validation and Luhn, /confirmation), the drawer's scene; the dashboard (/today, /rates, /goals, /archive, the demo sign in, the membership panel, the two click cancellation, the Texts card); /sign-in; the legal pages /terms and /privacy; the designed 404 with its guide search; the RSS files; the Three.js loom and its vendored line classes wiring (the file `/assets/js/three-lines-r128.js` is present). The home hero's poster (`video.hero-loop` poster) is an awaiting asset.
