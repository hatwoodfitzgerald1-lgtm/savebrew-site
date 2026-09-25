# B1 (home) shared changes and the MembershipRow usage

## MembershipRow (ready for B2)

`src/components/MembershipRow.astro`, the "What does it cost?" row (Art Direction 3.23 item 3, Offering Spec 10.4).

```astro
---
import MembershipRow from '../components/MembershipRow.astro';
---
<MembershipRow />                       <!-- Home: renders its own heading pass "What does it cost?" (id="cost") then the row (id="cost-row") -->
<MembershipRow heading={false} />       <!-- /membership: render your own <HeadingPass title={t('membership.heading')} .../> above it -->
<MembershipRow compact />               <!-- tighter paddings and label sized inclusion text; everything still printed -->
```

Props: `compact` (false), `heading` (true), `id` ('cost': the heading pass id; the row itself is `${id}-row`), `class`, `entrance` ('weft-cards', its own entrance built from the weft pass primitive: the cadence control, the Daily, the Daily for Two, then the free column wipe in on Shuttle, and the cadence toggles click once on Knot).

What it renders: a `section.membership.pass.twill` (the twill is the row's ground) with
- the cadence control (`role="radiogroup"`, aria `membership.cadence.aria`, Monthly | Yearly, monthly by default, two threads that ply on Knot, arrow keys move the pick) and the note `membership.cadence.note`;
- `article#daily` (columns one to two) and `article#daily-for-two` (three to four): name, audience, price line (both prices), renewal sentence (same weight as the price), arithmetic line, "Included, in full:" and the eight or eleven inclusions with their description lines marked by the knot, the tax and fees line, the refund line, the Seal at 96px in the corner, and one Bobbin whose label and SKU follow the cadence (`Add the Daily to my cart` / `Add a year of the Daily to my cart`, SB101 / SB102; `Add the Daily for Two to my cart` / `Add a year of the Daily for Two to my cart`, SB201 / SB202). The Bobbin uses the foundation's `data-add-sku` path, so it adds to the cart store and opens the drawer.
- `aside.membership__free` (column five) on the twill with `photo.membership-free-column` behind it at 30 percent, the H3 `home.cost.free.heading`, the line and the three links (/roundup, /guides, /your-moves).

The footer links `/membership#daily` and `/membership#daily-for-two` resolve to the two cards.
Collapse: two columns (the two cards side by side, the free column across the foot) from 1279 down; one column below 768.
The script is idempotent (`window.sbMembershipRow.init(root)` for markup added later); it reads `data-cadence` on the row, so `data-cadence="yearly"` could preselect yearly, but the spec says monthly by default, so leave it.

## Shared files touched (additive only)

1. `src/components/kit/Twill.astro`: forwards any `data-*` and `aria-*` attribute to the rendered tag (needed for `data-entrance`, `data-entrance-items`, `data-cadence` and `aria-label` on the membership row's twill section). No rename, no removal; existing usages are unchanged.
2. `src/components/Board.astro`: forwards any extra `data-*` prop to the board element (Home's dashboard board needs `data-product-group` and `data-view`, and the docking board its own hook). Existing usages are unchanged.
3. `src/data/add.json`: one string appended, `add.home.dashboard.demo.link` "Open the demo dashboard" (design document 7.1 row 5, the title of the still links, used as the link text under the live views).
4. `src/routes/index.ts`: only the `'/'` line (now `{ component: Home }`) and the `Home` import.
5. `scripts/shoot.mjs`: (a) the dev server's `/@vite/client` is answered with an inert HMR stub inside the shoot, because with three agents saving files the HMR client reloaded the page mid shoot ("Execution context was destroyed"); it does nothing in production; (b) the scroll through waits 220ms per step and 1.2s at the foot instead of 90ms and 600ms, so IntersectionObserver driven entrances finish before the full page capture (the ranker heading pass came out blank at 90ms).
6. `/home/claude/savebrew/assets/ASSET_PLAN.json` and `src/data/asset-plan.json`: the slot `scene.loom-poster` (`/assets/scene/loom-poster.webp`, 1600 by 1000, shipped) appended.

## Notes for the other agents

- Home's classes are namespaced `hm-` (`hm-hero`, `hm-week`, `hm-dash`, `hm-free`, `hm-faq`, `hm-today-*`, `hm-loom`) because the catch all imports every route, so every page's `<style is:global>` lands on every page: an unprefixed `.dash` collided with the dashboard shell's `.dash` at first. Prefix yours too if a plain class name is at risk.
- The week strip's five weekday columns are an intentional horizontal scroller at 375 (80vw each, per 7.1 mobile notes); scripts/shoot.mjs lists them as "overflowing elements" at 375 because the audit looks at each element's own overflow, not the scroller's. The page itself has no horizontal scroll (scrollWidth equals the viewport).
- The hero loop (`video.hero-loop`) is still awaiting transfer: the `<video>` in the week strip points at `/assets/video/hero-loop.mp4`, `hero-loop-720.mp4` and the poster; it was built and tested against a temporary ffmpeg stand in that has been removed. When the files land, `npm run assets` and rebuild; nothing else changes.
