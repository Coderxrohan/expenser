// ============================================================
// Ledger — dashboard.js: this month's stats, donut, recent list
// ============================================================
(function () {
  const L = window.Ledger;

  const DONUT_COLORS = ["#a9843a", "#5f8267", "#9c4a3d", "#2c4c44", "#c9b37a", "#7a9e83", "#b97363", "#767c6c"];

  // Radar chart: one spoke per category, dot at each category's spend.
  function renderDonut(rowsArg, total) {
    let rows = rowsArg;
    const svg = L.$("#donut-chart");
    L.$("#donut-center-figure").textContent = L.money(total);

    // show only the top 6 categories by spend
    rows = [...rows].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const C = 60, R = 40; // center and max radius
    const max = Math.max(...rows.map(([, amt]) => amt), 1);

    if (!rows.length || total === 0) {
      svg.innerHTML = `<circle cx="60" cy="60" r="44" fill="none" stroke="#ddd8c8" stroke-width="1.5"/>` +
        `<circle cx="60" cy="60" r="3" fill="#ddd8c8"/>`;
      return;
    }

    const n = rows.length;
    const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2; // first spoke points up

    // web: concentric rings + spokes
    let web = "";
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      const ring = rows.map((_, i) => {
        const a = angle(i);
        return `${(C + Math.cos(a) * R * f).toFixed(2)},${(C + Math.sin(a) * R * f).toFixed(2)}`;
      }).join(" ");
      web += `<polygon points="${ring}" fill="none" stroke="#d9d3c2" stroke-width="0.7"/>`;
    });
    rows.forEach((_, i) => {
      const a = angle(i);
      web += `<line x1="${C}" y1="${C}" x2="${(C + Math.cos(a) * R).toFixed(2)}" y2="${(C + Math.sin(a) * R).toFixed(2)}" stroke="#d9d3c2" stroke-width="0.7"/>`;
    });

    // data polygon + dots
    const dataPts = rows.map(([, amt], i) => {
      const a = angle(i);
      const r = R * (amt / max);
      return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, ax: C + Math.cos(a) * R, ay: C + Math.sin(a) * R, a };
    });
    const poly = dataPts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const dots = dataPts.map((p) =>
      `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.6" fill="var(--rust)" stroke="var(--paper)" stroke-width="1"/>`
    ).join("");

    // labels outside the web
    const labels = rows.map(([cat], i) => {
      const a = angle(i);
      const lx = C + Math.cos(a) * (R + 9);
      const ly = C + Math.sin(a) * (R + 9);
      const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
      const short = cat.length > 9 ? cat.slice(0, 8) + "…" : cat;
      return `<text x="${lx.toFixed(2)}" y="${(ly + 2).toFixed(2)}" text-anchor="${anchor}" font-size="5.5"
        font-family="Inter, sans-serif" fill="var(--muted)">${L.escapeHtml(short)}</text>`;
    }).join("");

    svg.innerHTML = web +
      `<polygon points="${poly}" fill="rgba(169, 132, 58, 0.28)" stroke="var(--brass)" stroke-width="1.4" stroke-linejoin="round"/>` +
      dots + labels;
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

    const todayIso = localISO(now);
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
  // LOCAL date string — toISOString() is UTC and shifts the day in IST.
  function localISO(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function renderWave(now) {
    const host = L.$("#wave-chart");
    if (!host) return;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        iso: localISO(d),
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
