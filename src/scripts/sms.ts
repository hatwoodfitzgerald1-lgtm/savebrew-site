// The SMS opt in block's states (6.3): validate on blur with a short delay (not while typing), GOV.UK errors
// beside the field and in a summary above the button with the number preserved, sending, success (the form is
// replaced by the confirmation line), and the system failure line. The preview build stores nothing and sends nothing.
function digits(v: string): string { return v.replace(/\D/g, ''); }
function formatPhone(v: string): string {
  const d = digits(v).replace(/^1(?=\d{10}$)/, '');
  if (d.length !== 10) return v.trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`;
}
function init(form: HTMLFormElement) {
  if (form.dataset.ready) return;
  form.dataset.ready = '1';
  const S = JSON.parse(form.dataset.strings || '{}');
  const phone = form.querySelector<HTMLInputElement>('input[name="phone"]')!;
  const c1 = form.querySelector<HTMLInputElement>('input[name="consent1"]')!;
  const c2 = form.querySelector<HTMLInputElement>('input[name="consent2"]')!;
  const phoneField = form.querySelector<HTMLElement>('[data-sms-phone-field]')!;
  const phoneError = form.querySelector<HTMLElement>('[data-sms-phone-error]')!;
  const phoneErrorText = form.querySelector<HTMLElement>('[data-sms-phone-error-text]')!;
  const consentError = form.querySelector<HTMLElement>('[data-sms-consent-error]')!;
  const consentErrorText = form.querySelector<HTMLElement>('[data-sms-consent-error-text]')!;
  const summary = form.querySelector<HTMLElement>('[data-sms-summary]')!;
  const summaryList = form.querySelector<HTMLElement>('[data-sms-summary-list]')!;
  const success = form.querySelector<HTMLElement>('[data-sms-success]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-sms-submit]')!;
  const label = submit.querySelector<HTMLElement>('.bobbin__label')!;
  let blurTimer = 0;

  const phoneProblem = (): string | null => {
    const v = phone.value.trim();
    if (!v) return S.phoneEmpty;
    const d = digits(v).replace(/^1(?=\d{10}$)/, '');
    if (d.length !== 10) return S.phoneFormat;
    return null;
  };
  const consentProblem = (): string | null => {
    if (!c1.checked) return S.consent1;
    if (!c2.checked) return S.consent2;
    return null;
  };
  const showPhone = (msg: string | null) => {
    phoneField.classList.toggle('is-error', !!msg);
    phoneError.hidden = !msg;
    phoneErrorText.textContent = msg || '';
    phone.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const showConsent = (msg: string | null) => {
    consentError.hidden = !msg;
    consentErrorText.textContent = msg || '';
    (msg && !c1.checked ? c1 : c2).setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const showSummary = (problems: { msg: string; target: HTMLElement }[]) => {
    summaryList.innerHTML = '';
    for (const p of problems) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + p.target.id; a.textContent = p.msg;
      a.addEventListener('click', (e) => { e.preventDefault(); p.target.focus(); });
      li.appendChild(a); summaryList.appendChild(li);
    }
    summary.hidden = problems.length === 0;
    if (problems.length) summary.focus();
  };
  phone.addEventListener('blur', () => { clearTimeout(blurTimer); blurTimer = window.setTimeout(() => { if (phone.value.trim()) { phone.value = formatPhone(phone.value); showPhone(phoneProblem()); } }, 300); });
  phone.addEventListener('input', () => { if (!phoneError.hidden && !phoneProblem()) showPhone(null); });
  [c1, c2].forEach((c) => c.addEventListener('change', () => { if (!consentError.hidden && !consentProblem()) showConsent(null); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const problems: { msg: string; target: HTMLElement }[] = [];
    const p = phoneProblem(); showPhone(p); if (p) problems.push({ msg: p, target: phone });
    const c = consentProblem(); showConsent(c); if (c) problems.push({ msg: c, target: !c1.checked ? c1 : c2 });
    showSummary(problems);
    if (problems.length) return;
    // sending: the button is disabled for the duration only; the preview build sends nothing
    submit.disabled = true; submit.setAttribute('aria-busy', 'true');
    const original = label.textContent;
    label.textContent = S.sending;
    window.setTimeout(() => {
      submit.disabled = false; submit.removeAttribute('aria-busy'); label.textContent = original;
      const number = formatPhone(phone.value);
      form.querySelectorAll<HTMLElement>('.sms__part, .sms__consent, .sms__field').forEach((el) => { el.hidden = true; });
      success.textContent = String(S.success).replace('{phone}', number);
      success.hidden = false;
      form.dispatchEvent(new CustomEvent('sb:sms-joined', { bubbles: true, detail: { phone: number } }));
    }, 600);
  });
}
document.querySelectorAll<HTMLFormElement>('form[data-sms-form]').forEach(init);
