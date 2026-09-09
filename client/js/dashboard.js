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

    const todayIso = now.toISOString().slice(0, 10);
    const todayTotal = all
      .filter((e) => e.expense_date === todayIso)
      .reduce((s2, e) => s2 + Number(e.amount), 0);
    L.$("#stat-today").textContent = L.money(todayTotal);

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

    renderWave(now);

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

  // ---- last-7-days wave chart -----------------------------------
  function renderWave(now) {
    const host = L.$("#wave-chart");
    if (!host) return;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        iso: d.toISOString().slice(0, 10),
        label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
        amount: 0,
      });
    }
    const byDate = {};
    for (const e of L.state.expenses) {
      byDate[e.expense_date] = (byDate[e.expense_date] || 0) + Number(e.amount);
    }
    days.forEach((d) => { d.amount = byDate[d.iso] || 0; });

    const W = Math.max(host.clientWidth, 320), H = 150;
    const padX = 28, padTop = 24, padBottom = 30;
    const max = Math.max(...days.map((d) => d.amount), 1);
    const px = (i) => padX + (i * (W - padX * 2)) / (days.length - 1);
    const py = (a) => padTop + (1 - a / max) * (H - padTop - padBottom);
    const pts = days.map((d, i) => ({ x: px(i), y: py(d.amount), ...d }));

    // smooth "wave" through the points (Catmull-Rom → cubic bezier)
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    const area = path + ` L ${pts[pts.length - 1].x} ${H - padBottom} L ${pts[0].x} ${H - padBottom} Z`;

    host.innerHTML = `
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs>
          <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#a9843a" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#a9843a" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#waveFill)"/>
        <path d="${path}" fill="none" stroke="var(--brass)" stroke-width="2.5" stroke-linecap="round"/>
        ${pts.map((p, i) => `
          <circle cx="${p.x}" cy="${p.y}" r="${i === pts.length - 1 ? 5.5 : 4}"
            fill="${i === pts.length - 1 ? "var(--rust)" : "var(--paper)"}"
            stroke="${i === pts.length - 1 ? "var(--rust)" : "var(--brass)"}" stroke-width="2"/>
          <text x="${p.x}" y="${H - 10}" text-anchor="middle" font-size="11"
            fill="${i === pts.length - 1 ? "var(--rust)" : "var(--muted)"}"
            font-family="Inter, sans-serif">${p.label}</text>
          ${p.amount ? `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="10.5"
            fill="var(--ink)" font-family="Inter, sans-serif">₹${Math.round(p.amount)}</text>` : ""}
        `).join("")}
      </svg>`;
  }
})();
