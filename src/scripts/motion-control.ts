// The reduce motion switches (footer and mobile menu): one shared state, persisted, announced politely.
const KEY = 'savebrew.motion';
const root = document.documentElement;
function stored(): 'reduced' | 'full' | null {
  try { return (localStorage.getItem(KEY) as any) || null; } catch { return null; }
}
function isReduced(): boolean { return root.getAttribute('data-motion') === 'reduced'; }
function apply(reduced: boolean, announce = false) {
  if (reduced) root.setAttribute('data-motion', 'reduced'); else root.removeAttribute('data-motion');
  try { localStorage.setItem(KEY, reduced ? 'reduced' : 'full'); } catch { /* ignore */ }
  document.querySelectorAll<HTMLElement>('[data-motion-switch]').forEach((wrap) => {
    const btn = wrap.querySelector<HTMLElement>('[role="switch"]');
    const state = wrap.querySelector<HTMLElement>('[data-motion-state]');
    btn?.setAttribute('aria-checked', reduced ? 'true' : 'false');
    if (state) state.textContent = reduced ? wrap.dataset.stateOn || 'On' : wrap.dataset.stateOff || 'Off';
    if (announce) {
      const live = document.getElementById('sb-live');
      if (live) { live.textContent = ''; setTimeout(() => { live.textContent = reduced ? wrap.dataset.announceOn || '' : wrap.dataset.announceOff || ''; }, 50); }
    }
  });
}
// initial state: the stored choice (already applied before paint by the head script), else the OS setting is left to CSS
apply(isReduced() || stored() === 'reduced');
document.querySelectorAll<HTMLElement>('[data-motion-switch] [role="switch"]').forEach((btn) => {
  btn.addEventListener('click', () => apply(!isReduced(), true));
});
