// /today (design document 7.16): the five items' chips work (Open tracker, Remind me, Save code, Open playbook,
// Open worksheet), the Texts card's three switches persist and the card carries the verbatim opt in block when
// texts are off, the Saved items card fills from the chips, the "Your account" tile is editable and recomputes
// the gap, the link row leads to the archive, and the weekend line shows on a Saturday or Sunday.
import type { DashContext } from './dashboard';
import type { SavedItem } from './session';
import { motionReduced } from './ease';

const KNOT = '<svg aria-hidden="true"><use href="#knot"/></svg>';

export function initToday(ctx: DashContext) {
  const { stage, S, announce } = ctx;
  const q = <T extends HTMLElement>(sel: string) => stage.querySelector<T>(sel);
  const session = () => ctx.session;

  // ------------------------------------------------------------------ the five items carry their thread for the site's tab strip
  stage.querySelectorAll<HTMLElement>('.item').forEach((it) => {
    const name = it.querySelector('.thread')?.textContent?.trim().toLowerCase();
    if (name) it.dataset.thread = name;
  });

  // ------------------------------------------------------------------ the link row: real destinations
  const relink = (a: HTMLAnchorElement, href: string) => { const n = a.cloneNode(true) as HTMLAnchorElement; n.removeAttribute('data-product-link'); n.href = href; a.replaceWith(n); return n; };
  stage.querySelectorAll<HTMLAnchorElement>('.linkrow a').forEach((a) => {
    const text = a.textContent?.trim() || '';
    if (/yesterday/i.test(text)) { const n = relink(a, '/archive#2026-09-23'); n.setAttribute('aria-label', S.yesterdayAria); }
    else relink(a, '/archive');
  });
  stage.querySelectorAll<HTMLAnchorElement>('.goal a.link').forEach((a) => relink(a, '/goals'));

  // ------------------------------------------------------------------ the chips
  ctx.root.addEventListener('sb:product-chip', (e: any) => {
    const chip = String(e.detail?.chip || '').trim();
    if (chip === 'Open tracker') location.assign('/rates');
    else if (chip === 'Open worksheet') location.assign('/goals#worksheet');
    else if (chip === 'Remind me') addSaved({ id: 'cashback-2026-09-30', text: S.savedCashback, date: S.savedCashbackDate, kind: 'reminder' });
    else if (chip === 'Save code') addSaved({ id: 'coupon-2026-09-25', text: S.savedCoupon, date: S.savedCouponDate, kind: 'code' });
    else if (chip === 'Open playbook') openPlaybook();
  });

  // ------------------------------------------------------------------ saved items
  const rail = q('.rail');
  const savedCard = document.createElement('section');
  savedCard.className = 'card saved'; savedCard.setAttribute('aria-label', S.savedHeading);
  savedCard.innerHTML = `<h2></h2><div class="saved-body" style="margin-top:6px"></div>`;
  savedCard.querySelector('h2')!.textContent = S.savedHeading;
  rail?.appendChild(savedCard);
  const renderSaved = () => {
    const items = session().saved || [];
    const body = savedCard.querySelector<HTMLElement>('.saved-body')!;
    body.innerHTML = '';
    if (!items.length) { const p = document.createElement('div'); p.className = 'foot'; p.style.marginTop = '0'; p.textContent = S.savedEmpty; body.appendChild(p); return; }
    const list = document.createElement('div'); list.className = 'rows saved-list';
    for (const it of items) {
      const row = document.createElement('div'); row.className = 'row';
      const text = document.createElement('span'); text.textContent = it.text;
      const stamp = document.createElement('span'); stamp.className = 'stamp';
      stamp.textContent = (it.kind === 'reminder' ? S.savedReminder : S.savedCode).replace('{date}', it.date);
      row.append(text, stamp); list.appendChild(row);
    }
    body.appendChild(list);
  };
  const addSaved = (item: SavedItem) => {
    const items = (session().saved || []).filter((s) => s.id !== item.id);
    items.unshift(item);
    ctx.save({ saved: items });
    renderSaved();
    announce((item.kind === 'reminder' ? S.savedReminder : S.savedCode).replace('{date}', item.date) + ' ' + item.text);
    savedCard.classList.add('is-saved'); setTimeout(() => savedCard.classList.remove('is-saved'), 600);
  };
  renderSaved();

  // ------------------------------------------------------------------ the Texts card: switches persist; the verbatim block when texts are off
  const texts = q('.card.texts');
  if (texts) {
    const rows = texts.querySelector<HTMLElement>('.rows')!;
    const foot = texts.querySelector<HTMLElement>('.foot')!;
    const keys: Array<'rates' | 'goals' | 'billing'> = ['rates', 'goals', 'billing'];
    const toggles = Array.from(rows.querySelectorAll<HTMLElement>('.toggle'));
    const endLink = document.createElement('button');
    endLink.type = 'button'; endLink.className = 'link'; endLink.textContent = S.endTexts; endLink.style.marginTop = '8px';
    const holder = ctx.root.querySelector<HTMLElement>('[data-sms-holder]');
    const block = holder?.querySelector<HTMLElement>('.sms');
    const successLine = document.createElement('div'); successLine.className = 'foot'; successLine.hidden = true;
    const applyState = () => {
      const s = session();
      toggles.forEach((t, i) => t.setAttribute('aria-checked', s.texts[keys[i]] ? 'true' : 'false'));
      const on = s.texts.optedIn;
      rows.hidden = !on; foot.hidden = !on; endLink.hidden = !on;
      if (!on && block && block.parentElement !== texts) texts.appendChild(block);
      if (block) block.hidden = on;
    };
    texts.appendChild(endLink);
    texts.appendChild(successLine);
    toggles.forEach((t, i) => t.addEventListener('click', () => {
      const s = session();
      ctx.save({ texts: { ...s.texts, [keys[i]]: t.getAttribute('aria-checked') === 'true' } });
    }));
    endLink.addEventListener('click', () => {
      ctx.save({ texts: { ...session().texts, optedIn: false } });
      successLine.hidden = true;
      applyState();
      announce(S.bellOff);
      block?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
    });
    block?.addEventListener('sb:sms-joined', () => {
      ctx.save({ texts: { ...session().texts, optedIn: true, rates: true, goals: true, billing: true } });
      const success = block.querySelector<HTMLElement>('[data-sms-success]');
      successLine.textContent = success?.textContent || '';
      successLine.hidden = !successLine.textContent;
      // the block's own form comes back for the next time texts are ended
      setTimeout(() => {
        applyState();
        block.querySelectorAll<HTMLElement>('.sms__part, .sms__consent, .sms__field').forEach((el) => { el.hidden = false; });
        if (success) { success.hidden = true; success.textContent = ''; }
        block.querySelectorAll<HTMLInputElement>('input').forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
      }, motionReduced() ? 100 : 1400);
      announce(S.bellOn);
    });
    applyState();
  }

  // ------------------------------------------------------------------ the "Your account" tile is editable; the gap recomputes
  const tiles = Array.from(stage.querySelectorAll<HTMLElement>('.tiles .tile'));
  const own = tiles.find((t) => /Your account/i.test(t.querySelector('.label')?.textContent || ''));
  const gap = tiles.find((t) => /Gap to top/i.test(t.querySelector('.label')?.textContent || ''));
  const top = 4.0;
  if (own && gap) {
    const value = own.querySelector<HTMLElement>('.value')!;
    const note = own.querySelector<HTMLElement>('.note')!;
    const input = document.createElement('input');
    input.type = 'text'; input.inputMode = 'decimal'; input.setAttribute('aria-label', own.querySelector('.label')!.textContent || '');
    const rate = session().ownRate;
    input.value = rate == null ? '' : `${rate.toFixed(2)}%`;
    value.replaceWith(input);
    const baseNote = note.textContent || '';
    const gapValue = gap.querySelector<HTMLElement>('.value')!;
    const gapNote = gap.querySelector<HTMLElement>('.note')!;
    const balance = () => session().balance || 10000;
    const recompute = () => {
      const n = parseFloat(input.value.replace(/[^\d.]/g, ''));
      if (!input.value.trim() || isNaN(n)) { note.textContent = S.ownEmpty; gapValue.textContent = `${top.toFixed(2)} pts`; gapNote.textContent = `about $${Math.round((top / 100) * balance())} a year on $${balance().toLocaleString('en-US')}`; ctx.save({ ownRate: null }); return; }
      const g = Math.max(0, top - n);
      note.textContent = baseNote;
      gapValue.textContent = `${g.toFixed(2)} pts`;
      gapNote.textContent = `about $${Math.round((g / 100) * balance())} a year on $${balance().toLocaleString('en-US')}`;
      ctx.save({ ownRate: n });
    };
    input.addEventListener('input', recompute);
    input.addEventListener('blur', () => { const n = parseFloat(input.value.replace(/[^\d.]/g, '')); if (!isNaN(n)) input.value = `${n.toFixed(2)}%`; });
    recompute();
  }

  // ------------------------------------------------------------------ the weekend line
  try {
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date());
    if (day === 'Sat' || day === 'Sun') {
      const head = q('.brief-head');
      const line = document.createElement('div'); line.className = 'weekend-line'; line.textContent = S.weekend;
      head?.before(line);
    }
  } catch { /* the line stays off when the clock cannot be read */ }

  // ------------------------------------------------------------------ the October playbook as a sheet
  const sheet = ctx.root.querySelector<HTMLElement>('[data-playbook-sheet]');
  let sheetTrigger: HTMLElement | null = null;
  function openPlaybook() {
    if (!sheet) return;
    const summary = stage.querySelector<HTMLElement>('.item:nth-of-type(4) p')?.textContent || '';
    sheet.querySelector<HTMLElement>('[data-playbook-summary]')!.textContent = summary;
    sheetTrigger = document.activeElement as HTMLElement;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    sheet.querySelector<HTMLElement>('#playbook-heading')!.focus();
  }
  const closePlaybook = () => {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    const hide = () => { sheet.hidden = true; };
    if (motionReduced()) hide(); else setTimeout(hide, 400);
    sheetTrigger?.focus();
  };
  sheet?.querySelectorAll('[data-sheet-close]').forEach((b) => b.addEventListener('click', closePlaybook));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlaybook(); });
  sheet?.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  void KNOT;
}
