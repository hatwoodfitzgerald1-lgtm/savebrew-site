// The string table: every customer facing string by its copy.md id (src/data/copy.json, built by
// scripts/build-copy.mjs). Never retype a string that has an id; ask for it here.
import copy from '../data/copy.json';
import add from '../data/add.json';

type Table = Record<string, string>;
const table = copy as unknown as Table;
const added = add as unknown as Table;

/** The string for a copy.md id (or an add.* id from the design document). Throws at build when the id is unknown. */
export function t(id: string): string {
  if (Object.prototype.hasOwnProperty.call(table, id) && !id.startsWith('_')) return table[id];
  if (Object.prototype.hasOwnProperty.call(added, id)) return added[id];
  throw new Error(`copy: no string with the id "${id}". Check copy.md (or add it to src/data/add.json if it is an add. string from the design document).`);
}

/** True when the id exists. */
export function has(id: string): boolean {
  return (Object.prototype.hasOwnProperty.call(table, id) && !id.startsWith('_')) || Object.prototype.hasOwnProperty.call(added, id);
}

/** A pattern string with its {placeholders} filled: fmt('cart.line.pattern', { membership: 'SaveBrew Daily', cadence: 'monthly' }). */
export function fmt(id: string, vars: Record<string, string | number>): string {
  return fill(t(id), vars);
}

/** Fill {placeholders} in any string. Unknown placeholders are left in place so they show up in QA. */
export function fill(pattern: string, vars: Record<string, string | number>): string {
  return pattern.replace(/\{([^}]+)\}/g, (m, key) => (Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m));
}

/** The whole table, for scripts that need to ship strings to the client (keep it to the ids you use). */
export function pick(ids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of ids) out[id] = t(id);
  return out;
}

export const THREADS = [
  { key: 'rates', name: t('thread.rates'), icon: 'rates' },
  { key: 'cashback', name: t('thread.cashback'), icon: 'cashback' },
  { key: 'coupons', name: t('thread.coupons'), icon: 'coupons' },
  { key: 'seasonal', name: t('thread.seasonal'), icon: 'seasonal' },
  { key: 'paycheck', name: t('thread.paycheck'), icon: 'paycheck' }
] as const;
export type ThreadKey = (typeof THREADS)[number]['key'];
