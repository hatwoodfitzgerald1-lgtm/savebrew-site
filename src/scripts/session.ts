// The demo session and the order (design document 7.14 to 7.20). The preview build keeps both in localStorage
// with an in memory fallback: "savebrew.order" holds the order the checkout wrote (read by /confirmation) and
// "savebrew.session" holds the illustrative member Jordan once /sign-in or the confirmation opens the dashboard.
// No real member data exists; every figure is illustrative and the pages say so.
import cart, { type Cadence, type Sku, SKUS } from './cart';

export const ORDER_KEY = 'savebrew.order';
export const SESSION_KEY = 'savebrew.session';

export interface Order {
  number: string;
  sku: Sku;
  cadence: Cadence;
  amount: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  lastFour: string;
  placedAt: number;
}
export interface TextsState { optedIn: boolean; rates: boolean; goals: boolean; billing: boolean; weekly?: boolean; milestones?: boolean }
export interface SavedItem { id: string; text: string; date: string; kind: 'reminder' | 'code' }
export interface Session {
  email: string;
  name: string;
  initials: string;
  since: number;
  sku: Sku;
  cadence: Cadence;
  renewsOn: number;
  texts: TextsState;
  phone: string;
  cancelled: boolean;
  accessEnds: number | null;
  passwordSet?: boolean;
  invitePending?: boolean;
  inviteEmail?: string | null;
  saved?: SavedItem[];
  alerts?: Record<string, boolean>;
  alertBelow?: Record<string, number>;
  balance?: number;
  ownRate?: number | null;
  goals?: Record<string, unknown>;
  signedInAt?: number;
}

const memory: Record<string, string | null> = {};
function readRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return memory[key] ?? null; }
}
function writeRaw(key: string, value: string | null) {
  memory[key] = value;
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* memory only */ }
}

// ------------------------------------------------------------------ the order
export function getOrder(): Order | null {
  const raw = readRaw(ORDER_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.number === 'string' && SKUS[o.sku as Sku]) return o as Order;
  } catch { /* fall through */ }
  return null;
}
export function setOrder(order: Order | null) { writeRaw(ORDER_KEY, order ? JSON.stringify(order) : null); }
/** A plausible order number in the pattern SB1 followed by seven digits. */
export function orderNumber(): string {
  const n = 1000000 + Math.floor(Math.random() * 9000000);
  return `SB1${n}`;
}

// ------------------------------------------------------------------ the session
export function getSession(): Session | null {
  const raw = readRaw(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s && typeof s.email === 'string' && SKUS[s.sku as Sku]) return s as Session;
  } catch { /* fall through */ }
  return null;
}
export function setSession(session: Session | null) {
  writeRaw(SESSION_KEY, session ? JSON.stringify(session) : null);
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('sb:session', { detail: session }));
}
export function updateSession(patch: Partial<Session>): Session | null {
  const s = getSession();
  if (!s) return null;
  const next = { ...s, ...patch };
  setSession(next);
  return next;
}
/** The illustrative member Jordan (design document 7.16): SB101 monthly by default, renewing a month from today. */
export function demoSession(email: string, sku: Sku = 'SB101', renewsOn?: number, extra: Partial<Session> = {}): Session {
  const cadence = SKUS[sku].cadence;
  return {
    email,
    name: 'Jordan',
    initials: 'JM',
    since: 2026,
    sku,
    cadence,
    renewsOn: renewsOn ?? cart.renewalDate(cadence).getTime(),
    texts: { optedIn: true, rates: true, goals: true, billing: true, weekly: false, milestones: true },
    phone: '(555) 010 0123',
    cancelled: false,
    accessEnds: null,
    saved: [],
    alerts: { 'Bank A': true },
    alertBelow: { 'Bank A': 3.9 },
    balance: 10000,
    ownRate: 3.5,
    signedInAt: Date.now(),
    ...extra
  };
}
export function signOut() { setSession(null); }

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
export function digits(v: string): string { return v.replace(/\D/g, ''); }
/** "(555) 010 0123" from any 10 digit (or 1 plus 10 digit) input; other input is returned trimmed. */
export function formatPhone(v: string): string {
  const d = digits(v).replace(/^1(?=\d{10}$)/, '');
  if (d.length !== 10) return v.trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`;
}
export function isValidPhone(v: string): boolean {
  return digits(v).replace(/^1(?=\d{10}$)/, '').length === 10;
}
/** "9:14 AM" in Eastern time for the order line. */
export function easternTime(d = new Date()): string {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(d); }
  catch { return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
}

const api = { getOrder, setOrder, orderNumber, getSession, setSession, updateSession, demoSession, signOut, isValidEmail, formatPhone, isValidPhone, easternTime };
declare global { interface Window { sbSession: typeof api } }
if (typeof window !== 'undefined') window.sbSession = api;
export default api;
