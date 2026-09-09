// ============================================================
// Ledger — dashboard.js: this month's stats, donut, recent list
// ============================================================
(function () {
  const L = window.Ledger;

  const DONUT_COLORS = ["#a9843a", "#5f8267", "#9c4a3d", "#2c4c44", "#c9b37a", "#7a9e83", "#b97363", "#767c6c"];

  function renderDonut(rows, total) {
    const svg = L.$("#donut-chart");
    L.$("#donut-center-figure").textContent = L.money(total);

    if (!rows.length || total === 0) {
      svg.innerHTML = `<circle cx="60" cy="60" r="48" fill="none" stroke="#ddd8c8" stroke-width="16" />`;
      return;
    }

    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    svg.innerHTML = rows.map(([, amt], i) => {
      const fraction = amt / total;
      const length = fraction * circumference;
      const dasharray = `${length} ${circumference - length}`;
      const circle = `<circle cx="60" cy="60" r="${radius}" fill="none"
          stroke="${DONUT_COLORS[i % DONUT_COLORS.length]}" stroke-width="16"
          stroke-dasharray="${dasharray}" stroke-dashoffset="${-offset}" />`;
      offset += length;
      return circle;
    }).join("");
  }

  L.renderDashboard = function () {
    const now = new Date();
    L.$("#month-label").textContent = now.toLocaleString(undefined, { month: "long", year: "numeric" });

    const { start, end } = L.monthBounds(now);
    const all = L.state.expenses;
    const thisMonth = all.filter((e) => e.expense_date >= start && e.expense_date <= end);

    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const { start: pStart, end: pEnd } = L.monthBounds(prevDate);
    const lastMonth = all.filter((e) => e.expense_date >= pStart && e.expense_date <= pEnd);

    const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
    const lastTotal = lastMonth.reduce((s, e) => s + Number(e.amount), 0);

    L.$("#stat-month-total").textContent = L.money(monthTotal);

    // left balance = everything earned minus everything spent
    const totalIn = L.state.incomes.reduce((s2, e) => s2 + Number(e.amount), 0);
    const totalOut = all.reduce((s2, e) => s2 + Number(e.amount), 0);
    const balance = totalIn - totalOut;
    const balanceEl = L.$("#stat-balance");
    if (balanceEl) {
      balanceEl.textContent = L.money(balance);
      balanceEl.style.color = balance < 0 ? "var(--rust)" : "";
    }

    const dayOfMonth = now.getDate();
    L.$("#stat-daily-avg").textContent = L.money(dayOfMonth ? monthTotal / dayOfMonth : 0);

    const { start: iStart, end: iEnd } = { start, end };
    const thisMonthIncome = L.state.incomes.filter((e) => e.income_date >= iStart && e.income_date <= iEnd);
    L.$("#stat-income").textContent = L.money(
      thisMonthIncome.reduce((s, e) => s + Number(e.amount), 0)
    );

    const diffEl = L.$("#stat-month-diff");
    if (lastTotal === 0) {
      diffEl.textContent = "No data for last month";
    } else {
      const pct = ((monthTotal - lastTotal) / lastTotal) * 100;
      const dir = pct >= 0 ? "more" : "less";
      diffEl.textContent = `${Math.abs(pct).toFixed(0)}% ${dir} than last month`;
    }

    // category breakdown
    const byCategory = {};
    thisMonth.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
    const maxCat = Math.max(1, ...Object.values(byCategory));
    const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

    const breakdownEl = L.$("#category-breakdown");
    breakdownEl.innerHTML = rows.length ? rows.map(([cat, amt]) => `
      <div class="category-row">
        <div class="category-row-top">
          <span class="category-name">${L.escapeHtml(cat)}</span>
          <span class="category-amount">${L.money(amt)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${(amt / maxCat) * 100}%"></div></div>
      </div>
    `).join("") : `<p class="empty-state">Nothing logged this month yet.</p>`;

    renderDonut(rows, monthTotal);

    // recent entries
    const recentEl = L.$("#recent-list");
    const recent = all.slice(0, 6);
    recentEl.innerHTML = recent.length ? recent.map((e) => `
      <div class="recent-row">
        <div>
          <div>${e.note ? L.escapeHtml(e.note) : L.escapeHtml(e.category)}</div>
          <div class="recent-meta">${L.escapeHtml(e.category)} · ${L.formatDate(e.expense_date)}</div>
        </div>
        <div class="recent-amount">${L.money(e.amount)}</div>
      </div>
    `).join("") : `<p class="empty-state">No entries yet.</p>`;
  };
})();
