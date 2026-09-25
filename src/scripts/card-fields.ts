// The payment field rules shared by the checkout and the dashboard's "Update the card" form (design document
// 7.14 and the membership panel): the card number formatted in groups as typed, the 15 or 16 digit length rule,
// the Luhn check, the expiry (MM then YYYY, not in the past) and the 3 or 4 digit security code. Messages come
// from copy.md by id; this module only decides which one applies. Nothing here stores a card.
export function cardDigits(v: string): string { return v.replace(/\D/g, ''); }
/** "4242 4242 4242 4242" as typed (four groups of four; 4, 6, 5 for a 15 digit American Express number). */
export function formatCardNumber(v: string): string {
  const d = cardDigits(v).slice(0, 19);
  const amex = /^3[47]/.test(d);
  if (amex) return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ');
  return (d.match(/.{1,4}/g) || []).join(' ');
}
export function luhn(d: string): boolean {
  let sum = 0, dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (dbl) { n *= 2; if (n > 9) n -= 9; }
    sum += n; dbl = !dbl;
  }
  return sum % 10 === 0;
}
export interface CardMessages { numberEmpty: string; numberFormat: string; numberCheck: string; expiryEmpty: string; expiryPast: string; cvvEmpty: string; cvvFormat: string; nameEmpty: string }
export function cardNumberProblem(v: string, M: CardMessages): string | null {
  const raw = v.trim();
  if (!raw) return M.numberEmpty;
  if (/[^\d\s]/.test(raw)) return M.numberFormat;
  const d = cardDigits(raw);
  if (d.length !== 15 && d.length !== 16) return M.numberFormat;
  if (!luhn(d)) return M.numberCheck;
  return null;
}
export function cardNameProblem(v: string, M: CardMessages): string | null { return v.trim() ? null : M.nameEmpty; }
export function expiryProblem(mm: string, yyyy: string, M: CardMessages, now = new Date()): string | null {
  if (!mm || !yyyy) return M.expiryEmpty;
  const m = Number(mm), y = Number(yyyy);
  if (!(m >= 1 && m <= 12) || !y) return M.expiryEmpty;
  const thisY = now.getFullYear(), thisM = now.getMonth() + 1;
  if (y < thisY || (y === thisY && m < thisM)) return M.expiryPast;
  return null;
}
export function cvvProblem(v: string, cardNumber: string, M: CardMessages): string | null {
  const d = cardDigits(v);
  if (!v.trim()) return M.cvvEmpty;
  const amex = /^3[47]/.test(cardDigits(cardNumber));
  if (/\D/.test(v.trim())) return M.cvvFormat;
  if (amex ? d.length !== 4 : d.length !== 3) return M.cvvFormat;
  return null;
}
export function lastFour(v: string): string { return cardDigits(v).slice(-4); }
