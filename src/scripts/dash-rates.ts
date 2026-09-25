// /rates (design document 7.17): the filter chips filter the table, the Balance input recomputes the earnings
// column, the sort control reorders, "13 more" expands the table to twenty rows and "Show 7" collapses it,
// selecting a row opens it in the detail panel (the 30 day line draws), the alert threshold flips the row's
// alert on, and "Set an alert" focuses the threshold. Illustrative figures throughout; nothing is live.
import type { DashContext } from './dashboard';

interface Row { tr: HTMLTableRowElement; bank: string; product: string; apy: number; change: number; min: number; extra: boolean }

const EXTRA: [string, string, number, number, number][] = [
  ['Bank H', 'High yield savings', 3.65, 0.05, 0], ['Bank I', 'High yield savings', 3.6, 0, 0], ['Bank J', '12 month CD', 3.3, 0, 500],
  ['Bank K', 'Money market', 3.0, 0, 1000], ['Bank L', 'High yield savings', 2.75, 0, 0], ['Bank M', '6 month CD', 2.5, 0, 500],
  ['Bank N', 'High yield savings', 2.25, 0, 0], ['Bank O', 'Money market', 2.0, 0, 2500], ['Bank P', '12 month CD', 1.75, 0, 1000],
  ['Bank Q', 'High yield savings', 1.5, 0, 0], ['Bank R', 'High yield savings', 1.25, 0, 0], ['Bank S', 'Money market', 1.0, 0, 0], ['Bank T', 'High yield savings', 0.5, 0, 0]
];
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function initRates(ctx: DashContext) {
  const { stage, S, announce } = ctx;
  const q = <T extends HTMLElement>(sel: string) => stage.querySelector<T>(sel);
  const table = q<HTMLTableElement>('table');
  const tbody = table?.querySelector('tbody');
  if (!table || !tbody) return;
  const session = () => ctx.session;
  const rows: Row[] = [];
  const parse = (tr: HTMLTableRowElement, extra = false): Row => {
    const bank = (tr.querySelector('.inst-cell .name')?.childNodes[0]?.textContent || '').trim();
    const product = tr.querySelector('.product')?.textContent?.trim() || '';
    const apy = parseFloat(tr.querySelector('.apy')?.textContent || '0');
    const changeText = tr.querySelector('.change')?.textContent?.trim() || '0';
    const change = (tr.querySelector('.change .down') ? -1 : 1) * Math.abs(parseFloat(changeText.replace(/[^\d.]/g, '')) || 0);
    const min = parseFloat((tr.querySelector('.min')?.textContent || '0').replace(/[^\d.]/g, '')) || 0;
    return { tr, bank, product, apy, change, min, extra };
  };
  tbody.querySelectorAll<HTMLTableRowElement>('tr').forEach((tr) => rows.push(parse(tr)));
  // the thirteen more rows, from Bank H (the brief's 3.65 percent) down to Bank T, so the sub line's twenty is true
  const template = rows[1].tr;
  for (const [bank, product, apy, change, min] of EXTRA) {
    const tr = template.cloneNode(true) as HTMLTableRowElement;
    tr.classList.remove('selected');
    tr.querySelector('.mono')!.textContent = 'B' + bank.slice(-1);
    tr.querySelector('.inst-cell .name')!.innerHTML = `${bank} <small>(illustrative)</small>`;
    tr.querySelector('.product')!.textContent = product;
    tr.querySelector('.apy')!.textContent = `${apy.toFixed(2)}%`;
    const ch = tr.querySelector('.change')!;
    ch.innerHTML = change > 0 ? `<span class="up"><svg aria-hidden="true"><use href="#i-up"/></svg>+${change.toFixed(2)}</span>` : `<span class="flat">0.00</span>`;
    tr.querySelector('.min')!.textContent = money(min);
    const tg = tr.querySelector('.alert .toggle');
    if (tg) { tg.setAttribute('aria-checked', 'false'); tg.setAttribute('aria-label', `Alert on ${bank}`); }
    tr.hidden = true;
    tbody.appendChild(tr);
    rows.push(parse(tr, true));
    tr.querySelector<HTMLElement>('.toggle')?.addEventListener('click', (ev) => { const t = ev.currentTarget as HTMLElement; t.setAttribute('aria-checked', t.getAttribute('aria-checked') === 'true' ? 'false' : 'true'); onToggle(tr); });
  }
  rows.forEach((r) => { r.tr.tabIndex = 0; r.tr.setAttribute('aria-label', `${r.bank}, ${r.product}, ${r.apy.toFixed(2)}% APY`); });
  let expanded = false;
  let filter = 'All';
  let sort = 'high';

  // ------------------------------------------------------------------ the balance input and the earnings column
  const balanceField = Array.from(stage.querySelectorAll<HTMLElement>('.controls .field')).find((f) => /Balance/i.test(f.querySelector('.label')?.textContent || ''));
  const earnHead = Array.from(table.querySelectorAll<HTMLElement>('thead th')).find((th) => /would earn/i.test(th.textContent || ''));
  const balanceInput = document.createElement('input');
  balanceInput.className = 'fig dash-balance'; balanceInput.type = 'text'; balanceInput.inputMode = 'numeric';
  balanceInput.setAttribute('aria-label', S.balanceLabel);
  balanceInput.value = money(session().balance || 10000);
  if (balanceField) { balanceField.querySelector('.fig')?.replaceWith(balanceInput); }
  const balance = () => { const n = parseFloat(balanceInput.value.replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; };
  const recomputeEarn = () => {
    const b = balance();
    rows.forEach((r) => { r.tr.querySelector('.earn')!.textContent = money((r.apy / 100) * b); });
    if (earnHead) earnHead.textContent = `At this APY ${money(b)} would earn about`;
    ctx.save({ balance: b });
  };
  balanceInput.addEventListener('input', recomputeEarn);
  balanceInput.addEventListener('blur', () => { balanceInput.value = money(balance()); });
  recomputeEarn();

  // ------------------------------------------------------------------ the sort control
  const sortField = q('.controls .sort');
  if (sortField) {
    const select = document.createElement('select');
    select.className = 'dash-sort'; select.setAttribute('aria-label', S.sortLabel);
    for (const [v, label] of [['high', S.sortHigh], ['low', S.sortLow], ['change', S.sortChange]]) { const o = document.createElement('option'); o.value = v; o.textContent = label; select.appendChild(o); }
    sortField.querySelectorAll('span:not(.label), svg').forEach((el) => el.remove());
    sortField.appendChild(select);
    select.addEventListener('change', () => { sort = select.value; apply(); });
  }

  // ------------------------------------------------------------------ the filter chips
  stage.querySelectorAll<HTMLElement>('.controls .chips .chip').forEach((c) => c.addEventListener('click', () => { filter = c.textContent?.trim() || 'All'; apply(); }));
  const matches = (r: Row) => filter === 'All' || (filter === 'Savings' && /savings/i.test(r.product)) || (filter === 'CDs' && /CD/.test(r.product)) || (filter === 'Money market' && /money market/i.test(r.product));
  const apply = () => {
    const visible = rows.filter((r) => (expanded || !r.extra) && matches(r));
    const sorted = [...visible].sort((a, b) => (sort === 'high' ? b.apy - a.apy : sort === 'low' ? a.apy - b.apy : b.change - a.change || b.apy - a.apy));
    rows.forEach((r) => { r.tr.hidden = true; });
    sorted.forEach((r) => { r.tr.hidden = false; tbody.appendChild(r.tr); });
  };

  // ------------------------------------------------------------------ 13 more / Show 7
  const more = q<HTMLAnchorElement>('.more a.link');
  if (more) {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'link'; btn.textContent = more.textContent; btn.setAttribute('aria-expanded', 'false');
    more.replaceWith(btn);
    const label13 = btn.textContent || '13 more';
    btn.addEventListener('click', () => { expanded = !expanded; btn.textContent = expanded ? S.show7 : label13; btn.setAttribute('aria-expanded', expanded ? 'true' : 'false'); apply(); });
  }

  // ------------------------------------------------------------------ the detail panel
  const detail = q('.card.detail');
  const alertInput = document.createElement('input');
  alertInput.className = 'fig dash-alert'; alertInput.type = 'text'; alertInput.inputMode = 'decimal'; alertInput.setAttribute('aria-label', S.alertLabel);
  const alertEmpty = document.createElement('div'); alertEmpty.className = 'foot'; alertEmpty.hidden = true; alertEmpty.textContent = S.alertsEmpty;
  let selected: Row = rows[0];
  if (detail) {
    const field = detail.querySelector<HTMLElement>('.field');
    if (field) { field.innerHTML = ''; field.appendChild(alertInput); const edit = document.createElement('span'); edit.className = 'label'; edit.textContent = '%'; field.appendChild(edit); }
    detail.appendChild(alertEmpty);
    alertInput.addEventListener('change', () => {
      const n = parseFloat(alertInput.value.replace(/[^\d.]/g, ''));
      if (isNaN(n)) return;
      alertInput.value = n.toFixed(2);
      const below = { ...(session().alertBelow || {}), [selected.bank]: n };
      const alerts = { ...(session().alerts || {}), [selected.bank]: true };
      ctx.save({ alertBelow: below, alerts });
      selected.tr.querySelector('.toggle')?.setAttribute('aria-checked', 'true');
      alertEmpty.hidden = true;
      announce(S.alertOn.replace('{bank}', selected.bank).replace('{rate}', `${n.toFixed(2)}%`));
    });
  }
  const chart = detail?.querySelector<SVGSVGElement>('.chart svg');
  const renderDetail = (r: Row, draw = true) => {
    if (!detail) return;
    selected = r;
    rows.forEach((x) => x.tr.classList.toggle('selected', x === r));
    detail.setAttribute('aria-label', `${r.bank} detail`);
    detail.querySelector('h2')!.textContent = `${r.bank}, ${r.product}`;
    detail.querySelector('.big')!.innerHTML = `${r.apy.toFixed(2)}%<small>APY</small>`;
    const prev = r.apy - 0.05, prev2 = r.apy - 0.1;
    const hist = detail.querySelectorAll<HTMLElement>('.rows .row .fig');
    if (hist[0]) hist[0].textContent = `${prev.toFixed(2)} to ${r.apy.toFixed(2)}`;
    if (hist[1]) hist[1].textContent = `${prev2.toFixed(2)} to ${prev.toFixed(2)}`;
    if (chart) {
      const ticks = chart.querySelectorAll<SVGTextElement>('g[text-anchor="end"] text');
      if (ticks[0]) ticks[0].textContent = (r.apy + 0.25).toFixed(2);
      if (ticks[1]) ticks[1].textContent = r.apy.toFixed(2);
      if (ticks[2]) ticks[2].textContent = (r.apy - 0.25).toFixed(2);
      const path = chart.querySelector<SVGPathElement>('path');
      if (path && draw) { path.classList.remove('dash-line'); void path.getBoundingClientRect(); path.classList.add('dash-line'); }
      detail.querySelector('.chart')?.setAttribute('aria-label', `30 day line from ${prev.toFixed(2)} to ${r.apy.toFixed(2)}`);
    }
    const on = !!(session().alerts || {})[r.bank];
    const below = (session().alertBelow || {})[r.bank];
    alertInput.value = (below != null ? below : r.apy - 0.1).toFixed(2);
    alertEmpty.hidden = on;
  };
  const onToggle = (tr: HTMLTableRowElement) => {
    const r = rows.find((x) => x.tr === tr)!;
    const on = tr.querySelector('.toggle')?.getAttribute('aria-checked') === 'true';
    ctx.save({ alerts: { ...(session().alerts || {}), [r.bank]: on } });
    if (r === selected) alertEmpty.hidden = on;
    announce((on ? S.alertOn : S.alertOff).replace('{bank}', r.bank).replace('{rate}', `${((session().alertBelow || {})[r.bank] ?? r.apy - 0.1).toFixed(2)}%`));
  };
  rows.filter((r) => !r.extra).forEach((r) => r.tr.querySelector<HTMLElement>('.toggle')?.addEventListener('click', () => onToggle(r.tr)));
  // alerts persisted in the session
  rows.forEach((r) => { const a = (session().alerts || {})[r.bank]; if (a != null) r.tr.querySelector('.toggle')?.setAttribute('aria-checked', a ? 'true' : 'false'); });
  // selecting a row: click, Enter or Space (not on the toggle)
  tbody.addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t.closest('.toggle')) return; const tr = t.closest('tr'); const r = rows.find((x) => x.tr === tr); if (r) renderDetail(r); });
  tbody.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const t = e.target as HTMLElement; if (t.closest('.toggle')) return; const tr = t.closest('tr'); const r = rows.find((x) => x.tr === tr); if (r) { e.preventDefault(); renderDetail(r); } });
  renderDetail(rows[0], false);
  setTimeout(() => chart?.querySelector('path')?.classList.add('dash-line'), 200);

  // ------------------------------------------------------------------ Set an alert
  q('.head .btn')?.addEventListener('click', () => { alertInput.focus(); alertInput.select(); });
  apply();
}
