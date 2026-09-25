// /sign-in (design document 7.20): email plus an emailed sign in link by default, a password as the option.
// On the preview build any valid email opens the illustrative member Jordan's dashboard, and the page says so.
// GOV.UK errors (beside the field and in the summary), Enter submits, ?link=expired shows the expired line.
import { demoSession, setSession, isValidEmail } from './session';
import { motionReduced } from './ease';

const root = document.querySelector<HTMLElement>('[data-signin]');
if (root) {
  const S = JSON.parse(root.dataset.strings || '{}') as Record<string, string>;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const form = q<HTMLFormElement>('form');
  const email = q<HTMLInputElement>('#signin-email');
  const password = q<HTMLInputElement>('#signin-password');
  const emailField = email.closest<HTMLElement>('.field')!;
  const passwordField = password.closest<HTMLElement>('.field')!;
  const emailError = q('[data-error-for="email"]');
  const passwordError = q('[data-error-for="password"]');
  const summary = q('[data-error-summary]');
  const summaryList = q('[data-error-summary-list]');
  const sent = q('[data-signin-sent]');
  const sentLine = q('[data-signin-sent-line]');
  const linkPath = q('[data-path-link]');
  const passwordPath = q('[data-path-password]');
  let mode: 'link' | 'password' = 'link';
  let blurTimer = 0;
  let valid = false;

  const showError = (which: 'email' | 'password', msg: string | null) => {
    const field = which === 'email' ? emailField : passwordField;
    const err = which === 'email' ? emailError : passwordError;
    const control = which === 'email' ? email : password;
    field.classList.toggle('is-error', !!msg);
    err.hidden = !msg;
    err.querySelector('[data-error-text]')!.textContent = msg || '';
    control.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const emailProblem = () => { const v = email.value.trim(); return !v ? S.emailEmpty : !isValidEmail(v) ? S.emailFormat : null; };
  const passwordProblem = () => { const v = password.value; return !v ? S.passwordEmpty : v.length < 10 ? S.passwordShort : null; };
  const showSummary = (items: { msg: string; target: HTMLElement }[]) => {
    summaryList.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + it.target.id; a.textContent = it.msg;
      a.addEventListener('click', (e) => { e.preventDefault(); it.target.focus(); });
      li.appendChild(a); summaryList.appendChild(li);
    }
    summary.hidden = items.length === 0;
    if (items.length) summary.focus();
  };
  const stitch = () => {
    const ok = !emailProblem();
    if (ok !== valid) { valid = ok; document.dispatchEvent(new CustomEvent(ok ? 'sb:signin-valid' : 'sb:signin-invalid')); }
  };
  email.addEventListener('blur', () => { clearTimeout(blurTimer); blurTimer = window.setTimeout(() => { if (email.value.trim() || !emailError.hidden) showError('email', emailProblem()); stitch(); }, 300); });
  email.addEventListener('input', () => { if (!emailError.hidden && !emailProblem()) showError('email', null); stitch(); });
  password.addEventListener('input', () => { if (!passwordError.hidden && !passwordProblem()) showError('password', null); });

  const setMode = (m: 'link' | 'password') => {
    mode = m;
    linkPath.hidden = m !== 'link';
    passwordPath.hidden = m !== 'password';
    root.dataset.mode = m;
    if (m === 'password') password.focus(); else email.focus();
  };
  q('[data-password-toggle]').addEventListener('click', () => setMode('password'));
  q('[data-password-forgot]').addEventListener('click', () => setMode('link'));

  // an expired link (?link=expired) says so above the form
  if (/[?&]link=expired(&|$)/.test(location.search)) showSummary([{ msg: S.linkExpired, target: email }]);

  const openDashboard = (address: string) => {
    setSession(demoSession(address));
    location.assign('/today');
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const problems: { msg: string; target: HTMLElement }[] = [];
    const ep = emailProblem(); showError('email', ep); if (ep) problems.push({ msg: ep, target: email });
    if (mode === 'password') { const pp = passwordProblem(); showError('password', pp); if (pp) problems.push({ msg: pp, target: password }); }
    showSummary(problems);
    stitch();
    if (problems.length) return;
    const address = email.value.trim();
    if (mode === 'password') { openDashboard(address); return; }
    // the emailed link: the sent line stays readable for 1.5 seconds, then the preview build opens the dashboard
    sentLine.textContent = S.sentPattern.replace('{email}', address);
    sent.hidden = false;
    form.querySelector<HTMLElement>('[data-signin-form-body]')!.hidden = true;
    window.setTimeout(() => openDashboard(address), motionReduced() ? 800 : 1500);
  });
  q('[data-signin-again]').addEventListener('click', () => { sent.hidden = true; form.querySelector<HTMLElement>('[data-signin-form-body]')!.hidden = false; email.focus(); });
}
