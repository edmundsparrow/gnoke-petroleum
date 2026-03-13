/**
 * summary.js — Refined Plugin
 * Specifically engineered to sync with Daily/Weekly/Monthly chips.
 */

const SummaryPlugin = (() => {

  // Logic to calculate totals based on the current active view
  async function calculateTotals() {
    const dateInput = document.getElementById('reports-date');
    if (!dateInput) return null;

    const date = dateInput.value;
    // Identify which chip is active: 'day', 'week', 'month', or 'summary'
    const activeChip = document.querySelector('#view-chips .chip-btn.active');
    const view = activeChip ? activeChip.dataset.view : 'summary';

    let grandTotal = 0;
    const breakdown = [];

    for (const product of GP.PRODUCTS) {
      let records = [];

      if (view === 'day') {
        records = DB.getDay(date, product.id);
      } else if (view === 'summary') {
        records = DB.getAllTime(product.id).map(r => ({ amount: r.total }));
      } else if (view === 'week') {
        const d = new Date(date);
        const day = d.getDay();
        const start = new Date(d); start.setDate(d.getDate() - day);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        records = DB.getRange(start.toISOString().split('T')[0], end.toISOString().split('T')[0], product.id);
      } else if (view === 'month') {
        const [y, m] = date.split('-');
        const last = new Date(y, m, 0).getDate();
        records = DB.getRange(`${y}-${m}-01`, `${y}-${m}-${String(last).padStart(2,'0')}`, product.id);
      }

      const productTotal = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      grandTotal += productTotal;
      if (productTotal > 0) {
        breakdown.push({ label: product.label, total: productTotal });
      }
    }

    return { grandTotal, breakdown, view };
  }

  async function updateUI() {
    const reportsPage = document.getElementById('reports-page');
    if (!reportsPage || !reportsPage.classList.contains('active')) return;

    const data = await calculateTotals();
    if (!data) return;

    let box = document.getElementById('global-summary-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'global-summary-box';
      box.className = 'form-card';
      box.style.borderLeft = '4px solid var(--accent)';
      box.style.marginBottom = '20px';
      reportsPage.querySelector('.page-header').after(box);
    }

    const viewLabels = { day: 'Daily', week: 'Weekly', month: 'Monthly', summary: 'All-Time' };
    
    box.innerHTML = `
      <h3 style="font-size:0.7rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.05rem">
        Global ${viewLabels[data.view]} Revenue
      </h3>
      <div style="font-size:1.6rem; font-weight:600; font-family:var(--f-mono); color:var(--text); margin: 4px 0;">
        ${GP.CURRENCY}${data.grandTotal.toLocaleString('en-NG')}
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
        ${data.breakdown.map(b => `
          <span style="font-size:0.65rem; background:var(--surface3); padding:3px 10px; border-radius:12px; border:1px solid var(--border); color:var(--text2)">
            ${b.label}: ${b.total.toLocaleString()}
          </span>
        `).join('')}
      </div>
    `;
  }

  return { update: updateUI };
})();

// ── EVENT WIRING ──
// Catch chip changes and reports tab navigation
document.addEventListener('click', (e) => {
  if (e.target.closest('.chip-btn') || e.target.closest('[data-page="reports-page"]')) {
    setTimeout(SummaryPlugin.update, 150);
  }
});

// If the date changes
document.addEventListener('change', (e) => {
  if (e.target.id === 'reports-date') SummaryPlugin.update();
});
