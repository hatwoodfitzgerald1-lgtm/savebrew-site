// The cart rendered as a page (/cart, design document 7.13): the same contents as the drawer bound to the
// page's own elements. The store (cart.ts) is the single source of truth, so the drawer and the page stay in
// step, and the add, replace and remove lines are both shown and announced.
import cart, { type CartState, type Cadence } from './cart';

export interface CartStrings {
  line: string; renewalMonthly: string; renewalYearly: string; noteMonthly: string; noteYearly: string;
  added: string; replaced: string; removed: string;
}
export function bindCartView(root: HTMLElement) {
  const S = JSON.parse(root.dataset.strings || '{}') as CartStrings;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const item = q('[data-cart-item]');
  const empty = q('[data-cart-empty]');
  const line = q('[data-cart-line]');
  const charge = q('[data-cart-charge]');
  const renewal = q('[data-cart-renewal]');
  const cadence = q('[data-cart-cadence]');
  const note = q('[data-cart-cadence-note]');
  const message = q('[data-cart-message]');
  const live = q('[data-cart-live]');
  const say = (text: string) => {
    if (message) { message.textContent = text; message.hidden = !text; }
    if (live) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 40); }
  };
  const render = (state: CartState | null) => {
    root.dataset.state = state ? 'full' : 'empty';
    if (!state) { if (item) item.hidden = true; if (empty) empty.hidden = false; return; }
    if (item) item.hidden = false;
    if (empty) empty.hidden = true;
    if (line) line.textContent = cart.line(state, S.line);
    if (charge) charge.textContent = cart.charge(state);
    if (renewal) renewal.textContent = cart.renewalSentence(state, { monthly: S.renewalMonthly, yearly: S.renewalYearly });
    if (cadence) {
      cadence.dataset.cadence = state.cadence;
      cadence.querySelectorAll<HTMLElement>('[data-cadence]').forEach((b) => b.setAttribute('aria-checked', b.dataset.cadence === state.cadence ? 'true' : 'false'));
    }
  };
  cart.subscribe(render);
  document.addEventListener('sb:cart-add', (e: any) => {
    const { kind, state, previous } = e.detail;
    if (kind === 'replaced' && previous) {
      say(String(S.replaced).replace('{new membership}', cart.product(state).name).replace('{new cadence}', state.cadence).replace('{old membership}', cart.product(previous).short).replace('{old cadence}', previous.cadence));
    } else {
      say(String(S.added).replace('{membership}', cart.product(state).name).replace('{cadence}', state.cadence));
    }
  });
  cadence?.querySelectorAll<HTMLElement>('[data-cadence]').forEach((b) => {
    b.addEventListener('click', () => {
      const next = cart.setCadence(b.dataset.cadence as Cadence);
      if (next && note) note.textContent = cart.cadenceNote(next, { monthly: S.noteMonthly, yearly: S.noteYearly });
    });
  });
  q('[data-cart-remove]')?.addEventListener('click', () => {
    cart.remove();
    if (note) note.textContent = '';
    say(S.removed);
    q<HTMLElement>('[data-cart-focus]')?.focus();
  });
}
document.querySelectorAll<HTMLElement>('[data-cart-view]').forEach(bindCartView);
