/**
 * ui.js — Gnoke Petroleum
 * Pure rendering. Reads state + DB, writes to DOM.
 * No business logic, no event wiring (that's app.js).
 */

const UI = (() => {

  /* ── Date helpers ──────────────────────────────────────────────── */

  function _weekRange(dateStr) {
    const d   = new Date(dateStr);
    const day = d.getDay();
    const start = new Date(d); start.setDate(d.getDate() - day);
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    return {
      start: start.toISOString().split('T')[0],
      end  : end.toISOString().split('T')[0],
    };
  }

  function _monthRange(dateStr) {
    const [y, m] = dateStr.split('-');
    const last   = new Date(y, m, 0).getDate();
    return {
      start: `${y}-${m}-01`,
      end  : `${y}-${m}-${String(last).padStart(2,'0')}`,
    };
  }

  function _fmt(amount) {
    return GP.CURRENCY + Number(amount || 0).toLocaleString('en-NG');
  }

  function _emptyRow(cols, msg) {
    return `<tr><td colspan="${cols}" class="empty-cell">${msg}</td></tr>`;
  }

  /* ── Product tabs ──────────────────────────────────────────────── */

  function renderProductTabs(containerId, activeId) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.innerHTML = GP.PRODUCTS.map(p => `
      <button
        class="prod-tab ${p.id === activeId ? 'active' : ''}"
        data-product="${p.id}"
        aria-pressed="${p.id === activeId}"
      >
        <span class="prod-tab-icon">${p.icon}</span>
        <span>${p.label}</span>
      </button>
    `).join('');
  }

  /* ── Entry page ────────────────────────────────────────────────── */

  function renderEntry(state) {
    const { productId, entryDate } = state;
    const p         = GP.product(productId);
    const unitCount = DB.getUnitCount(productId);
    const saved     = DB.getDay(entryDate, productId);
    const savedMap  = {};
    saved.forEach(r => { savedMap[r.unit_id] = r.amount; });

    document.getElementById('entry-header').textContent =
      `Daily Entry — ${p.full}`;

    document.getElementById('entry-thead').innerHTML = `
      <tr>
        <th>Unit</th>
        <th>Attendant</th>
        <th class="num">Amount (₦)</th>
      </tr>`;

    let rows = '';
    for (let i = 1; i <= unitCount; i++) {
      const name = DB.getUnitName(productId, i) || GP.unitLabel(productId, i);
      const val  = savedMap[i] !== undefined ? savedMap[i] : '';
      rows += `
        <tr>
          <td class="unit-cell">${GP.unitLabel(productId, i)}</td>
          <td>${name}</td>
          <td class="num">
            <input
              class="amount-input"
              type="number" min="0" inputmode="numeric"
              id="amt_${productId}_${i}"
              value="${val}" placeholder="0"
              data-unit="${i}"
            >
          </td>
        </tr>`;
    }

    document.getElementById('entry-tbody').innerHTML =
      rows || _emptyRow(3, 'No units configured — check Settings.');
  }

  /* ── Reports page ──────────────────────────────────────────────── */

  function renderReports(state) {
    const { productId, reportsDate, reportsView } = state;
    const p        = GP.product(productId);
    const headerEl = document.getElementById('reports-header');
    const thead    = document.getElementById('reports-thead');
    const tbody    = document.getElementById('reports-tbody');
    const dateWrap = document.getElementById('reports-date-wrap');

    // Hide date picker for all-time summary only
    if (dateWrap) {
      dateWrap.style.display = reportsView === 'summary' ? 'none' : '';
    }

    switch (reportsView) {

      case 'day': {
        headerEl.textContent = `Daily — ${p.full} (${reportsDate})`;
        thead.innerHTML = `<tr><th>Unit</th><th>Attendant</th><th class="num">Amount (₦)</th></tr>`;

        const rows      = DB.getDay(reportsDate, productId);
        const unitCount = DB.getUnitCount(productId);
        let html = '', total = 0;

        for (let i = 1; i <= unitCount; i++) {
          const record = rows.find(r => r.unit_id === i);
          const name   = DB.getUnitName(productId, i) || GP.unitLabel(productId, i);
          const amount = record ? record.amount : 0;
          html  += `<tr><td>${GP.unitLabel(productId, i)}</td><td>${name}</td><td class="num">${_fmt(amount)}</td></tr>`;
          total += amount;
        }
        if (html) html += `<tr class="summary-row"><td colspan="2">DAY TOTAL</td><td class="num">${_fmt(total)}</td></tr>`;
        tbody.innerHTML = html || _emptyRow(3, 'No records for this day.');
        break;
      }

      case 'week': {
        const { start, end } = _weekRange(reportsDate);
        headerEl.textContent = `Weekly — ${p.full} (${start} → ${end})`;
        thead.innerHTML = `<tr><th>Date</th><th>Unit</th><th class="num">Amount (₦)</th></tr>`;

        const rows = DB.getRange(start, end, productId);
        let html = '', total = 0;
        rows.forEach(r => {
          const name = DB.getUnitName(productId, r.unit_id) || GP.unitLabel(productId, r.unit_id);
          html  += `<tr><td>${r.date}</td><td>${name}</td><td class="num">${_fmt(r.amount)}</td></tr>`;
          total += r.amount;
        });
        if (html) html += `<tr class="summary-row"><td colspan="2">WEEK TOTAL</td><td class="num">${_fmt(total)}</td></tr>`;
        tbody.innerHTML = html || _emptyRow(3, 'No records for this week.');
        break;
      }

      case 'month': {
        const { start, end } = _monthRange(reportsDate);
        headerEl.textContent = `Monthly — ${p.full} (${reportsDate.substring(0,7)})`;
        thead.innerHTML = `<tr><th>Date</th><th>Unit</th><th class="num">Amount (₦)</th></tr>`;

        const rows = DB.getRange(start, end, productId);
        let html = '', total = 0;
        rows.forEach(r => {
          const name = DB.getUnitName(productId, r.unit_id) || GP.unitLabel(productId, r.unit_id);
          html  += `<tr><td>${r.date}</td><td>${name}</td><td class="num">${_fmt(r.amount)}</td></tr>`;
          total += r.amount;
        });
        if (html) html += `<tr class="summary-row"><td colspan="2">MONTH TOTAL</td><td class="num">${_fmt(total)}</td></tr>`;
        tbody.innerHTML = html || _emptyRow(3, 'No records for this month.');
        break;
      }

      case 'summary':
      default: {
        headerEl.textContent = `All-Time — ${p.full}`;
        thead.innerHTML = `<tr><th>Unit</th><th class="num">Total Sales (₦)</th></tr>`;

        const rows = DB.getAllTime(productId);
        let html = '', grand = 0;
        rows.forEach(r => {
          const name = DB.getUnitName(productId, r.unit_id) || GP.unitLabel(productId, r.unit_id);
          html  += `<tr><td>${name}</td><td class="num">${_fmt(r.total)}</td></tr>`;
          grand += r.total;
        });
        if (html) html += `<tr class="summary-row"><td>GRAND TOTAL</td><td class="num">${_fmt(grand)}</td></tr>`;
        tbody.innerHTML = html || _emptyRow(2, `No records yet for ${p.full}.`);
        break;
      }
    }
  }

  /* ── Settings page ─────────────────────────────────────────────── */

  function renderSettings() {
    const wrap = document.getElementById('settings-products');
    if (!wrap) return;

    wrap.innerHTML = GP.PRODUCTS.map(p => {
      const count = DB.getUnitCount(p.id);
      let units   = '';
      for (let i = 1; i <= count; i++) {
        const name = DB.getUnitName(p.id, i);
        units += `
          <div class="unit-row">
            <span class="unit-row-label">${GP.unitLabel(p.id, i)}</span>
            <input
              class="unit-name-input"
              type="text"
              data-product="${p.id}"
              data-unit="${i}"
              value="${name}"
              placeholder="Attendant name (optional)"
            >
          </div>`;
      }
      return `
        <div class="settings-product">
          <div class="settings-product-header">
            <span>${p.icon} ${p.full}</span>
            <div class="unit-counter">
              <button class="counter-btn" data-action="remove" data-product="${p.id}">−</button>
              <span class="counter-val" id="count_${p.id}">${count}</span>
              <button class="counter-btn" data-action="add" data-product="${p.id}">+</button>
            </div>
          </div>
          <div class="unit-list" id="units_${p.id}">${units}</div>
        </div>`;
    }).join('');
  }

  /* ── View chips ────────────────────────────────────────────────── */

  function renderViewChips(activeView) {
    document.querySelectorAll('#view-chips .chip-btn').forEach(btn => {
      const isActive = btn.dataset.view === activeView;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive);
    });
  }

  /* ── Toast ─────────────────────────────────────────────────────── */

  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  /* ── Loading ────────────────────────────────────────────────────── */

  function setLoading(show) {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  return {
    renderProductTabs,
    renderEntry,
    renderReports,
    renderSettings,
    renderViewChips,
    toast,
    setLoading,
  };

})();
