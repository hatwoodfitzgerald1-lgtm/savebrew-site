// The dashboard shell (design document 7.16 to 7.19): the session gate (no session redirects to /sign-in), the
// app bar wired for real (the tabs are real links, the bell's tooltip follows the texts state, the avatar opens
// the account menu with Membership and Sign out), the thread strip as the tab indicator, the membership panel
// with the two click cancellation and the Resume link, sign out, and the module entrance. The view scripts
// (dash-today, dash-rates, dash-goals, dash-archive) add each view's own interactions on top.
import cart, { PRODUCTS, SKUS, type Cadence, type Sku } from './cart';
import { getSession, setSession, updateSession, signOut, isValidEmail, type Session } from './session';
import { motionReduced } from './ease';
import { formatCardNumber, cardNumberProblem, cardNameProblem, expiryProblem, cvvProblem, lastFour, type CardMessages } from './card-fields';
import { initToday } from './dash-today';
import { initRates } from './dash-rates';
import { initGoals } from './dash-goals';
import { initArchive } from './dash-archive';
import './product-ui';   // the product views' own behaviour (scaling, toggles, chips, tabs); the archive view has no ProductView to load it

export interface DashContext { root: HTMLElement; stage: HTMLElement; S: Record<string, string>; session: Session; save: (patch: Partial<Session>) => Session; announce: (text: string) => void }

const root = document.querySelector<HTMLElement>('[data-dash]');
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function boot() {
  if (!root) return;
  let session = getSession();
  if (!session) { document.documentElement.setAttribute('data-session', 'none'); location.replace('/sign-in'); return; }
  document.documentElement.setAttribute('data-session', 'member');
  const S = JSON.parse(root.dataset.strings || '{}') as Record<string, string>;
  const view = root.dataset.view || 'today';
  const stage = root.querySelector<HTMLElement>('.sb-app__stage');
  const frame = root.querySelector<HTMLElement>('[data-dash-frame]');
  const live = root.querySelector<HTMLElement>('[data-dash-live]');
  const announce = (text: string) => { if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = text; }, 40); };
  if (!stage || !frame) return;
  // the context the view scripts share; save() keeps ctx.session current so every reader sees the latest state
  const ctx: DashContext = { root, stage, S, session, announce, save: (patch) => { session = updateSession(patch) || session!; ctx.session = session; return session; } };
  const save = ctx.save;

  // ------------------------------------------------------------------ the app bar
  const bar = stage.querySelector<HTMLElement>('.bar')!;
  const right = bar.querySelector<HTMLElement>('.right')!;
  // the bell: label and tooltip follow the texts state
  const bell = bar.querySelector<HTMLButtonElement>('.bell')!;
  bell.removeAttribute('title');
  const tip = document.createElement('div');
  tip.className = 'dash-tip'; tip.id = 'dash-bell-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  right.appendChild(tip);
  bell.setAttribute('aria-describedby', tip.id);
  const renderBell = () => {
    const on = session!.texts.optedIn;
    bell.querySelector('span')!.textContent = on ? S.bellOn : S.bellOff;
    tip.textContent = on ? S.bellOnTip.replace('{phone}', session!.phone) : S.bellOffTip;
    bell.setAttribute('aria-label', on ? S.bellOn : S.bellOff);
  };
  renderBell();
  const showTip = () => { tip.hidden = false; };
  const hideTip = () => { tip.hidden = true; };
  bell.addEventListener('mouseenter', showTip); bell.addEventListener('mouseleave', hideTip);
  bell.addEventListener('focus', showTip); bell.addEventListener('blur', hideTip);
  bell.addEventListener('click', () => { tip.hidden = !tip.hidden; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  document.addEventListener('sb:session', () => { session = getSession() || session; ctx.session = session; renderBell(); });

  // the avatar: a button that opens the account menu (Membership, Sign out)
  const oldAvatar = bar.querySelector<HTMLElement>('.avatar')!;
  const avatar = document.createElement('button');
  avatar.type = 'button'; avatar.className = 'avatar'; avatar.textContent = session.initials;
  avatar.setAttribute('aria-label', `${oldAvatar.getAttribute('title') || session.name}. ${S.avatarMenu}`);
  avatar.setAttribute('aria-haspopup', 'menu'); avatar.setAttribute('aria-expanded', 'false'); avatar.setAttribute('aria-controls', 'dash-menu');
  oldAvatar.replaceWith(avatar);
  const menu = document.createElement('div');
  menu.className = 'dash-menu'; menu.id = 'dash-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
  menu.innerHTML = `<a class="dash-menu__item" role="menuitem" href="#membership" data-open-membership></a><button class="dash-menu__item" role="menuitem" type="button" data-signout></button>`;
  menu.querySelector<HTMLElement>('[data-open-membership]')!.textContent = S.membership;
  menu.querySelector<HTMLElement>('[data-signout]')!.textContent = S.signout;
  right.appendChild(menu);
  const openMenu = () => { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); avatar.setAttribute('aria-expanded', 'true'); menu.querySelector<HTMLElement>('[role="menuitem"]')!.focus(); };
  const closeMenu = (refocus = false) => { if (menu.hidden) return; menu.classList.remove('is-open'); avatar.setAttribute('aria-expanded', 'false'); const hide = () => { menu.hidden = true; }; if (motionReduced()) hide(); else setTimeout(hide, 380); if (refocus) avatar.focus(); };
  avatar.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu(true)));
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== avatar) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) closeMenu(true); });
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  menu.querySelector<HTMLElement>('[data-signout]')!.addEventListener('click', () => {
    signOut();
    announce(S.signoutDone);
    document.documentElement.setAttribute('data-session', 'none');
    setTimeout(() => location.assign('/sign-in'), motionReduced() ? 100 : 500);
  });

  // the thread strip as the tab indicator, drawn on one small canvas in the bar
  const tabs = bar.querySelector<HTMLElement>('.tabs');
  if (tabs) {
    const strip = document.createElement('div');
    strip.className = 'dash-strip'; strip.dataset.scene = 'dash-strip'; strip.dataset.view = view; strip.setAttribute('aria-hidden', 'true');
    strip.appendChild(document.createElement('canvas'));
    tabs.appendChild(strip);
    const mount = () => (window as any).sbMotion?.initScenes?.(tabs);
    if ((window as any).sbMotion) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
  }
  // the footer line inside the frame on every view
  const foot = stage.querySelector<HTMLElement>('.app-footer');
  if (foot && !foot.textContent!.includes('digest')) { const line = document.createElement('div'); line.textContent = S.footerLine; foot.appendChild(line); }

  // ------------------------------------------------------------------ the module entrance
  const mark = (sel: string) => stage.querySelectorAll<HTMLElement>(sel).forEach((el, i) => el.style.setProperty('--i', String(i)));
  mark('.content > *'); mark('.main > *'); mark('.rail > *');
  requestAnimationFrame(() => frame.classList.add('is-in'));

  // ------------------------------------------------------------------ the membership panel
  initMembershipPanel(S, () => session!, save, announce);

  // ------------------------------------------------------------------ the view's own interactions
  if (view === 'today') initToday(ctx);
  if (view === 'rates') initRates(ctx);
  if (view === 'goals') initGoals(ctx);
  if (view === 'archive') initArchive(ctx);
}

function initMembershipPanel(S: Record<string, string>, current: () => Session, save: (p: Partial<Session>) => Session, announce: (t: string) => void) {
  const panel = document.querySelector<HTMLElement>('[data-membership-panel]');
  if (!panel) return;
  const P = JSON.parse(panel.dataset.strings || '{}') as Record<string, string>;
  const q = <T extends HTMLElement>(sel: string) => panel.querySelector<T>(sel)!;
  const heading = q('#membership-heading');
  const summary = q('[data-mp-summary]');
  const note = q('[data-mp-note]');
  const active = q('[data-mp-active]');
  const cancelled = q('[data-mp-cancelled]');
  const switchBtn = q<HTMLButtonElement>('[data-mp-switch]');
  const moveBtn = q<HTMLButtonElement>('[data-mp-move]');
  const resendBtn = q<HTMLButtonElement>('[data-mp-resend]');
  const pending = q('[data-mp-pending]');
  const cardToggle = q<HTMLButtonElement>('[data-mp-card-toggle]');
  const cardForm = q<HTMLFormElement>('[data-mp-card-form]');
  const inviteForm = q<HTMLFormElement>('[data-mp-invite-form]');
  let trigger: HTMLElement | null = null;

  const words = (s: Session) => {
    const state = { sku: s.sku, cadence: s.cadence, addedAt: 0 };
    return { name: cart.product(state).name, amount: cart.charge(state), date: cart.dateInWords(new Date(s.renewsOn)) };
  };
  const say = (text: string) => { note.textContent = text; note.hidden = !text; announce(text); };
  const render = () => {
    const s = current();
    const w = words(s);
    summary.textContent = P.summary.replace('{membership}', w.name).replace('{cadence}', s.cadence).replace('{date in words}', w.date).replace('{amount}', w.amount);
    switchBtn.textContent = s.cadence === 'monthly' ? P.switchYearly : P.switchMonthly;
    const two = SKUS[s.sku].product === 'two';
    moveBtn.hidden = two; resendBtn.hidden = !two; pending.hidden = !(two && s.invitePending);
    inviteForm.hidden = !(two && !s.invitePending && inviteForm.dataset.open === '1');
    active.hidden = s.cancelled; cancelled.hidden = !s.cancelled;
    if (s.cancelled && s.accessEnds) {
      q('[data-mp-cancelled-line]').textContent = P.cancelled.replace('{date in words}', cart.dateInWords(new Date(s.accessEnds)));
      q('[data-mp-ends]').textContent = cart.dateInWords(new Date(s.accessEnds));
    }
  };
  const open = (from?: HTMLElement) => {
    trigger = from || (document.activeElement as HTMLElement);
    render();
    panel.hidden = false;
    document.body.classList.add('panel-open');
    requestAnimationFrame(() => panel.classList.add('is-open'));
    heading.focus();
  };
  const close = () => {
    if (panel.hidden) return;
    panel.classList.remove('is-open');
    document.body.classList.remove('panel-open');
    const hide = () => { panel.hidden = true; };
    if (motionReduced()) hide(); else setTimeout(hide, 400);
    if (location.hash === '#membership') history.replaceState(null, '', location.pathname);
    trigger?.focus();
  };
  panel.querySelectorAll('[data-panel-close]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === heading)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-open-membership]');
    if (!a) return;
    e.preventDefault();
    history.replaceState(null, '', '#membership');
    open(a);
  });
  if (location.hash === '#membership') setTimeout(() => open(), 300);

  // click two: cancel at once; the Resume link stays until access ends
  q('[data-mp-cancel]').addEventListener('click', () => {
    const s = current();
    save({ cancelled: true, accessEnds: s.renewsOn });
    render();
    say('');
    announce(q('[data-mp-cancelled-line]').textContent || '');
    q<HTMLElement>('[data-mp-resume]').focus();
  });
  q('[data-mp-resume]').addEventListener('click', () => {
    save({ cancelled: false, accessEnds: null });
    render();
    const w = words(current());
    say(P.resumed.replace('{date in words}', w.date).replace('{amount}', w.amount));
    switchBtn.focus();
  });
  // the cadence switch takes effect at the next renewal
  switchBtn.addEventListener('click', () => {
    const s = current();
    const cadence: Cadence = s.cadence === 'monthly' ? 'yearly' : 'monthly';
    const sku = PRODUCTS[SKUS[s.sku].product][cadence].sku as Sku;
    save({ sku, cadence });
    render();
    const w = words(current());
    say(P.switchNote.replace('{date in words}', w.date).replace('{amount}', w.amount).replace('{cadence}', cadence));
  });
  // move to the Daily for Two from the next renewal
  moveBtn.addEventListener('click', () => {
    const s = current();
    const sku = PRODUCTS.two[s.cadence].sku as Sku;
    save({ sku, invitePending: false });
    render();
    const w = words(current());
    say(P.moved.replace('{membership}', w.name).replace('{date in words}', w.date).replace('{amount}', w.amount));
  });
  // the invite (Daily for Two)
  resendBtn.addEventListener('click', () => {
    const s = current();
    if (s.inviteEmail) { say(P.resent.replace('{email}', s.inviteEmail)); return; }
    inviteForm.dataset.open = '1';
    render();
    inviteForm.querySelector<HTMLInputElement>('input')!.focus();
  });
  inviteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const em = inviteForm.querySelector<HTMLInputElement>('input')!;
    const field = em.closest<HTMLElement>('.field')!;
    const err = inviteForm.querySelector<HTMLElement>('[data-error-for="invite"]')!;
    const v = em.value.trim();
    const problem = !isValidEmail(v) ? P.inviteFormat : v.toLowerCase() === current().email.toLowerCase() ? P.inviteSame : null;
    field.classList.toggle('is-error', !!problem); err.hidden = !problem; err.querySelector('[data-error-text]')!.textContent = problem || '';
    if (problem) { em.focus(); return; }
    save({ invitePending: true, inviteEmail: v });
    inviteForm.dataset.open = '0';
    render();
    say(P.resent.replace('{email}', v));
  });
  // update the card: the checkout's payment fields and errors
  cardToggle.addEventListener('click', () => {
    const open = cardToggle.getAttribute('aria-expanded') === 'true';
    cardToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    cardForm.hidden = open;
    if (!open) cardForm.querySelector<HTMLInputElement>('input')!.focus();
  });
  const M: CardMessages = { numberEmpty: P.numberEmpty, numberFormat: P.numberFormat, numberCheck: P.numberCheck, expiryEmpty: P.expiryEmpty, expiryPast: P.expiryPast, cvvEmpty: P.cvvEmpty, cvvFormat: P.cvvFormat, nameEmpty: P.ccNameEmpty };
  const cc = {
    name: cardForm.querySelector<HTMLInputElement>('#mp-ccname')!, number: cardForm.querySelector<HTMLInputElement>('#mp-ccnumber')!,
    mm: cardForm.querySelector<HTMLSelectElement>('#mp-ccmm')!, yyyy: cardForm.querySelector<HTMLSelectElement>('#mp-ccyyyy')!, cvv: cardForm.querySelector<HTMLInputElement>('#mp-cvv')!
  };
  cc.number.addEventListener('input', () => { cc.number.value = formatCardNumber(cc.number.value); });
  const showCard = (key: string, el: HTMLElement, msg: string | null) => {
    const wrap = el.closest<HTMLElement>('.field')!;
    const err = cardForm.querySelector<HTMLElement>(`[data-error-for="${key}"]`)!;
    wrap.classList.toggle('is-error', !!msg); err.hidden = !msg; err.querySelector('[data-error-text]')!.textContent = msg || '';
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  cardForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const problems: { key: string; el: HTMLElement; msg: string | null }[] = [
      { key: 'ccname', el: cc.name, msg: cardNameProblem(cc.name.value, M) },
      { key: 'ccnumber', el: cc.number, msg: cardNumberProblem(cc.number.value, M) },
      { key: 'expiry', el: cc.mm, msg: expiryProblem(cc.mm.value, cc.yyyy.value, M) },
      { key: 'cvv', el: cc.cvv, msg: cvvProblem(cc.cvv.value, cc.number.value, M) }
    ];
    problems.forEach((p) => showCard(p.key, p.el, p.msg));
    const errBox = cardForm.querySelector<HTMLElement>('[data-mp-card-errors]')!;
    const list = cardForm.querySelector<HTMLElement>('[data-mp-card-error-list]')!;
    list.innerHTML = '';
    const bad = problems.filter((p) => p.msg);
    if (bad.length) {
      for (const p of bad) { const li = document.createElement('li'); const a = document.createElement('a'); a.href = '#' + p.el.id; a.textContent = p.msg!; a.addEventListener('click', (ev) => { ev.preventDefault(); p.el.focus(); }); li.appendChild(a); list.appendChild(li); }
      errBox.hidden = false; errBox.focus(); return;
    }
    errBox.hidden = true;
    const four = lastFour(cc.number.value);
    cardForm.reset();
    cardForm.hidden = true; cardToggle.setAttribute('aria-expanded', 'false');
    say(P.cardDone.replace('{last four digits}', four));
    cardToggle.focus();
  });
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
