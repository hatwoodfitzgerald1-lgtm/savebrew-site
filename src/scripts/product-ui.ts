// The product views inside the site: the stage scales to its container, the toggles click (Knot), the
// filter chips switch, the tabs switch views when several views share a group, and the action chips press.
// The dashboard agent replaces the tab links with real routes on /today, /rates and /goals.
function init(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.sb-app').forEach((app) => {
    if (app.dataset.ready) return;
    app.dataset.ready = '1';
    const stage = app.querySelector<HTMLElement>('.sb-app__stage')!;
    const phone = app.dataset.phone === 'true';
    const nativeW = phone ? 375 : 1440;
    if (app.dataset.page === 'true') {
      // page mode (the dashboard routes): no scaling; the phone layout switches in by the app's own width
      const fitPage = () => { stage.classList.toggle('is-phone', app.clientWidth < 700); };
      fitPage();
      new ResizeObserver(fitPage).observe(app);
    } else {
      const fit = () => { app.style.setProperty('--k', String(app.clientWidth / nativeW)); };
      fit();
      new ResizeObserver(fit).observe(app);
    }
    if (app.dataset.interactive === 'false') { stage.setAttribute('inert', ''); return; }
    stage.querySelectorAll<HTMLElement>('.toggle').forEach((t) => {
      t.addEventListener('click', () => {
        const on = t.getAttribute('aria-checked') === 'true';
        t.setAttribute('aria-checked', on ? 'false' : 'true');
        app.dispatchEvent(new CustomEvent('sb:product-toggle', { bubbles: true, detail: { label: t.getAttribute('aria-label'), on: !on } }));
      });
    });
    stage.querySelectorAll<HTMLElement>('.controls .chips .chip').forEach((c) => {
      c.addEventListener('click', () => {
        c.parentElement?.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
      });
    });
    stage.querySelectorAll<HTMLElement>('.item .chip').forEach((c) => {
      c.addEventListener('click', () => {
        c.classList.add('on');
        setTimeout(() => c.classList.remove('on'), 380);
        app.dispatchEvent(new CustomEvent('sb:product-chip', { bubbles: true, detail: { chip: c.textContent } }));
      });
    });
    stage.querySelectorAll<HTMLAnchorElement>('a[data-tab]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const group = app.closest<HTMLElement>('[data-product-group]');
        if (!group) return;            // a real link on the dashboard routes
        e.preventDefault();
        group.dispatchEvent(new CustomEvent('sb:product-view', { bubbles: true, detail: { view: a.dataset.tab } }));
      });
    });
    stage.querySelectorAll<HTMLAnchorElement>('a[data-product-link]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
  });
  // a group of views: [data-product-group] shows one .sb-app at a time by data-product; switch with sb:product-view or [data-show-view]
  root.querySelectorAll<HTMLElement>('[data-product-group]').forEach((group) => {
    if (group.dataset.ready) return;
    group.dataset.ready = '1';
    const show = (view: string) => {
      group.querySelectorAll<HTMLElement>('.sb-app').forEach((a) => { a.hidden = a.dataset.product !== view; });
      group.querySelectorAll<HTMLElement>('[data-show-view]').forEach((b) => b.setAttribute('aria-selected', b.dataset.showView === view ? 'true' : 'false'));
      group.dataset.view = view;
      group.querySelectorAll<HTMLElement>('.sb-app').forEach((a) => a.querySelectorAll('a[data-tab]').forEach((t) => { if (t.getAttribute('data-tab') === view) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); }));
    };
    group.addEventListener('sb:product-view', (e: any) => show(e.detail.view));
    group.querySelectorAll<HTMLElement>('[data-show-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.showView!)));
    show(group.dataset.view || 'today');
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
(window as any).sbProductUi = { init };
