// /checkout (design document 7.14, checkout_spec.md): the guest checkout's behaviour. The order summary is bound
// to the cart before any field is filled; every required field is validated to the GOV.UK standard (on blur
// with a short delay, never while typing; the message beside the field and repeated in a summary at the top
// with a link to each field; what the buyer typed is preserved, card fields included); the submit label carries
// the live amount; a successful submit writes the order to localStorage, empties the cart and opens
// /confirmation. The stitch in the left gutter advances a section at a time through sb:checkout-progress.
import cart, { type CartState } from './cart';
import { setOrder, orderNumber, isValidEmail, isValidPhone, formatPhone } from './session';
import { formatCardNumber, cardNumberProblem, cardNameProblem, expiryProblem, cvvProblem, lastFour, type CardMessages } from './card-fields';
import { motionReduced } from './ease';

const root = document.querySelector<HTMLFormElement>('form[data-checkout]');
if (root) {
  const S = JSON.parse(root.dataset.strings || '{}') as Record<string, string>;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const input = (id: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id)!;
  const fieldOf = (el: HTMLElement) => el.closest<HTMLElement>('.field, .check-field')!;

  // ------------------------------------------------------------------ the order summary, live from the cart
  let placing = false;
  const summary = {
    membership: q('[data-sum-membership]'), charge: q('[data-sum-charge]'), renewal: q('[data-sum-renewal]'),
    total: q('[data-sum-total]'), submitLabel: q('.checkout__submit .bobbin__label')
  };
  let state: CartState | null = null;
  cart.subscribe((s) => {
    if (placing) return;
    state = s;
    document.documentElement.setAttribute('data-cart', s ? 'full' : 'empty');
    if (!s) return;
    summary.membership.textContent = cart.line(s, S.membershipPattern);
    summary.charge.textContent = cart.charge(s);
    summary.total.textContent = cart.charge(s);
    summary.renewal.textContent = cart.renewalSentence(s, { monthly: S.renewalMonthly, yearly: S.renewalYearly });
    summary.submitLabel.textContent = S.submitPattern.replace('{amount}', cart.charge(s));
  });

  // ------------------------------------------------------------------ the fields
  const M: CardMessages = {
    numberEmpty: S.numberEmpty, numberFormat: S.numberFormat, numberCheck: S.numberCheck, expiryEmpty: S.expiryEmpty, expiryPast: S.expiryPast,
    cvvEmpty: S.cvvEmpty, cvvFormat: S.cvvFormat, nameEmpty: S.ccNameEmpty
  };
  const country = input('co-country') as HTMLSelectElement;
  const isUS = () => country.value === 'US';
  const stateSelect = input('co-state') as HTMLSelectElement;
  const stateText = input('co-state-intl') as HTMLInputElement;
  const activeState = () => (isUS() ? stateSelect : stateText);

  interface Field { key: string; el: () => HTMLInputElement | HTMLSelectElement; section: number; problem: () => string | null; extra?: () => HTMLElement[] }
  const fields: Field[] = [
    { key: 'first', section: 1, el: () => input('co-first'), problem: () => (input('co-first').value.trim() ? null : S.firstEmpty) },
    { key: 'last', section: 1, el: () => input('co-last'), problem: () => (input('co-last').value.trim() ? null : S.lastEmpty) },
    { key: 'email', section: 1, el: () => input('co-email'), problem: () => { const v = input('co-email').value.trim(); return !v ? S.emailEmpty : !isValidEmail(v) ? S.emailFormat : null; } },
    { key: 'phone', section: 1, el: () => input('co-phone'), problem: () => { const v = input('co-phone').value.trim(); return !v ? S.phoneEmpty : !isValidPhone(v) ? S.phoneFormat : null; } },
    { key: 'country', section: 2, el: () => country, problem: () => (country.value ? null : S.countryEmpty) },
    { key: 'line1', section: 2, el: () => input('co-line1'), problem: () => (input('co-line1').value.trim() ? null : S.line1Empty) },
    { key: 'city', section: 2, el: () => input('co-city'), problem: () => (input('co-city').value.trim() ? null : S.cityEmpty) },
    { key: 'state', section: 2, el: () => activeState(), problem: () => (activeState().value.trim() ? null : isUS() ? S.stateEmpty : S.stateEmptyIntl) },
    { key: 'zip', section: 2, el: () => input('co-zip'), problem: () => { const v = input('co-zip').value.trim(); if (!v) return isUS() ? S.zipEmpty : S.zipEmptyIntl; if (isUS() && !/^\d{5}(-\d{4})?$/.test(v)) return S.zipFormat; return null; } },
    { key: 'ccname', section: 3, el: () => input('co-ccname'), problem: () => cardNameProblem(input('co-ccname').value, M) },
    { key: 'ccnumber', section: 3, el: () => input('co-ccnumber'), problem: () => cardNumberProblem(input('co-ccnumber').value, M) },
    { key: 'expiry', section: 3, el: () => input('co-ccmm'), extra: () => [input('co-ccyyyy')], problem: () => expiryProblem(input('co-ccmm').value, input('co-ccyyyy').value, M) },
    { key: 'cvv', section: 3, el: () => input('co-cvv'), problem: () => cvvProblem(input('co-cvv').value, input('co-ccnumber').value, M) },
    { key: 'terms', section: 4, el: () => input('co-terms'), problem: () => ((input('co-terms') as HTMLInputElement).checked ? null : S.termsError) }
  ];
  const errorEl = (f: Field) => root.querySelector<HTMLElement>(`[data-error-for="${f.key}"]`)!;
  const show = (f: Field, msg: string | null) => {
    const el = f.el();
    const wrap = fieldOf(el);
    const err = errorEl(f);
    wrap.classList.toggle('is-error', !!msg);
    err.hidden = !msg;
    err.querySelector('[data-error-text]')!.textContent = msg || '';
    [el, ...(f.extra ? f.extra() : [])].forEach((c) => c.setAttribute('aria-invalid', msg ? 'true' : 'false'));
  };
  const shown = (f: Field) => !errorEl(f).hidden;

  // validate on blur after a short delay, never while typing; a shown message clears as soon as the field is right
  const timers: Record<string, number> = {};
  for (const f of fields) {
    const controls = [f.el(), ...(f.extra ? f.extra() : [])];
    if (f.key === 'state') controls.push(stateText, stateSelect);
    for (const c of controls) {
      c.addEventListener('blur', () => {
        clearTimeout(timers[f.key]);
        timers[f.key] = window.setTimeout(() => {
          if (f.key === 'phone' && c.value.trim()) (c as HTMLInputElement).value = formatPhone(c.value);
          if (c.value.trim() || shown(f)) show(f, f.problem());
          progress();
        }, 300);
      });
      const onChange = () => { if (shown(f) && !f.problem()) show(f, null); progress(); };
      c.addEventListener('input', onChange);
      c.addEventListener('change', onChange);
    }
  }
  // the card number is formatted in groups as typed; the security code and ZIP take digits
  const ccnumber = input('co-ccnumber') as HTMLInputElement;
  ccnumber.addEventListener('input', () => {
    const pos = ccnumber.selectionStart || 0;
    const before = ccnumber.value.length;
    ccnumber.value = formatCardNumber(ccnumber.value);
    const delta = ccnumber.value.length - before;
    try { ccnumber.setSelectionRange(pos + delta, pos + delta); } catch { /* ignore */ }
  });
  // country switches the state control and the ZIP or postal code labels
  const stateLabel = q('[data-state-label]');
  const zipLabel = q('[data-zip-label]');
  const applyCountry = () => {
    const us = isUS();
    stateSelect.hidden = !us; stateText.hidden = us;
    stateSelect.disabled = !us; stateText.disabled = us;
    stateLabel.textContent = us ? S.stateLabel : S.stateLabelIntl;
    stateLabel.setAttribute('for', us ? 'co-state' : 'co-state-intl');
    zipLabel.textContent = us ? S.zipLabel : S.zipLabelIntl;
    (input('co-zip') as HTMLInputElement).inputMode = us ? 'numeric' : 'text';
  };
  country.addEventListener('change', () => { applyCountry(); show(fields.find((f) => f.key === 'state')!, null); show(fields.find((f) => f.key === 'zip')!, null); });
  applyCountry();
  // the security code help
  const helpBtn = root.querySelector<HTMLButtonElement>('[data-cvv-help]');
  const helpText = root.querySelector<HTMLElement>('[data-cvv-help-text]');
  helpBtn?.addEventListener('click', () => {
    const open = helpBtn.getAttribute('aria-expanded') === 'true';
    helpBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    if (helpText) helpText.hidden = open;
  });

  // ------------------------------------------------------------------ the stitch in the gutter
  const scene = document.querySelector<HTMLElement>('[data-scene="checkout-stitch"]');
  const heads = Array.from(root.querySelectorAll<HTMLElement>('[data-checkout-section]'));
  const sectionValid = (n: number) => fields.filter((f) => f.section === n).every((f) => !f.problem());
  const yIn = (el: HTMLElement) => { const r = el.getBoundingClientRect(); const s = scene!.getBoundingClientRect(); return r.top - s.top + 10; };
  const footOf = (n: number) => { const sec = root.querySelector<HTMLElement>(`[data-section="${n}"]`)!; const r = sec.getBoundingClientRect(); const s = scene!.getBoundingClientRect(); return r.bottom - s.top; };
  let lastReach = -1;
  const progress = () => {
    if (!scene) return;
    // the summary's head joins the gutter stitch only when the summary is stacked under the form (below 1024)
    const inColumn = heads.filter((h) => window.innerWidth < 1024 || !h.closest('.checkout__aside'));
    const knots = inColumn.map(yIn);
    let reach = knots[0] || 0;
    for (let n = 1; n <= 3; n++) { if (sectionValid(n)) reach = Math.max(reach, footOf(n)); else break; }
    if ([1, 2, 3].every(sectionValid) && sectionValid(4)) reach = scene.getBoundingClientRect().height;
    if (Math.abs(reach - lastReach) < 1) return;
    lastReach = reach;
    document.dispatchEvent(new CustomEvent('sb:checkout-progress', { detail: { reach, knots } }));
  };
  const kick = () => { lastReach = -1; progress(); };
  if (document.readyState === 'complete') setTimeout(kick, 60); else window.addEventListener('load', () => setTimeout(kick, 60));
  new ResizeObserver(() => kick()).observe(root);
  document.addEventListener('sb:ready', () => setTimeout(kick, 100));

  // ------------------------------------------------------------------ submit
  const summaryBox = q('[data-error-summary]');
  const summaryList = q('[data-error-summary-list]');
  const submit = q<HTMLButtonElement>('[data-checkout-submit]');
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    if (placing || !state) return;
    const problems: { f: Field; msg: string }[] = [];
    for (const f of fields) { const msg = f.problem(); show(f, msg); if (msg) problems.push({ f, msg }); }
    summaryList.innerHTML = '';
    if (problems.length) {
      for (const p of problems) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#' + p.f.el().id;
        a.textContent = p.msg;
        a.addEventListener('click', (ev) => { ev.preventDefault(); const el = p.f.el(); el.scrollIntoView({ block: 'center', behavior: motionReduced() ? 'auto' : 'smooth' }); el.focus({ preventScroll: true }); });
        li.appendChild(a);
        summaryList.appendChild(li);
      }
      summaryBox.hidden = false;
      summaryBox.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'auto' : 'smooth' });
      summaryBox.focus({ preventScroll: true });
      progress();
      return;
    }
    summaryBox.hidden = true;
    placing = true;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    summary.submitLabel.textContent = S.processing;
    const s = state;
    const order = {
      number: orderNumber(), sku: s.sku, cadence: s.cadence, amount: cart.price(s),
      email: input('co-email').value.trim(), firstName: input('co-first').value.trim(), lastName: input('co-last').value.trim(),
      phone: formatPhone(input('co-phone').value), lastFour: lastFour(ccnumber.value), placedAt: Date.now()
    };
    // the preview build takes no live charge and stores no card details: only the last four digits travel to the confirmation
    window.setTimeout(() => {
      setOrder(order);
      cart.remove();
      location.assign('/confirmation');
    }, motionReduced() ? 200 : 700);
  });
}
