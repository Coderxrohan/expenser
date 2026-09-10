// ============================================================
// Ledger — analytics.js: trends, merchants, MoM comparison
// Data comes from GET /api/expenses/analytics; rendered lazily
// when the Analytics tab is opened.
// ============================================================
(function () {
  const L = window.Ledger;

  function renderTrendChart(series) {
    const svg = L.$("#trend-chart");
    if (!series.length) {
      svg.innerHTML = `<text x="250" y="80" text-anchor="middle" fill="#767c6c" font-size="12">No data this month yet.</text>`;
      return;
    }
    const max = Math.max(...series.map((d) => d.amount), 1);
    const w = 500, h = 160, pad = 6;
    const barW = Math.max(3, Math.floor((w - pad * 2) / series.length) - 2);

    svg.innerHTML = series.map((d, i) => {
      const barH = Math.max(2, (d.amount / max) * (h - 24));
      const x = pad + i * ((w - pad * 2) / series.length);
      const y = h - barH - 14;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#a9843a" rx="1">
        <title>${d.date}: ${L.money(d.amount)}</title>
      </rect>`;
    }).join("") +
    `<line x1="${pad}" y1="${h - 14}" x2="${w - pad}" y2="${h - 14}" stroke="#ddd8c8" stroke-width="1"/>`;
  }

  L.renderAnalytics = async function () {
    try {
      const a = await L.api.analytics();

      L.$("#ana-mom").textContent =
        a.monthOverMonth === null ? "—" : `${a.monthOverMonth > 0 ? "+" : ""}${a.monthOverMonth}%`;
      L.$("#ana-mom").className = `stat-figure stat-figure-sm ${a.monthOverMonth > 0 ? "delta-up" : "delta-down"}`;
      L.$("#ana-avg-txn").textContent = L.money(a.averagePerTransaction);

      renderTrendChart(a.dailySeries || []);

      L.$("#merchants-list").innerHTML = (a.topMerchants || []).length
        ? a.topMerchants.map((m) => `
            <div class="merchants-row">
              <span>${L.escapeHtml(m.merchant)}</span>
              <strong>${L.money(m.amount)}</strong>
            </div>`).join("")
        : `<p class="empty-state">No entries with names this month.</p>`;

      L.$("#compare-tbody").innerHTML = (a.categoryComparison || []).length
        ? a.categoryComparison
            .sort((x, y) => y.thisMonth - x.thisMonth)
            .map((c) => {
              const delta = c.thisMonth - c.lastMonth;
              const cls = delta > 0 ? "delta-up" : "delta-down";
              const sign = delta > 0 ? "+" : "";
              return `
                <tr>
                  <td>${L.escapeHtml(c.category)}</td>
                  <td>${L.money(c.thisMonth)}</td>
                  <td>${L.money(c.lastMonth)}</td>
                  <td class="${cls}">${sign}${L.money(delta)}</td>
                </tr>`;
            }).join("")
        : `<tr><td colspan="4" class="empty-state">No data yet.</td></tr>`;
    } catch (e) {
      L.toast(e.message, "error");
    }
  };
})();
