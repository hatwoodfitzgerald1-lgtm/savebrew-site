// /goals (design document 7.18): Add a goal (an inline form with GOV.UK errors, up to six), Adjust the deposit
// (an inline field that recomputes the status), Apply to a goal (a small chooser), the check in switches, the
// sub line recomputed as goals change, and the 50/30/20 worksheet (#worksheet) opened by the Today chip.
// SaveBrew records what the member types; it holds no money. Illustrative figures throughout.
import type { DashContext } from './dashboard';

interface Goal { id: string; name: string; saved: number; target: number; date: string; monthly: number; el: HTMLElement; status: 'ontrack' | 'behind' | null }
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const KNOT = '<svg aria-hidden="true"><use href="#knot"/></svg>';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function initGoals(ctx: DashContext) {
  const { stage, S, announce } = ctx;
  const q = <T extends HTMLElement>(sel: string) => stage.querySelector<T>(sel);
  const main = q('.main');
  const two = q('.two');
  if (!main || !two) return;
  const session = () => ctx.session;
  const stored = (session().goals || {}) as Record<string, { monthly?: number }>;

  // ------------------------------------------------------------------ the goals on the page
  const goals: Goal[] = [];
  const parseCard = (el: HTMLElement): Goal => {
    const name = el.querySelector('h2')?.textContent?.trim() || '';
    const saved = parseFloat((el.querySelector('.amount .fig')?.textContent || '0').replace(/[^\d.]/g, '')) || 0;
    const target = parseFloat((el.querySelector('.amount .of')?.textContent || '0').replace(/[^\d.]/g, '')) || 0;
    const stats = Array.from(el.querySelectorAll<HTMLElement>('.stat'));
    const date = stats.find((s) => /Target/i.test(s.querySelector('.label')?.textContent || ''))?.querySelector('.val')?.textContent?.trim() || '';
    const monthly = parseFloat((stats.find((s) => /deposit/i.test(s.querySelector('.label')?.textContent || ''))?.querySelector('.val')?.textContent || '0').replace(/[^\d.]/g, '')) || 0;
    return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, saved, target, date, monthly, el, status: null };
  };
  stage.querySelectorAll<HTMLElement>('.card.featured, .card.small').forEach((el) => goals.push(parseCard(el)));
  const monthsUntil = (date: string) => {
    const m = date.match(/([A-Za-z]{3})\w* (\d{4})/);
    if (!m) return 0;
    const idx = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase().slice(0, 3));
    const now = new Date();
    return Math.max(0, (Number(m[2]) - now.getFullYear()) * 12 + (idx - now.getMonth()));
  };
  const onTrack = (g: Goal) => g.saved + g.monthly * monthsUntil(g.date) >= g.target;
  const statusOf = (g: Goal) => (onTrack(g) ? S.onTrack : S.behind);
  const renderSubline = () => {
    const sub = q('.head .subline span');
    if (!sub) return;
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    const saved = goals.reduce((a, g) => a + g.saved, 0), target = goals.reduce((a, g) => a + g.target, 0);
    sub.textContent = S.goalsSubline.replace('{count}', words[goals.length] || String(goals.length)).replace('{saved}', money(saved)).replace('{target}', money(target));
    q('.head h1')?.setAttribute('aria-label', sub.textContent || '');
  };
  // the featured bar fills on load (Shuttle)
  stage.querySelectorAll<HTMLElement>('.bar-fill').forEach((b) => b.classList.add('dash-fill'));

  // ------------------------------------------------------------------ Adjust the deposit (an inline field replacing the link)
  const adjust = Array.from(stage.querySelectorAll<HTMLAnchorElement>('.card.small .line a.link')).find((a) => /Adjust the deposit/i.test(a.textContent || ''));
  if (adjust) {
    const card = adjust.closest<HTMLElement>('.card')!;
    const goal = goals.find((g) => g.el === card)!;
    if (stored[goal.id]?.monthly) goal.monthly = stored[goal.id].monthly!;
    const line = adjust.closest<HTMLElement>('.line')!;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'link'; btn.textContent = adjust.textContent; btn.style.fontSize = '13px'; btn.setAttribute('aria-expanded', 'false');
    adjust.replaceWith(btn);
    const form = document.createElement('form'); form.className = 'dash-form'; form.noValidate = true; form.hidden = true; form.setAttribute('aria-label', S.adjustLabel);
    form.innerHTML = `<label class="field"><span class="label"></span><input type="text" inputmode="numeric" name="monthly" /></label><p class="field-error" hidden>${KNOT}<span></span></p><div class="actions"><button class="btn" type="submit"></button></div><p class="done" role="status" aria-live="polite" hidden></p>`;
    form.querySelector('.label')!.textContent = S.adjustLabel;
    form.querySelector('.btn')!.textContent = S.adjustSubmit;
    const input = form.querySelector<HTMLInputElement>('input')!;
    input.value = money(goal.monthly);
    line.after(form);
    const statusChip = card.querySelector<HTMLElement>('.status')!;
    const depositVal = Array.from(card.querySelectorAll<HTMLElement>('.stat')).find((s) => /deposit/i.test(s.querySelector('.label')?.textContent || ''))?.querySelector<HTMLElement>('.val');
    const applyStatus = () => {
      const ok = onTrack(goal);
      statusChip.textContent = ok ? S.onTrack : S.behind;
      statusChip.classList.toggle('ok', ok); statusChip.classList.toggle('behind', !ok);
      if (depositVal) depositVal.textContent = money(goal.monthly);
    };
    if (stored[goal.id]?.monthly) applyStatus();
    btn.addEventListener('click', () => { const open = !form.hidden; form.hidden = open; btn.setAttribute('aria-expanded', open ? 'false' : 'true'); if (!open) input.focus(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = parseFloat(input.value.replace(/[^\d.]/g, ''));
      const err = form.querySelector<HTMLElement>('.field-error')!;
      const field = form.querySelector<HTMLElement>('.field')!;
      if (isNaN(n) || n <= 0) { err.hidden = false; err.querySelector('span')!.textContent = S.addErrDeposit; field.classList.add('is-error'); input.focus(); return; }
      err.hidden = true; field.classList.remove('is-error');
      goal.monthly = n; input.value = money(n);
      applyStatus();
      ctx.save({ goals: { ...(session().goals || {}), [goal.id]: { monthly: n } } });
      const done = form.querySelector<HTMLElement>('.done')!;
      done.textContent = S.adjustDone.replace('{amount}', money(n)).replace('{status}', statusOf(goal));
      done.hidden = false;
      announce(done.textContent);
    });
  }

  // ------------------------------------------------------------------ Add a goal (up to six)
  const addBtn = q<HTMLButtonElement>('.head .btn');
  if (addBtn) {
    addBtn.setAttribute('aria-expanded', 'false');
    const form = document.createElement('form'); form.className = 'dash-form add-goal'; form.noValidate = true; form.hidden = true; form.setAttribute('aria-label', addBtn.textContent || '');
    const field = (name: string, label: string, type: string, extra = '') => `<label class="field"><span class="label">${label}</span><input type="${type}" name="${name}" ${extra} /><p class="field-error" hidden>${KNOT}<span></span></p></label>`;
    form.innerHTML = `${field('name', S.addName, 'text', 'autocomplete="off"')}${field('target', S.addTarget, 'text', 'inputmode="numeric"')}${field('date', S.addDate, 'month', 'min="2026-10"')}${field('monthly', S.addDeposit, 'text', 'inputmode="numeric"')}<div class="actions"><button class="btn" type="submit"></button><button class="link" type="button" data-cancel></button></div><p class="done" role="status" aria-live="polite" hidden></p>`;
    form.querySelector('.btn')!.textContent = S.addSubmit;
    form.querySelector('[data-cancel]')!.textContent = S.addCancel;
    two.before(form);
    const inputs = () => Array.from(form.querySelectorAll<HTMLInputElement>('input'));
    const showErr = (input: HTMLInputElement, msg: string | null) => { const f = input.closest<HTMLElement>('.field')!; const err = f.querySelector<HTMLElement>('.field-error')!; f.classList.toggle('is-error', !!msg); err.hidden = !msg; err.querySelector('span')!.textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
    addBtn.addEventListener('click', () => {
      if (goals.length >= 6) { announce(S.addFull); const done = form.querySelector<HTMLElement>('.done')!; done.textContent = S.addFull; done.hidden = false; form.hidden = false; return; }
      const open = !form.hidden; form.hidden = open; addBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (!open) inputs()[0].focus();
    });
    form.querySelector('[data-cancel]')!.addEventListener('click', () => { form.hidden = true; addBtn.setAttribute('aria-expanded', 'false'); addBtn.focus(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const [name, target, date, monthly] = inputs();
      const problems: [HTMLInputElement, string | null][] = [
        [name, name.value.trim() ? null : S.addErrName],
        [target, parseFloat(target.value.replace(/[^\d.]/g, '')) > 0 ? null : S.addErrTarget],
        [date, date.value ? null : S.addErrDate],
        [monthly, parseFloat(monthly.value.replace(/[^\d.]/g, '')) > 0 ? null : S.addErrDeposit]
      ];
      problems.forEach(([i, m]) => showErr(i, m));
      const first = problems.find(([, m]) => m);
      if (first) { first[0].focus(); return; }
      const [yy, mm] = date.value.split('-').map(Number);
      const when = `${MONTHS[(mm || 1) - 1]} ${yy}`;
      const g: Goal = { id: name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(), name: name.value.trim(), saved: 0, target: parseFloat(target.value.replace(/[^\d.]/g, '')), date: when, monthly: parseFloat(monthly.value.replace(/[^\d.]/g, '')), el: document.createElement('section'), status: null };
      const card = g.el;
      card.className = 'card small'; card.setAttribute('aria-label', g.name);
      card.innerHTML = `<h2></h2><div class="amount"><span class="fig">$0</span><span class="of"></span><span class="pct">0%</span></div><div class="bar-track" aria-label="0 percent"><div class="bar-fill" style="width:0%"></div><span class="tick" style="left:25%"></span><span class="tick" style="left:50%"></span><span class="tick" style="left:75%"></span><span class="tick" style="left:100%"></span></div><div class="stats"><div class="stat"><div class="label">Target</div><div class="val"></div></div><div class="stat"><div class="label">Monthly deposit</div><div class="val"></div></div></div><div class="line"><span class="status"></span><span class="stamp"></span></div>`;
      card.querySelector('h2')!.textContent = g.name;
      card.querySelector('.of')!.textContent = `of ${money(g.target)}`;
      card.querySelectorAll<HTMLElement>('.stat .val')[0].textContent = g.date;
      card.querySelectorAll<HTMLElement>('.stat .val')[1].textContent = money(g.monthly);
      const st = card.querySelector<HTMLElement>('.status')!;
      const ok = onTrack(g); st.textContent = ok ? S.onTrack : S.behind; st.classList.add(ok ? 'ok' : 'behind');
      card.querySelector('.stamp')!.textContent = stage.querySelector('.card.small .line .stamp')?.textContent || '';
      two.appendChild(card);
      goals.push(g);
      renderSubline();
      form.reset(); form.hidden = true; addBtn.setAttribute('aria-expanded', 'false');
      announce(`${g.name}. ${st.textContent}.`);
      card.querySelector<HTMLElement>('h2')!.setAttribute('tabindex', '-1'); card.querySelector<HTMLElement>('h2')!.focus();
    });
  }

  // ------------------------------------------------------------------ Apply to a goal
  stage.querySelectorAll<HTMLAnchorElement>('.card.brief .row a.link').forEach((a) => {
    const row = a.closest<HTMLElement>('.row')!;
    const amount = row.querySelector('.fig')?.textContent?.trim() || '';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'link'; btn.textContent = a.textContent; btn.style.fontSize = '13px'; btn.setAttribute('aria-expanded', 'false');
    a.replaceWith(btn);
    const form = document.createElement('form'); form.className = 'dash-form'; form.noValidate = true; form.hidden = true; form.setAttribute('aria-label', S.applyLabel);
    form.innerHTML = `<label class="field"><span class="label"></span><select name="goal"></select></label><div class="actions"><button class="btn" type="submit"></button></div><p class="done" role="status" aria-live="polite" hidden></p>`;
    form.querySelector('.label')!.textContent = S.applyLabel;
    form.querySelector('.btn')!.textContent = S.applySubmit;
    row.appendChild(form);
    const fill = () => { const sel = form.querySelector<HTMLSelectElement>('select')!; sel.innerHTML = ''; goals.forEach((g) => { const o = document.createElement('option'); o.value = g.id; o.textContent = g.name; sel.appendChild(o); }); };
    btn.addEventListener('click', () => { const open = !form.hidden; form.hidden = open; btn.setAttribute('aria-expanded', open ? 'false' : 'true'); if (!open) { fill(); form.querySelector<HTMLSelectElement>('select')!.focus(); } });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const sel = form.querySelector<HTMLSelectElement>('select')!;
      const g = goals.find((x) => x.id === sel.value);
      const done = form.querySelector<HTMLElement>('.done')!;
      done.textContent = S.applyDone.replace('{amount}', amount.charAt(0).toUpperCase() + amount.slice(1)).replace('{goal}', g?.name || '');
      done.hidden = false;
      announce(done.textContent);
    });
  });

  // ------------------------------------------------------------------ check ins by text persist
  const checkins = Array.from(stage.querySelectorAll<HTMLElement>('.card.checkins .toggle'));
  const keys: Array<'weekly' | 'milestones'> = ['weekly', 'milestones'];
  checkins.forEach((t, i) => {
    const v = session().texts[keys[i]];
    if (v != null) t.setAttribute('aria-checked', v ? 'true' : 'false');
    t.addEventListener('click', () => ctx.save({ texts: { ...session().texts, [keys[i]]: t.getAttribute('aria-checked') === 'true' } }));
  });

  // ------------------------------------------------------------------ the 50/30/20 worksheet
  const ws = document.createElement('section');
  ws.className = 'card worksheet'; ws.id = 'worksheet'; ws.setAttribute('aria-label', S.wsHeading); ws.tabIndex = -1;
  ws.innerHTML = `<h2></h2><form class="dash-form" novalidate style="border:0;padding:0;margin-top:8px"><label class="field"><span class="label"></span><input type="text" inputmode="numeric" name="net" autocomplete="off" /></label></form><div class="cells"><div class="stat"><div class="label"></div><div class="val fig"></div></div><div class="stat"><div class="label"></div><div class="val fig"></div></div><div class="stat"><div class="label"></div><div class="val fig"></div></div></div><ol class="questions"></ol>`;
  ws.querySelector('h2')!.textContent = S.wsHeading;
  ws.querySelector('.field .label')!.textContent = S.wsInput;
  const labels = ws.querySelectorAll<HTMLElement>('.cells .label');
  [S.wsNeeds, S.wsWants, S.wsSaving].forEach((l, i) => { labels[i].textContent = l; });
  const qs = ws.querySelector('.questions')!;
  [S.wsQ1, S.wsQ2, S.wsQ3].forEach((text) => { const li = document.createElement('li'); li.innerHTML = KNOT; const span = document.createElement('span'); span.textContent = text; li.appendChild(span); qs.appendChild(li); });
  main.appendChild(ws);
  const net = ws.querySelector<HTMLInputElement>('input')!;
  const vals = ws.querySelectorAll<HTMLElement>('.cells .val');
  const compute = () => {
    const n = parseFloat(net.value.replace(/[^\d.]/g, ''));
    [0.5, 0.3, 0.2].forEach((p, i) => { vals[i].textContent = isNaN(n) ? '' : `${S.wsAbout} ${money(n * p)}`; });
  };
  net.addEventListener('input', compute);
  net.addEventListener('blur', () => { const n = parseFloat(net.value.replace(/[^\d.]/g, '')); if (!isNaN(n)) net.value = money(n); });
  ws.querySelector('form')!.addEventListener('submit', (e) => { e.preventDefault(); compute(); });
  compute();
  if (location.hash === '#worksheet') setTimeout(() => { ws.scrollIntoView({ block: 'start' }); net.focus(); }, 300);

  renderSubline();
}
