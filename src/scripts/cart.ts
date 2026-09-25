// The cart store (design document 6.5): one membership at a time, quantity fixed at 1, the cadence switch,
// add, replace, remove, persistence in localStorage under "savebrew.cart" with an in memory fallback, and a
// subscription the heading band's spool count uses. Plain module, no framework. The commerce agent builds
// the /cart page and the checkout on top of this.
export type Cadence = 'monthly' | 'yearly';
export type ProductKey = 'daily' | 'two';
export type Sku = 'SB101' | 'SB102' | 'SB201' | 'SB202';
export interface CartState { sku: Sku; cadence: Cadence; addedAt: number }
export interface Product { key: ProductKey; name: string; short: string; monthly: { sku: Sku; price: number }; yearly: { sku: Sku; price: number } }

export const PRODUCTS: Record<ProductKey, Product> = {
  daily: { key: 'daily', name: 'SaveBrew Daily', short: 'The Daily', monthly: { sku: 'SB101', price: 7.99 }, yearly: { sku: 'SB102', price: 72 } },
  two: { key: 'two', name: 'SaveBrew Daily for Two', short: 'The Daily for Two', monthly: { sku: 'SB201', price: 11.98 }, yearly: { sku: 'SB202', price: 108 } }
};
export const SKUS: Record<Sku, { product: ProductKey; cadence: Cadence; price: number }> = {
  SB101: { product: 'daily', cadence: 'monthly', price: 7.99 },
  SB102: { product: 'daily', cadence: 'yearly', price: 72 },
  SB201: { product: 'two', cadence: 'monthly', price: 11.98 },
  SB202: { product: 'two', cadence: 'yearly', price: 108 }
};
export const KEY = 'savebrew.cart';

let memory: CartState | null = null;
let storageOk = true;
const listeners = new Set<(state: CartState | null) => void>();

function read(): CartState | null {
  if (!storageOk) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v && typeof v.sku === 'string' && SKUS[v.sku as Sku]) return { sku: v.sku, cadence: SKUS[v.sku as Sku].cadence, addedAt: Number(v.addedAt) || Date.now() };
    return null;
  } catch { storageOk = false; return memory; }
}
function write(state: CartState | null) {
  memory = state;
  if (storageOk) {
    try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); else localStorage.removeItem(KEY); }
    catch { storageOk = false; }
  }
  emit();
}
function emit() {
  const s = get();
  listeners.forEach((fn) => fn(s));
  document.dispatchEvent(new CustomEvent('sb:cart', { detail: s }));
}

/** The current membership in the cart, or null. */
export function get(): CartState | null { return read(); }
/** 1 when a membership is in the cart, otherwise 0 (quantity is fixed at 1). */
export function count(): number { return get() ? 1 : 0; }
/** Subscribe to changes; fires at once with the current state. Returns the unsubscribe function. */
export function subscribe(fn: (state: CartState | null) => void): () => void {
  listeners.add(fn);
  fn(get());
  return () => listeners.delete(fn);
}
export interface AddResult { kind: 'added' | 'replaced'; state: CartState; previous: CartState | null }
/** Adds a membership by SKU. A different membership replaces the current one (the announcement says so). */
export function add(sku: Sku): AddResult {
  const previous = get();
  const state: CartState = { sku, cadence: SKUS[sku].cadence, addedAt: Date.now() };
  write(state);
  return { kind: previous && previous.sku !== sku ? 'replaced' : 'added', state, previous };
}
/** Switches the cadence of the membership in the cart, swapping SB101 to SB102 and back (SB201 to SB202 and back). */
export function setCadence(cadence: Cadence): CartState | null {
  const s = get();
  if (!s) return null;
  const p = PRODUCTS[SKUS[s.sku].product];
  const next: CartState = { sku: p[cadence].sku, cadence, addedAt: s.addedAt };
  write(next);
  return next;
}
/** Empties the cart. */
export function remove(): void { write(null); }

// ------------------------------------------------------------------ words for the drawer, the cart page and the checkout
export function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}
export function product(state: CartState): Product { return PRODUCTS[SKUS[state.sku].product]; }
export function price(state: CartState): number { return SKUS[state.sku].price; }
export function charge(state: CartState): string { return money(price(state)); }
/** "SaveBrew Daily, billed monthly" (cart.line.pattern) */
export function line(state: CartState, pattern = '{membership}, billed {cadence}'): string {
  return pattern.replace('{membership}', product(state).name).replace('{cadence}', state.cadence);
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function dateInWords(d: Date, weekday = false): string {
  const s = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return weekday ? `${DAYS[d.getDay()]}, ${s}` : s;
}
/** The next renewal date for a cadence from today (the same day next month or next year, clamped to the month's length). */
export function renewalDate(cadence: Cadence, from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const target = new Date(d);
  if (cadence === 'monthly') target.setMonth(d.getMonth() + 1); else target.setFullYear(d.getFullYear() + 1);
  if (target.getDate() !== d.getDate()) target.setDate(0); // the month is shorter: use its last day
  return target;
}
/** The renewal sentence for the cart (cart.renewal.monthly.pattern or cart.renewal.yearly.pattern). */
export function renewalSentence(state: CartState, patterns: { monthly: string; yearly: string }): string {
  const p = state.cadence === 'monthly' ? patterns.monthly : patterns.yearly;
  return p.replace('{date in words}', dateInWords(renewalDate(state.cadence))).replace('{amount}', charge(state));
}
/** The note under the cadence switch (cart.cadence.note.*.pattern), for the cadence that was just chosen. */
export function cadenceNote(state: CartState, patterns: { monthly: string; yearly: string }): string {
  const p = state.cadence === 'monthly' ? patterns.monthly : patterns.yearly;
  return p.replace('{amount}', charge(state)).replace('{date in words}', dateInWords(renewalDate(state.cadence)));
}
/** "Your first pass goes out at 6:30 AM Eastern on Friday, September 25." style next weekday (confirm.first.pass.pattern). */
export function nextWeekday(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// cross tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) emit(); });
}
export const cart = { get, count, subscribe, add, setCadence, remove, money, product, price, charge, line, renewalSentence, cadenceNote, renewalDate, dateInWords, nextWeekday, PRODUCTS, SKUS, KEY };
declare global { interface Window { sbCart: typeof cart } }
if (typeof window !== 'undefined') window.sbCart = cart;
export default cart;
