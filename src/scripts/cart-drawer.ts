// The cart drawer's behaviour: opens on sb:cart-open (the spool glyph, any Bobbin with data-add-sku), renders the
// store's state, switches cadence, removes, announces the add, replace and remove lines, traps focus, closes on
// Escape and on Close, and returns focus to the trigger. Persisted state comes from cart.ts.
import cart, { type CartState, type Cadence } from './cart';
import { motionReduced } from './ease';

const drawer = document.querySelector<HTMLElement>('[data-cart-drawer]');
if (drawer) {
  const S = JSON.parse(drawer.dataset.strings || '{}');
  const q = <T extends HTMLElement>(sel: string) => drawer.querySelector<T>(sel)!;
  const heading = q('#cart-heading');
  const item = q('[data-cart-item]');
  const empty = q('[data-cart-empty]');
  const line = q('[data-cart-line]');
  const charge = q('[data-cart-charge]');
  const renewal = q('[data-cart-renewal]');
  const cadence = q('[data-cart-cadence]');
  const note = q('[data-cart-cadence-note]');
  const live = q('[data-cart-live]');
  const message = drawer.querySelector<HTMLElement>('[data-cart-message]');
  let trigger: HTMLElement | null = null;
  // the add, replace and remove lines are shown in the drawer as well as announced (6.5: "replacing a membership says so in a line")
  const say = (text: string) => { if (message) { message.textContent = text; message.hidden = !text; } };
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  const render = (state: CartState | null) => {
    if (!state) { item.hidden = true; empty.hidden = false; return; }
    item.hidden = false; empty.hidden = true;
    line.textContent = cart.line(state, S.line);
    charge.textContent = cart.charge(state);
    renewal.textContent = cart.renewalSentence(state, { monthly: S.renewalMonthly, yearly: S.renewalYearly });
    cadence.dataset.cadence = state.cadence;
    cadence.querySelectorAll<HTMLElement>('[data-cadence]').forEach((b) => b.setAttribute('aria-checked', b.dataset.cadence === state.cadence ? 'true' : 'false'));
  };
  const announce = (text: string) => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 40); say(text); };
  cart.subscribe(render);

  const open = (from?: HTMLElement) => {
    trigger = from || (document.activeElement as HTMLElement);
    drawer.hidden = false;
    document.body.classList.add('cart-open');
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    heading.focus();
  };
  const close = () => {
    if (drawer.hidden) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('cart-open');
    const hide = () => { drawer.hidden = true; say(''); };
    if (motionReduced()) hide(); else setTimeout(hide, 400);
    trigger?.focus();
  };
  document.addEventListener('sb:cart-open', (e: any) => open(e.detail?.trigger));
  document.addEventListener('sb:cart-add', (e: any) => {
    const { kind, state, previous } = e.detail;
    if (kind === 'replaced' && previous) {
      announce(String(S.replaced).replace('{new membership}', cart.product(state).name).replace('{new cadence}', state.cadence).replace('{old membership}', cart.product(previous).short).replace('{old cadence}', previous.cadence));
    } else {
      announce(String(S.added).replace('{membership}', cart.product(state).name).replace('{cadence}', state.cadence));
    }
  });
  drawer.querySelectorAll('[data-cart-close]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) close(); });
  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === heading)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  cadence.querySelectorAll<HTMLElement>('[data-cadence]').forEach((b) => {
    b.addEventListener('click', () => {
      const next = cart.setCadence(b.dataset.cadence as Cadence);
      if (next) { note.textContent = cart.cadenceNote(next, { monthly: S.noteMonthly, yearly: S.noteYearly }); }
    });
  });
  q('[data-cart-remove]').addEventListener('click', () => { cart.remove(); note.textContent = ''; announce(S.removed); heading.focus(); });
  (window as any).sbCartDrawer = { open, close };
}
