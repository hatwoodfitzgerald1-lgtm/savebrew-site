// The route map the server rendered catch all (src/pages/[...slug].astro) resolves against. Every planned
// path is here; a page agent replaces its Stub entry with the finished page component (see CONVENTIONS.md,
// "Adding a route"). Paths are matched without a trailing slash; the two legal aliases 301 to /terms and /privacy.
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import { t } from '../lib/copy';
import Stub from './Stub.astro';
import Demo from './_demo.astro';
import Home from './home/Home.astro';
import Cart from './cart.astro';
import Checkout from './checkout.astro';
import Confirmation from './confirmation.astro';
import SignIn from './sign-in.astro';
import Today from './today.astro';
import Rates from './rates.astro';
import Goals from './goals.astro';
import Archive from './archive.astro';
import Terms from './terms.astro';
import Privacy from './privacy.astro';
import YourMoves from './your-moves.astro';
import Brief from './brief.astro';
import Membership from './membership.astro';
import Roundup from './roundup.astro';
import Guides from './guides.astro';
import Guide from './guide.astro';
import About from './about.astro';
import Contact from './contact.astro';
import NotFound from './not-found.astro';

export interface RouteEntry {
  component: AstroComponentFactory | any;
  props?: Record<string, unknown>;
  status?: number;
}
const stub = (name: string, titleId: string, metaId: string, noindex = false): RouteEntry => ({
  component: Stub,
  props: { name, title: t(titleId), description: t(metaId), noindex }
});

export const aliases: Record<string, string> = {
  '/terms-of-service': '/terms',
  '/privacy-policy': '/privacy'
};

export const routes: Record<string, RouteEntry> = {
  '/': { component: Home },
  '/brief': { component: Brief },
  '/membership': { component: Membership },
  '/roundup': { component: Roundup },
  '/roundup/2026-09-19': { component: Roundup, props: { issue: '2026-09-19' } },
  '/guides': { component: Guides },
  '/guides/make-a-rotating-category-pay': { component: Guide, props: { slug: 'make-a-rotating-category-pay', titleId: 'head.guide.rotating.title', metaId: 'head.guide.rotating.meta', figure: 'loop', hv: 'loop' } },
  '/guides/the-national-average-is-a-warning': { component: Guide, props: { slug: 'the-national-average-is-a-warning', titleId: 'head.guide.average.title', metaId: 'head.guide.average.meta', figure: 'two-threads', hv: 'thicken' } },
  '/guides/four-percent-against-the-account-you-have': { component: Guide, props: { slug: 'four-percent-against-the-account-you-have', titleId: 'head.guide.fourpercent.title', metaId: 'head.guide.fourpercent.meta', figure: 'tape', hv: 'measure' } },
  '/guides/why-patio-furniture-is-cheap-in-october': { component: Guide, props: { slug: 'why-patio-furniture-is-cheap-in-october', titleId: 'head.guide.patio.title', metaId: 'head.guide.patio.meta', figure: 'twelve-knots', hv: 'knots' } },
  '/your-moves': { component: YourMoves },
  '/about': { component: About, props: { referralFeesConfirmed: false } },
  '/contact': { component: Contact },
  '/cart': { component: Cart },
  '/checkout': { component: Checkout },
  '/confirmation': { component: Confirmation },
  '/today': { component: Today },
  '/rates': { component: Rates },
  '/goals': { component: Goals },
  '/archive': { component: Archive },
  '/sign-in': { component: SignIn },
  '/terms': { component: Terms },
  '/privacy': { component: Privacy },
  '/_demo': { component: Demo, props: {} }
};

/** The designed 404 (the 404 page agent replaces the Stub). Served with a 404 status for every unknown path. */
export const notFound: RouteEntry = {
  component: NotFound,
  props: {},
  status: 404
};

export function resolve(pathname: string): RouteEntry & { path: string; status: number } {
  let path = pathname.replace(/\/+$/, '') || '/';
  if (path.length > 1 && /^\/[A-Z]/.test(path)) path = path.toLowerCase();
  const entry = routes[path];
  if (entry) return { ...entry, path, status: entry.status || 200 };
  return { ...notFound, path, status: 404 };
}
