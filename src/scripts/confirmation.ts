// /confirmation (design document 7.15): renders the order the checkout wrote (localStorage "savebrew.order"),
// the optional password, the Daily for Two invite, and "Open my dashboard", which sets the demo session for the
// checkout email and opens /today. Without an order the page shows the empty state with the membership link.
import cart, { SKUS } from './cart';
import { getOrder, setOrder, demoSession, setSession, isValidEmail, easternTime, type Order } from './session';

const root = document.querySelector<HTMLElement>('[data-confirmation]');
if (root) {
  const S = JSON.parse(root.dataset.strings || '{}') as Record<string, string>;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const order = getOrder();
  document.documentElement.setAttribute('data-order', order ? 'full' : 'none');
  if (order) {
    const state = { sku: order.sku, cadence: order.cadence, addedAt: order.placedAt };
    const placed = new Date(order.placedAt);
    const two = SKUS[order.sku].product === 'two';
    root.dataset.two = two ? 'true' : 'false';
    const set = (sel: string, text: string) => { root.querySelectorAll<HTMLElement>(sel).forEach((el) => { el.textContent = text; }); };
    set('[data-order-line]', S.orderPattern.replace('{number}', order.number).replace('{date in words}', cart.dateInWords(placed, true)).replace('{time}', easternTime(placed)));
    set('[data-order-bought]', S.boughtPattern.replace('{membership}', cart.product(state).name).replace('{cadence}', order.cadence));
    set('[data-order-charged]', S.chargedPattern.replace('{amount}', cart.money(order.amount)).replace('{last four digits}', order.lastFour || '0000'));
    set('[data-order-renewal]', cart.renewalSentence(state, { monthly: S.renewalMonthly, yearly: S.renewalYearly }));
    set('[data-order-first-pass]', S.firstPassPattern.replace('{next weekday in words}', cart.nextWeekday(placed)));
    set('[data-order-ready]', S.readyPattern.replace('{email}', order.email));
    root.querySelectorAll<HTMLElement>('[data-order-email]').forEach((el) => { el.textContent = order.email; });

    // the optional password (account creation is offered only here, after the order)
    const pwForm = q<HTMLFormElement>('[data-password-form]');
    if (pwForm) {
      const pw = pwForm.querySelector<HTMLInputElement>('input[type="password"]')!;
      const field = pw.closest<HTMLElement>('.field')!;
      const err = pwForm.querySelector<HTMLElement>('[data-error-for="password"]')!;
      const done = pwForm.querySelector<HTMLElement>('[data-password-done]')!;
      const show = (msg: string | null) => { field.classList.toggle('is-error', !!msg); err.hidden = !msg; err.querySelector('[data-error-text]')!.textContent = msg || ''; pw.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
      pw.addEventListener('input', () => { if (!err.hidden && pw.value.length >= 10) show(null); });
      pwForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (pw.value.length < 10) { show(S.passwordShort); pw.focus(); return; }
        show(null);
        done.hidden = false;
        pw.value = '';
        setOrder({ ...order, passwordSet: true } as Order);
        (pwForm.querySelector('[data-password-submit]') as HTMLButtonElement).disabled = true;
      });
    }

    // the Daily for Two: invite the second reader now or later from Membership
    const invForm = q<HTMLFormElement>('[data-invite-form]');
    if (invForm && two) {
      const em = invForm.querySelector<HTMLInputElement>('input[type="email"]')!;
      const field = em.closest<HTMLElement>('.field')!;
      const err = invForm.querySelector<HTMLElement>('[data-error-for="invite"]')!;
      const done = invForm.querySelector<HTMLElement>('[data-invite-done]')!;
      const show = (msg: string | null) => { field.classList.toggle('is-error', !!msg); err.hidden = !msg; err.querySelector('[data-error-text]')!.textContent = msg || ''; em.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
      const problem = () => { const v = em.value.trim(); if (!v || !isValidEmail(v)) return S.inviteFormat; if (v.toLowerCase() === order.email.toLowerCase()) return S.inviteSame; return null; };
      em.addEventListener('input', () => { if (!err.hidden && !problem()) show(null); });
      invForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const p = problem();
        show(p);
        if (p) { em.focus(); return; }
        done.textContent = S.inviteDone.replace('{email}', em.value.trim());
        done.hidden = false;
        setOrder({ ...order, invite: em.value.trim() } as Order);
      });
    }

    // Open my dashboard: the demo session for the checkout email, then /today
    q('[data-open-dashboard]')?.addEventListener('click', () => {
      const latest = getOrder() || order;
      const extra = (latest as any).invite ? { invitePending: true, inviteEmail: (latest as any).invite } : (two ? { invitePending: true } : {});
      setSession(demoSession(order.email, order.sku, cart.renewalDate(order.cadence, placed).getTime(), { ...extra, passwordSet: !!(latest as any).passwordSet }));
    });
  }
}
