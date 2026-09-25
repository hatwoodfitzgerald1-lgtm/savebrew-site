# Changes by page agent B3 (the cart, the checkout, the confirmation, the sign in, the dashboard, the legal pages)

Additive only; nothing shared was renamed or removed. No dashes are used as punctuation in anything shipped.

## Shared files touched (targeted edits)

- `src/routes/index.ts`: the eleven B3 stub lines replaced (`/cart`, `/checkout`, `/confirmation`, `/today`, `/rates`, `/goals`, `/archive`, `/sign-in`, `/terms`, `/privacy`) and their imports added at the top.
- `src/data/add.json`: the `add.` strings the design document quotes for these routes (7.16 to 7.20, 7.19 archive controls, the saved item texts and dates, the sign in preview line, the footer line inside the frame, the legal contents label) plus the dashboard microcopy copy.md has no id for (the Add a goal form and its GOV.UK errors, Adjust the deposit, Apply to a goal, the worksheet cells and its three questions, the alert lines, the archive open and close labels). All in the craftsman voice, no refused words, no dashes.
- `src/components/CartDrawer.astro`: the scene slot now mounts the scene (`data-scene="cart-spool"` plus a `<canvas>`), a visible `[data-cart-message]` line for the add, replace and remove strings, and the CSS for both.
- `src/scripts/cart-drawer.ts`: `say()` shows the add, replace and remove lines in the drawer as well as announcing them; the line clears on close.
- `src/components/product/ProductView.astro`: a `page` prop (the view laid out as a real page: unscaled, full width, its own height, the frame's radius and hairline outline, frameless under 768) with its CSS; `ProductToday`, `ProductRates`, `ProductGoals` accept `page` in their Props.
- `src/scripts/product-ui.ts`: page mode skips the scale and toggles `.is-phone` on the stage when the app is under 700px wide.

## New files (B3's own)

- Routes: `src/routes/cart.astro`, `checkout.astro`, `confirmation.astro`, `sign-in.astro`, `today.astro`, `rates.astro`, `goals.astro`, `archive.astro`, `terms.astro`, `privacy.astro`.
- Components: `src/components/dashboard/DashboardShell.astro` (the app frame, the gate, the SMS holder, the playbook sheet, the templates' CSS), `MembershipPanel.astro` (the two click cancellation sheet), `ArchiveView.astro` (the archive in the product's own system); `src/components/legal/LegalPage.astro`.
- Scripts: `src/scripts/session.ts` (the order and the demo session stores), `cart-view.ts` (/cart), `checkout.ts`, `card-fields.ts` (Luhn, grouping, expiry, CVV), `confirmation.ts`, `signin.ts`, `dashboard.ts` (the shell: gate, app bar, bell tooltip, avatar menu, tab thread strip, membership panel, sign out), `dash-today.ts`, `dash-rates.ts`, `dash-goals.ts`, `dash-archive.ts`.
- Scenes: `src/scripts/scenes/cart-spool.ts`, `checkout-stitch.ts`, `confirm-tie.ts`, `signin-stitch.ts`, `dash-strip.ts`, `legal-twill.ts`.
- Styles: `src/styles/commerce.css` (the select control in the field language, the check field).
- Data: `src/data/legal.json`, built by `scripts/build-legal.mjs` from the design document's section 8 (verbatim between the VERBATIM markers; rerun the script if section 8 changes; it is not wired into `npm run data`, so package.json is untouched).
- QA: `qa/buy-path.mjs` (the end to end test) and its report `qa/buy-path.md`; `qa/shot.mjs` (screenshots with seeded state: `--cart=SB101`, `--order=SB201`, `--session`, `--click`, `--rm`); `qa/measure-legal.mjs`.

## Things the foundation team may want to know

- Chromium's IntersectionObserver reports no intersection for an element whose `clip-path` clips it to nothing, so an entrance that starts at `inset(0 100% 0 0)` and waits for `.is-in` on the same element never fires. The `html.no-scroll-timeline` fallback for `weft-left` and `weft-right` in motion.css has this shape (it only matters on browsers without scroll timelines and without the polyfill). The legal pages put the clip on a child and observe the wrapper.
- `shoot.mjs`'s "rows narrower than the viewport" audit flags the SMS card (`<section class="sms sms--card">`) wherever it sits inside a cell (the confirmation, the Texts card), because it is a `section`. It is a card, not a row.
- The `Board` component does not pass extra attributes through, so the cart page and the sign in page compose the board markup by hand (`.board.pass` plus `ThreadStrip` and `Selvedge`) where a `data-*` hook was needed on the row.
- The archive index has nine dated briefs, which is what the long form carries (today, yesterday, Monday and Tuesday of this week, and last week's five); the design document's 7.19 lists nine as well.
- The Goals view recomputes a goal's status only when its deposit is adjusted or a goal is added, so the Offering Spec's illustrative statuses stand as shipped.
