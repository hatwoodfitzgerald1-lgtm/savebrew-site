// /archive (design document 7.19): the search filters the entries to briefs whose headlines or summaries mention
// the query (no match shows the empty line), the date select jumps to an entry, and each entry opens that
// morning's whole pass inline in the Today layout (also on /archive#2026-09-23). The chips inside a pass work
// like today's: Open tracker, Remind me, Save code, Open playbook, Open worksheet.
import type { DashContext } from './dashboard';
import { motionReduced } from './ease';

export function initArchive(ctx: DashContext) {
  const { stage, S, announce } = ctx;
  const q = <T extends HTMLElement>(sel: string) => stage.querySelector<T>(sel);
  const search = q<HTMLInputElement>('[data-arch-search]');
  const date = q<HTMLSelectElement>('[data-arch-date]');
  const empty = q('[data-arch-empty]');
  const entries = Array.from(stage.querySelectorAll<HTMLElement>('.arch-entry'));
  const pattern = empty?.dataset.pattern || S.archiveEmpty;

  const setOpen = (entry: HTMLElement, open: boolean) => {
    const btn = entry.querySelector<HTMLButtonElement>('[data-arch-open]')!;
    const pass = entry.querySelector<HTMLElement>('.arch-pass')!;
    pass.hidden = !open;
    entry.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? btn.dataset.close || '' : btn.dataset.open || '';
  };
  entries.forEach((entry) => {
    const btn = entry.querySelector<HTMLButtonElement>('[data-arch-open]')!;
    btn.addEventListener('click', () => setOpen(entry, btn.getAttribute('aria-expanded') !== 'true'));
    // the whole row opens the pass too (a click on a headline), not the chip inside the pass
    entry.querySelector<HTMLElement>('.arch-row')?.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button, a')) return; setOpen(entry, btn.getAttribute('aria-expanded') !== 'true'); });
  });
  const openHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    setOpen(entry, true);
    if (date) date.value = id;
    setTimeout(() => { entry.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'auto' : 'smooth' }); entry.querySelector<HTMLElement>('[data-arch-open]')?.focus({ preventScroll: true }); }, 300);
  };
  if (location.hash) openHash();
  window.addEventListener('hashchange', openHash);

  // the date select jumps to an entry
  date?.addEventListener('change', () => {
    if (!date.value) return;
    if (search) { search.value = ''; filter(); }
    history.replaceState(null, '', '#' + date.value);
    openHash();
  });

  // the search filters by topic
  const filter = () => {
    const term = (search?.value || '').trim().toLowerCase();
    let shown = 0;
    entries.forEach((e) => { const hit = !term || (e.dataset.text || '').includes(term); e.hidden = !hit; if (hit) shown++; });
    if (empty) { empty.hidden = shown > 0; empty.textContent = shown ? '' : pattern.replace('{query}', search?.value.trim() || ''); }
    if (term && !shown) announce(empty?.textContent || '');
  };
  let timer = 0;
  search?.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(filter, 150); });
  search?.closest('form')?.addEventListener('submit', (e) => { e.preventDefault(); filter(); });

  // the chips inside a pass work like today's
  ctx.root.addEventListener('sb:product-chip', (e: any) => {
    const chip = String(e.detail?.chip || '').trim();
    if (chip === 'Open tracker') location.assign('/rates');
    else if (chip === 'Open worksheet') location.assign('/goals#worksheet');
    else if (chip === 'Open playbook') location.assign('/today');
    else if (chip === 'Remind me' || chip === 'Save code') {
      const item = chip === 'Remind me'
        ? { id: 'cashback-2026-09-30', text: S.savedCashback, date: S.savedCashbackDate, kind: 'reminder' as const }
        : { id: 'coupon-2026-09-25', text: S.savedCoupon, date: S.savedCouponDate, kind: 'code' as const };
      const items = (ctx.session.saved || []).filter((s) => s.id !== item.id);
      items.unshift(item);
      ctx.save({ saved: items });
      announce((item.kind === 'reminder' ? S.savedReminder : S.savedCode).replace('{date}', item.date) + ' ' + item.text);
    }
  });
}
