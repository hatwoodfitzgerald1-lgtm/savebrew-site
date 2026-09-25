// The asset slot contract (ASSET_PLAN.json, design document 5.2). Every slot id resolves to real files
// under /assets/... The plan is bundled (src/data/asset-plan.json) and the build time file check is
// src/data/asset-status.json (scripts/check-assets.mjs), so nothing here touches the filesystem at
// request time (the site is server rendered on Cloudflare, where there is no filesystem).
import plan from '../data/asset-plan.json';
import status from '../data/asset-status.json';

export type SlotId = string;
export interface Slot {
  id: SlotId;
  role: string;
  aspect: string | { desktop: string; phone: string };
  lives_on: string[];
  files: Record<string, string>;
  status: string;
  crop_note: string | null;
}
const slots: Record<string, Slot> = {};
for (const s of (plan as any).slots as Slot[]) slots[s.id] = s;

const STILL_WIDTHS = [800, 1200, 1600, 2400];
const PHONE_WIDTHS = [800, 1200];

/** Drafted alt text per slot (optimise.py ALT table, corrected against the real image on arrival). Pass alt to <Picture> to override. */
export const ALT: Record<string, string> = {
  'video.hero-loop': 'Silent loop of cloth at macro: pale cotton warp threads under tension on a loom, indigo denim twill in raking light, a single indigo thread drawn taut across undyed cloth, and the stitched selvedge of a bolt of canvas unrolling on a table.',
  'video.product-pan': 'A slow pan across the three SaveBrew dashboard views, Today, Rate Tracker and Goals, as a text alert toggle switches on, Bank A\'s seven day change ticks to plus 0.05 and the Emergency fund bar fills to 60 percent. Illustrative figures.',
  'photo.about-hero': 'Undyed cotton canvas seen from above, a fine indigo selvedge stitch running along one edge, in warm morning light.',
  'photo.membership-free-column': 'A wooden spool of indigo cotton thread on pale linen, one thread trailing out of frame.',
  'photo.todays-pass-heading': 'Five parallel indigo threads laid across raw white canvas, one of them tied in a small knot.',
  'photo.ranker-edge': 'A wooden loom reed with pale warp threads passing through its slots, dust catching the morning light.',
  'photo.roundup-header': 'Indigo denim folded once, the fold catching warm light and showing the diagonal twill weave.',
  'photo.guides-header': 'A stack of folded pale cotton cloths in plain, twill and herringbone weaves, edges aligned, in soft window light.',
  'photo.contact-side': 'A running stitch in indigo thread along the hem of pale linen, each stitch slightly irregular.',
  'photo.404': 'A single loose indigo thread curling across white canvas.',
  'photo.guide-hero.make-a-rotating-category-pay': 'A single indigo thread looping back on itself once on pale canvas.',
  'photo.guide-hero.the-national-average-is-a-warning': 'Two threads side by side on raw canvas: one thin and pale, one thick and indigo.',
  'photo.guide-hero.four-percent-against-the-account-you-have': 'The woven edge of a cloth measuring tape lying across indigo denim, no numbers legible.',
  'photo.guide-hero.why-patio-furniture-is-cheap-in-october': 'Four small knots tied at even intervals along one indigo thread on pale linen.',
  'product.today-desktop': 'The Today view of the SaveBrew dashboard for the illustrative member Jordan: the greeting, the rate strip, five brief items marked by thread, the goal snapshot, the text switches and this week\'s counts. Illustrative figures.',
  'product.rates-desktop': 'The Rate Tracker view of the SaveBrew dashboard: seven illustrative accounts from Bank A at 4.00 percent to Bank G at 3.40 percent with seven day changes, and the Bank A detail with its 30 day line. Illustrative figures.',
  'product.goals-desktop': 'The Goals view of the SaveBrew dashboard: Emergency fund at $6,000 of $10,000, Holiday spending at 67 percent, New laptop at 29 percent, and check ins by text. Illustrative figures.',
  'product.today-phone': 'The Today view of the SaveBrew dashboard at phone width: the greeting, the rate tiles and the first brief items. Illustrative figures.',
  'product.rates-phone': 'The Rate Tracker view of the SaveBrew dashboard at phone width: filter chips and stacked account rows. Illustrative figures.',
  'product.goals-phone': 'The Goals view of the SaveBrew dashboard at phone width: the Emergency fund card at 60 percent. Illustrative figures.',
  'texture.fabric': 'A pale butter plain weave cotton texture.'
};

const warned = new Set<string>();
function warnMissing(id: string) {
  if (warned.has(id)) return;
  warned.add(id);
  const s = (status as any).slots?.[id];
  const paths = s ? Object.values(s.files).map((f: any) => f.path).join(', ') : '';
  console.warn(`\n[assets] MISSING SLOT ${id} (${paths}): the markup is emitted for the named paths; the file must land under public/assets before deploy.\n`);
}

export function slot(id: SlotId): Slot {
  const s = slots[id];
  if (!s) throw new Error(`[assets] unknown slot id "${id}" (see src/data/asset-plan.json)`);
  return s;
}
export function isPresent(id: SlotId): boolean {
  return !!(status as any).slots?.[id]?.present;
}
export const missingSlots: string[] = (status as any).missing || [];
export const twillPreRendered: boolean = !!(status as any).twill;

function ratio(aspect: string): number {
  const [w, h] = aspect.split(':').map(Number);
  return w / h;
}
export function aspects(id: SlotId): { desktop: string; phone: string | null } {
  const a = slot(id).aspect;
  if (typeof a === 'string') return { desktop: a, phone: null };
  return { desktop: a.desktop, phone: a.phone || null };
}

export interface PictureSources {
  src: string;
  srcset: string;
  phoneSrcset: string | null;
  avif: string | null;
  width: number;
  height: number;
  phoneWidth: number | null;
  phoneHeight: number | null;
  alt: string;
  present: boolean;
}
/** The srcset and dimensions for a photo slot. Emits the named renditions whether or not they exist yet; warns when the slot is missing. */
export function picture(id: SlotId, alt?: string, baseWidth = 1600): PictureSources {
  const s = slot(id);
  const st = (status as any).slots?.[id];
  const present = !!st?.present;
  if (!present) warnMissing(id);
  const base = s.files.src.replace(/\.webp$/, '');
  const desktopWidths = present && st.renditions.desktop.length ? st.renditions.desktop : STILL_WIDTHS;
  const phoneWidths = present && st.renditions.phone.length ? st.renditions.phone : PHONE_WIDTHS;
  const { desktop, phone } = aspects(id);
  const r = ratio(desktop);
  const width = baseWidth;
  const height = Math.round(baseWidth / r);
  const srcset = desktopWidths.map((w) => `${base}-${w}.webp ${w}w`).join(', ');
  const phoneSrcset = phone ? phoneWidths.map((w) => `${base}-phone-${w}.webp ${w}w`).join(', ') : null;
  const avif = present && st.renditions.avif.length ? `${base}-1600.avif` : null;
  return {
    src: desktopWidths.includes(1600) ? `${base}-1600.webp` : s.files.src,
    srcset, phoneSrcset, avif, width, height,
    phoneWidth: phone ? 1200 : null,
    phoneHeight: phone ? Math.round(1200 / ratio(phone)) : null,
    alt: alt ?? ALT[id] ?? '',
    present
  };
}
/** A plain file path for a slot (product shots, video, posters, texture): file('product.today-desktop') or file('video.hero-loop', 'poster'). */
export function file(id: SlotId, key = 'src'): string {
  const s = slot(id);
  const p = s.files[key];
  if (!p) throw new Error(`[assets] slot ${id} has no file "${key}" (has: ${Object.keys(s.files).join(', ')})`);
  if (!isPresent(id)) warnMissing(id);
  return p;
}
export const brand = {
  primary: '/assets/brand/logo/savebrew-primary-currentcolor.svg',
  reversed: '/assets/brand/logo/savebrew-reversed.svg',
  stacked: '/assets/brand/logo/savebrew-stacked.svg',
  stackedReversed: '/assets/brand/logo/savebrew-stacked-reversed.svg',
  icon: '/assets/brand/logo/savebrew-icon.svg',
  knot: '/assets/brand/logo/savebrew-knot.svg',
  wordmark: '/assets/brand/logo/savebrew-wordmark.svg',
  og: '/assets/brand/og-1200x630.png',
  favicon: {
    svg: '/assets/brand/favicon/favicon.svg',
    png32: '/assets/brand/favicon/favicon-32.png',
    png16: '/assets/brand/favicon/favicon-16.png',
    ico: '/assets/brand/favicon/favicon.ico',
    apple: '/assets/brand/favicon/apple-touch-icon-180.png'
  }
};
export const kit = {
  knot: '/assets/kit/knot.svg',
  seal: '/assets/kit/selvedge-seal.svg',
  threadStrip: '/assets/kit/thread-strip.svg',
  weftPass: '/assets/kit/weft-pass.svg',
  looseThread: '/assets/kit/404-loose-thread.svg',
  icon: (name: string) => `/assets/kit/icons/${name}.svg`,
  guideGraphic: (slug: string) => `/assets/kit/guide-graphics/${slug}.svg`
};
