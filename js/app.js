/**
 * app.js — Gnoke Petroleum
 * Owns state. Wires all events. Uses library-pattern page routing.
 * No SQL. No DOM building.
 */

(async () => {

  /* ══════════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════════ */
  const today = new Date().toISOString().split('T')[0];

  const state = {
    // Entry page
    entryProductId : GP.PRODUCTS[0].id,
    entryDate      : today,

    // Reports page
    reportsProductId : GP.PRODUCTS[0].id,
    reportsDate      : today,
    reportsView      : 'summary',
  };

  /* ══════════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════════ */
  UI.setLoading(true);

  try {
    await DB.init();
  } catch (err) {
    UI.toast('Database failed to load. Please refresh.', 'error');
    console.error('[GP] DB init error:', err);
    UI.setLoading(false);
    return;
  }

  // Set date pickers to today
  _el('entry-date').value   = today;
  _el('reports-date').value = today;

  UI.setLoading(false);

  // Start on Entry page
  loadPage('entry-page');

  /* ══════════════════════════════════════════════════════════════
     PAGE ROUTING  (matches library pattern exactly)
  ══════════════════════════════════════════════════════════════ */

  function loadPage(pageId) {
    // Deactivate all pages and nav buttons
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));

    // Activate target page and matching nav/tab buttons
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
    document.querySelectorAll(`[data-page="${pageId}"]`).forEach(b => b.classList.add('active'));

    // Show/hide Save button — only useful on Entry page
    _el('btn-save').style.display = pageId === 'entry-page' ? '' : 'none';

    // Render the activated page
    switch (pageId) {
      case 'entry-page':
        UI.renderProductTabs('entry-product-tabs', state.entryProductId);
        UI.renderEntry({ productId: state.entryProductId, entryDate: state.entryDate });
        break;
      case 'reports-page':
        UI.renderProductTabs('reports-product-tabs', state.reportsProductId);
        UI.renderViewChips(state.reportsView);
        UI.renderReports({
          productId   : state.reportsProductId,
          reportsDate : state.reportsDate,
          reportsView : state.reportsView,
        });
        break;
      case 'settings-page':
        UI.renderSettings();
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     NAVIGATION WIRING  (library pattern)
  ══════════════════════════════════════════════════════════════ */

  // All [data-page] buttons (both drawer and tab bar)
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      loadPage(btn.dataset.page);
      // Close drawer if open
      _el('nav-drawer')?.classList.remove('open');
      _el('nav-overlay')?.classList.remove('show');
    });
  });

  // Hamburger
  const burger  = _el('burger-btn');
  const drawer  = _el('nav-drawer');
  const overlay = _el('nav-overlay');
  if (burger && drawer) {
    burger.addEventListener('click', () => {
      drawer.classList.toggle('open');
      overlay?.classList.toggle('show');
    });
    overlay?.addEventListener('click', () => {
      drawer.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  // Escape closes drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      drawer?.classList.remove('open');
      overlay?.classList.remove('show');
    }
  });

  /* ══════════════════════════════════════════════════════════════
     ENTRY PAGE EVENTS
  ══════════════════════════════════════════════════════════════ */

  // Product tab clicks (delegated to the entry tab container)
  document.getElementById('entry-product-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-product]');
    if (!btn) return;
    state.entryProductId = btn.dataset.product;
    UI.renderProductTabs('entry-product-tabs', state.entryProductId);
    UI.renderEntry({ productId: state.entryProductId, entryDate: state.entryDate });
  });

  // Date picker
  _el('entry-date').addEventListener('change', e => {
    state.entryDate = e.target.value;
    UI.renderEntry({ productId: state.entryProductId, entryDate: state.entryDate });
  });

  // Save button (topbar)
  _el('btn-save').addEventListener('click', async () => {
    if (!state.entryDate) {
      UI.toast('Please select a date first.', 'error');
      return;
    }
    const unitCount = DB.getUnitCount(state.entryProductId);
    let total = 0;

    for (let i = 1; i <= unitCount; i++) {
      const input = document.getElementById(`amt_${state.entryProductId}_${i}`);
      if (!input) continue;
      const val = parseFloat(input.value) || 0;
      if (val < 0) {
        UI.toast(`${GP.unitLabel(state.entryProductId, i)}: amount cannot be negative.`, 'error');
        return;
      }
      await DB.saveRecord(state.entryDate, state.entryProductId, i, val);
      total += val;
    }

    const p = GP.product(state.entryProductId);
    UI.toast(`Saved — ${p.full}: ${GP.CURRENCY}${total.toLocaleString('en-NG')}`, 'success');
    UI.renderEntry({ productId: state.entryProductId, entryDate: state.entryDate });
  });

  /* ══════════════════════════════════════════════════════════════
     REPORTS PAGE EVENTS
  ══════════════════════════════════════════════════════════════ */

  // Product tab clicks
  document.getElementById('reports-product-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-product]');
    if (!btn) return;
    state.reportsProductId = btn.dataset.product;
    UI.renderProductTabs('reports-product-tabs', state.reportsProductId);
    UI.renderReports({
      productId   : state.reportsProductId,
      reportsDate : state.reportsDate,
      reportsView : state.reportsView,
    });
  });

  // Date picker
  _el('reports-date').addEventListener('change', e => {
    state.reportsDate = e.target.value;
    UI.renderReports({
      productId   : state.reportsProductId,
      reportsDate : state.reportsDate,
      reportsView : state.reportsView,
    });
  });

  // View chips (week / month / all time)
  document.getElementById('view-chips').addEventListener('click', e => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    state.reportsView = btn.dataset.view;
    UI.renderViewChips(state.reportsView);
    UI.renderReports({
      productId   : state.reportsProductId,
      reportsDate : state.reportsDate,
      reportsView : state.reportsView,
    });
  });

  /* ══════════════════════════════════════════════════════════════
     SETTINGS PAGE EVENTS
  ══════════════════════════════════════════════════════════════ */

  // Add / remove units (delegated)
  document.getElementById('settings-products').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const { action, product } = btn.dataset;
    const p     = GP.product(product);
    const count = DB.getUnitCount(product);

    if (action === 'add') {
      await DB.setUnitCount(product, count + 1);
    } else if (action === 'remove') {
      if (count <= p.minUnits) {
        UI.toast(`Minimum ${p.minUnits} unit(s) for ${p.label}.`, 'info');
        return;
      }
      await DB.setUnitCount(product, count - 1);
    }
    UI.renderSettings();
  });

  // Save settings button (page header)
  _el('btn-settings-save').addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.unit-name-input');
    for (const input of inputs) {
      await DB.setUnitName(input.dataset.product, input.dataset.unit, input.value.trim());
    }
    UI.toast('Settings saved.', 'success');
  });

  /* ══════════════════════════════════════════════════════════════
     EXPORT CSV (topbar)
  ══════════════════════════════════════════════════════════════ */

  _el('btn-export').addEventListener('click', () => {
    // Export whichever product is currently active in the visible page
    const activePage = document.querySelector('.page.active');
    const pid = activePage?.id === 'reports-page'
      ? state.reportsProductId
      : state.entryProductId;

    const csv = DB.exportCSV(pid);
    if (!csv) {
      UI.toast('No records to export for this product.', 'info');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gnoke-petroleum_${pid}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('CSV downloaded.', 'success');
  });

  /* ── Utility ── */
  function _el(id) { return document.getElementById(id); }

})();
