// The heading band (6.1): hides on scroll down and returns on scroll up, the mobile menu (a full height white
// sheet with a weft pass wipe, focus trapped, Escape closes), the sticky five thread tab strip below 768
// (tapping a thread scrolls to that thread's cell in the current row), the spool count from the cart store,
// and the compact Bobbin that adds SB101 and opens the drawer.
import cart from './cart';
import { motionReduced } from './ease';

const band = document.querySelector<HTMLElement>('[data-band]');
const body = document.body;

// ---- hide on scroll down, return on scroll up
if (band) {
  let lastY = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const h = band.offsetHeight;
      if (y > lastY + 6 && y > h * 1.5 && !body.classList.contains('menu-open') && !body.classList.contains('cart-open')) band.classList.add('is-hidden');
      else if (y < lastY - 6 || y <= h) band.classList.remove('is-hidden');
      lastY = y;
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  band.addEventListener('focusin', () => band.classList.remove('is-hidden'));
}

// ---- the spool count
const counts = document.querySelectorAll<HTMLElement>('[data-cart-count]');
const cartButtons = document.querySelectorAll<HTMLElement>('[data-cart-open]');
cart.subscribe((state) => {
  const n = state ? 1 : 0;
  counts.forEach((el) => { el.textContent = String(n); el.classList.toggle('is-empty', n === 0); });
  cartButtons.forEach((b) => {
    const empty = b.dataset.ariaEmpty || 'Cart, empty';
    const pattern = b.dataset.ariaPattern || 'Cart, {count} membership';
    b.setAttribute('aria-label', n ? pattern.replace('{count}', String(n)) : empty);
  });
});

// ---- adding from the band's compact Bobbin (and any [data-add-sku] control anywhere)
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-add-sku]');
  if (!btn) return;
  e.preventDefault();
  const sku = btn.dataset.addSku as any;
  const result = cart.add(sku);
  document.dispatchEvent(new CustomEvent('sb:cart-add', { detail: { ...result, trigger: btn } }));
  document.dispatchEvent(new CustomEvent('sb:cart-open', { detail: { trigger: btn } }));
});
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-cart-open]');
  if (!btn) return;
  e.preventDefault();
  document.dispatchEvent(new CustomEvent('sb:cart-open', { detail: { trigger: btn } }));
});

// ---- the mobile menu
const menu = document.querySelector<HTMLElement>('[data-menu]');
const openBtn = document.querySelector<HTMLElement>('[data-menu-open]');
let lastFocus: HTMLElement | null = null;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
function openMenu() {
  if (!menu) return;
  lastFocus = document.activeElement as HTMLElement;
  menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add('is-open'));
  body.classList.add('menu-open');
  openBtn?.setAttribute('aria-expanded', 'true');
  band?.classList.remove('is-hidden');
  const first = menu.querySelector<HTMLElement>(FOCUSABLE);
  (first || menu).focus();
}
function closeMenu() {
  if (!menu || menu.hidden) return;
  menu.classList.remove('is-open');
  body.classList.remove('menu-open');
  openBtn?.setAttribute('aria-expanded', 'false');
  const hide = () => { menu.hidden = true; };
  if (motionReduced()) hide(); else setTimeout(hide, 400);
  lastFocus?.focus();
}
openBtn?.addEventListener('click', () => (menu?.hidden ? openMenu() : closeMenu()));
menu?.querySelectorAll('[data-menu-close]').forEach((b) => b.addEventListener('click', closeMenu));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) closeMenu(); });
menu?.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const items = Array.from(menu.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

// ---- the five thread tab strip: tap a thread to jump to its cell in the current row
const strip = document.querySelector<HTMLElement>('[data-tabstrip]');
if (strip) {
  strip.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-thread]');
    if (!a) return;
    const key = a.dataset.thread!;
    const cells = Array.from(document.querySelectorAll<HTMLElement>(`[data-thread="${key}"]:not(.tabstrip__tab):not(.threadstrip__label)`));
    if (!cells.length) return;
    e.preventDefault();
    const offset = (band?.offsetHeight || 0) + strip.offsetHeight + 8;
    const y = window.scrollY + 1;
    // the next cell for this thread at or below the top of the viewport, or the last one on the page
    const target = cells.find((c) => c.getBoundingClientRect().top + window.scrollY - offset >= y - 4) || cells[cells.length - 1];
    strip.querySelectorAll('a').forEach((t) => t.removeAttribute('aria-current'));
    a.setAttribute('aria-current', 'true');
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: motionReduced() ? 'auto' : 'smooth' });
  });
}

// Sign in flips to the dashboard once a demo session exists (QA punch list): the SSR link stays /sign-in for
// visitors; a member sees "Today's brief" pointing at /today, on this page and after sign in or sign out.
import { getSession } from './session';
function flipSignIn() {
  const has = !!getSession();
  document.querySelectorAll<HTMLAnchorElement>('[data-signin-link]').forEach((a) => {
    a.href = has ? '/today' : '/sign-in';
    a.textContent = has ? 'My dashboard' : 'Sign in';
  });
}
flipSignIn();
document.addEventListener('sb:session', flipSignIn);
