// ============================================================
// Ledger — budgets.js: monthly limits per category
// ============================================================
(function () {
  const L = window.Ledger;

  L.renderBudgets = function () {
    const { start, end } = L.monthBounds();
    const thisMonth = L.state.expenses.filter((e) => e.expense_date >= start && e.expense_date <= end);
    const spentByCategory = {};
    thisMonth.forEach((e) => { spentByCategory[e.category] = (spentByCategory[e.category] || 0) + Number(e.amount); });

    const listEl = L.$("#budgets-list");
    if (!L.state.budgets.length) {
      listEl.innerHTML = `<p class="empty-state">No budgets set. Pick a category above to start tracking a limit.</p>`;
      return;
    }

    listEl.innerHTML = L.state.budgets.map((b) => {
      const spent = spentByCategory[b.category] || 0;
      const pct = Math.min(100, (spent / b.monthly_limit) * 100);
      const over = spent > b.monthly_limit;
      return `
        <div class="budget-card">
          <div class="budget-card-top">
            <strong>${L.escapeHtml(b.category)}</strong>
            <span class="${over ? "budget-over" : ""}">${L.money(spent)} / ${L.money(b.monthly_limit)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${over ? "var(--rust)" : "var(--brass)"}"></div>
          </div>
        </div>
      `;
    }).join("");
  };

  L.$("#budget-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const category = L.$("#budget-category").value;
    const monthly_limit = parseFloat(L.$("#budget-amount").value);
    const btn = e.target.querySelector("button[type=submit]");

    await L.withButtonLoading(btn, "Saving…", async () => {
      try {
        await L.api.upsertBudget({ category, monthly_limit });
        L.toast(`Budget set for ${category}.`, "success");
        L.$("#budget-amount").value = "";
        await L.refreshData();
        L.renderBudgets();
      } catch (err) {
        L.toast(err.message, "error");
      }
    })();
  });
})();
