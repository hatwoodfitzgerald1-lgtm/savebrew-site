# CHANGES-B2: shared changes by page agent B2 (the ranker, /your-moves, /brief, /membership, /roundup, /guides, the guide posts, /about, /contact, the 404)

Additive only. Nothing shared was renamed or removed.

## The ranker (usable by B1 on the home page now)

- `src/lib/ranker.ts`: the deterministic logic (score, reasonFor, rank, order, listText). Pure, no DOM; used by the server render and the browser.
- `src/scripts/ranker.ts`: the client (switches, the Flip re rank on Knot 0.38s, the state line in an aria-live region, Copy this list, Print this list, the `sb:rank` event for the scene, `window.sbRanker.rankers[]` for QA with `setAll([...six booleans])`).
- `src/components/ranker/Ranker.astro`: the full page version. Props: `variant` ('full' default | 'embed'), `id` ('ranker'), `class`, `photo` (the photo.ranker-edge slot beside the toggles, true on the full version).
- `src/components/ranker/RankerEmbed.astro`: the compact home version: `<RankerEmbed />` (id `ranker-embed`): the six switches and the ranked four only, with the link line "Open Your moves" to /your-moves. No photo, no rest list, no CTA, no disclaimer. Place it under the home heading pass "Which threads should you pull first?" (`moves.heading`). Its board carries its own entrances (`tighten` on the toggles, `lift` on the list), built from the primitives; the home page should not put a second `data-entrance` around it.
- `src/scripts/scenes/moves-threads.ts`: the /your-moves scene (`<PageScene kind="moves-threads" data-for="ranker" />`); it listens for `sb:rank` and reads the ranker root's `data-order`. Home keeps the loom and does not need it.

## motion.css

- The `.hv-lift` text hover rules now exclude `.band *`, `.menu *` and `.tabstrip *`: the rule's `display: inline-block` was overriding the heading band's `display: none` on `.band__membership` (the phone only Membership link showed at desktop on /your-moves) and it drew a border under every nav link. Two selectors extended with `:not(...)`, nothing else touched.
- `.hv-knot .cell-head { gap: 0 }` with a 6px margin on the head's knot or icon instead: the knot hover wraps the first grapheme in a span, which a flex `gap` separated from the rest of the word ("R ates"). Two rules added after the knot hover rules; nothing else touched.

## src/data/add.json (appended, verbatim from the design document where it names an add. id)

- `add.guides.column.coupons.line`, `add.guides.column.paycheck.line` (7.5), `add.guides.column.coupons.link` ("Open today's brief", the link label 7.5 gives for the Coupons column), `add.about.compact.line` (7.11), `add.notfound.search.empty` (7.23), and `add.contact.form.preview` ("This preview does not send messages yet: email support@savebrew.com and a person will read it.", the honest line under the contact form's success state on this preview; remove it when the form posts somewhere live).

## New files (mine)

- Routes: `src/routes/your-moves.astro`, `brief.astro`, `membership.astro`, `roundup.astro` (both /roundup and /roundup/2026-09-19 through `props.issue`), `guides.astro`, `guide.astro` (the four posts through props: slug, titleId, metaId, figure, hv), `about.astro` (prop `referralFeesConfirmed`, false in the route map: the "How are items chosen?" no claim variant ships; flip it in `src/routes/index.ts` on the owner's confirmation), `contact.astro`, `not-found.astro` (the `notFound` entry).
- Scenes: `src/scripts/scenes/moves-threads.ts`, `brief-weft.ts`, `membership-ply.ts`, `roundup-thread.ts`, `guide-spool.ts` (the guides family, with the four per post figures through `data-figure`), `about-seal.ts`, `notfound-thread.ts`. /contact uses the foundation's `contact-knot`.
- `src/scripts/contact-form.ts`, `src/lib/ranker.ts`, `src/scripts/ranker.ts`, `src/components/ranker/*`.
- RSS: `scripts/feed-xml.mjs` (the builder), `scripts/build-feeds.mjs` (writes `public/roundup/feed.xml` and `public/guides/feed.xml`; rerun after `npm run data` when the long form changes), `src/pages/roundup.xml.ts` (the same Roundup feed as a server route at /roundup.xml).
- QA: `scripts/qa-b2/ranker-test.mjs` (drives the ranker), `misc-test.mjs` (the 404 search, the contact form, the yesterday strip, the guide word counts, the cadence control), `probe.mjs`, and `shoot-b2.mjs` (a copy of scripts/shoot.mjs made while the shared script was mid edit; the shared one is untouched).
