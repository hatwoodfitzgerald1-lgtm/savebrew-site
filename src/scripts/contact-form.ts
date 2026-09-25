// The contact form's states (design document 7.12): validate on blur with a short delay (never while typing),
// GOV.UK errors beside the field and repeated in a summary linked to the fields, values preserved, text plus
// the knot glyph (never colour alone), "Sending your message" on the button in flight, then the success line
// replacing the form. The preview build posts nowhere and says so beneath the success line.
function init(form: HTMLFormElement) {
  if (form.dataset.ready) return;
  form.dataset.ready = '1';
  const S = JSON.parse(form.dataset.strings || '{}');
  const field = (name: string) => form.querySelector<HTMLElement>(`[data-field="${name}"]`)!;
  const input = (name: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#ct-${name}`)!;
  const summary = form.querySelector<HTMLElement>('[data-summary]')!;
  const summaryList = form.querySelector<HTMLElement>('[data-summary-list]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const label = submit.querySelector<HTMLElement>('.bobbin__label')!;
  const success = document.querySelector<HTMLElement>('[data-success]')!;
  const successText = success.querySelector<HTMLElement>('[data-success-text]')!;
  const successPreview = success.querySelector<HTMLElement>('[data-success-preview]')!;
  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const problem = (name: string): string | null => {
    const v = input(name).value.trim();
    if (name === 'name') return v ? null : S.name;
    if (name === 'email') return !v ? S.emailEmpty : emailOk(v) ? null : S.emailFormat;
    if (name === 'message') return v ? null : S.message;
    return null;
  };
  const show = (name: string, msg: string | null) => {
    const f = field(name);
    const err = f.querySelector<HTMLElement>('.field__error');
    const text = f.querySelector<HTMLElement>('[data-error-text]');
    if (!err || !text) return;
    f.classList.toggle('is-error', !!msg);
    err.hidden = !msg;
    text.textContent = msg || '';
    input(name).setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const required = ['name', 'email', 'message'];
  for (const name of required) {
    let timer = 0;
    const el = input(name);
    el.addEventListener('blur', () => { clearTimeout(timer); timer = window.setTimeout(() => { if (el.value.trim() || field(name).classList.contains('is-error')) show(name, problem(name)); }, 300); });
    el.addEventListener('input', () => { if (field(name).classList.contains('is-error') && !problem(name)) show(name, null); });
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const problems: { name: string; msg: string }[] = [];
    for (const name of required) { const p = problem(name); show(name, p); if (p) problems.push({ name, msg: p }); }
    summaryList.innerHTML = '';
    for (const p of problems) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#ct-' + p.name; a.textContent = p.msg;
      a.addEventListener('click', (ev) => { ev.preventDefault(); input(p.name).focus(); });
      li.appendChild(a); summaryList.appendChild(li);
    }
    summary.hidden = problems.length === 0;
    if (problems.length) { summary.focus(); return; }
    // in flight: the button reads "Sending your message"; the preview build sends nothing and says so
    submit.disabled = true; submit.setAttribute('aria-busy', 'true');
    const original = label.textContent;
    label.textContent = S.sending;
    window.setTimeout(() => {
      submit.disabled = false; submit.removeAttribute('aria-busy'); label.textContent = original;
      successText.textContent = String(S.success).replace('{email}', input('email').value.trim());
      successPreview.textContent = S.preview;
      form.hidden = true;
      success.hidden = false;
      success.focus?.();
      const live = document.getElementById('sb-live');
      if (live) live.textContent = successText.textContent;
    }, 700);
  });
}
document.querySelectorAll<HTMLFormElement>('[data-contact-form]').forEach(init);
