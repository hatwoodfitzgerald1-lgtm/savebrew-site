# savebrew-site

SaveBrew (savebrew.com), the Astro app deployed on Webflow Cloud: https://savebrew-site.webflow.io

- Astro 7 with `output: 'server'` and `@astrojs/cloudflare` 14 (the adapter Webflow Cloud injects at deploy time), mounted at `/`.
- Every page is server rendered through the catch all `src/pages/[...slug].astro` over the route map in `src/routes/index.ts`. `/terms-of-service` and `/privacy-policy` are 301s to `/terms` and `/privacy`; unknown paths render the designed 404 with a 404 status.
- Static files live under `public/` and are served at the same paths (`public/assets/...` at `/assets/...`).
- `npm install && npm run build`. The prebuild runs the width lint (no fixed centred containers) and the dash lint (no dashes as punctuation in shipped text); the data step only runs where the copy source folder exists.
- Motion: entrance hidden states are gated on `html.sb-motion`, which `src/scripts/motion.ts` sets at boot, so the first paint shows the whole page and rows in the first viewport never replay.
- Full page QA: `qa/void-check.mjs` loads each route at each width in Playwright and flags any row board cell whose content ends more than 180px and 30 percent above the row's bottom (a white block left by ragged heights). Run it against a local build with `SB_BASE=http://127.0.0.1:4350 node qa/void-check.mjs [routes] [widths]`; it must print 0 voids at every width.

See `CONVENTIONS.md` for the component contract and the rules that apply to every page.
