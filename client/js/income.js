// ============================================================
// Ledger — income.js: income table, filters, add/edit modal
// Mirrors expenses.js but for money coming in.
// ============================================================
(function () {
  const L = window.Ledger;
  const hasTable = !!L.$("#incomes-tbody");
  const hasModal = !!L.$("#income-form");
  if (!hasTable && !hasModal) return;

  let openIncomeModal = () => {};

  function getFilteredIncomes() {
    const search = L.$("#income-filter-search").value.trim().toLowerCase();
    const category = L.$("#income-filter-category").value;
    const from = L.$("#income-filter-from").value;
    const to = L.$("#income-filter-to").value;

    return L.state.incomes.filter((e) => {
      if (search && !(e.note || "").toLowerCase().includes(search)) return false;
      if (category && e.category !== category) return false;
      if (from && e.income_date < from) return false;
      if (to && e.income_date > to) return false;
      return true;
    });
  }

  if (!hasTable) {
    if (hasModal) initModal();
    return;
  }

  L.renderIncomesTable = function () {
    const rows = getFilteredIncomes();
    const tbody = L.$("#incomes-tbody");
    L.$("#incomes-empty").classList.toggle("hidden", rows.length !== 0);

    tbody.innerHTML = rows.map((e) => `
      <tr data-id="${e.id}">
        <td>${L.formatDate(e.income_date)}</td>
        <td><span class="category-tag">${L.escapeHtml(e.category)}</span></td>
        <td>${e.note ? L.escapeHtml(e.note) : "—"}</td>
        <td class="align-right amount-cell">+${L.money(e.amount)}</td>
        <td class="align-right">
          <div class="row-actions">
            <button class="icon-btn" data-action="edit">Edit</button>
            <button class="icon-btn" data-action="delete">Delete</button>
          </div>
        </td>
      </tr>
    `).join("");
  };

  ["#income-filter-search", "#income-filter-category", "#income-filter-from", "#income-filter-to"].forEach((sel) => {
    L.$(sel).addEventListener("input", L.renderIncomesTable);
  });
  L.$("#income-filter-clear").addEventListener("click", () => {
    L.$("#income-filter-search").value = "";
    L.$("#income-filter-category").value = "";
    L.$("#income-filter-from").value = "";
    L.$("#income-filter-to").value = "";
    L.renderIncomesTable();
  });

  L.$("#incomes-tbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const income = L.state.incomes.find((x) => x.id === id);

    if (btn.dataset.action === "edit") {
      openIncomeModal(income);
    } else if (btn.dataset.action === "delete") {
      const label = income ? (income.note || income.category) : "this entry";
      const ok = await L.askConfirm(`This removes "${label}" for good. It can't be undone.`, {
        title: "Delete income?",
      });
      if (!ok) return;

      try {
        await L.api.deleteIncome(id);
        L.toast("Income deleted.", "success");
        await L.refreshData();
        L.renderDashboard?.();
        L.renderIncomesTable();
      } catch (err) {
        L.toast(err.message, "error");
      }
    }
  });

  // ---------- exports (same as expenses tab) ----------
  L.$("#income-export-csv-btn").addEventListener("click", (e) => {
    e.preventDefault();
    L.api.downloadFile("/api/reports/incomes.csv", "ledger-income.csv").catch((err) => L.toast(err.message, "error"));
  });
  L.$("#income-export-pdf-btn").addEventListener("click", (e) => {
    e.preventDefault();
    L.api.downloadFile("/api/reports/incomes.pdf", "ledger-income-report.pdf").catch((err) => L.toast(err.message, "error"));
  });

  // ---------- modal (dashboard quick-add + income page) ----------
  function initModal() {
    openIncomeModal = function (income = null) {
      L.$("#income-error").textContent = "";
      L.$("#income-modal-title").textContent = income ? "Edit income" : "Add income";
      L.$("#income-id").value = income ? income.id : "";
      L.$("#income-amount").value = income ? income.amount : "";
      L.$("#income-category").value = income ? income.category : L.INCOME_CATEGORIES[0];
      L.$("#income-method").value = income?.payment_method || "cash";
      L.$("#income-date").value = income ? income.income_date : L.todayISO();
      L.$("#income-note").value = income ? (income.note || "") : "";
      L.$("#income-modal").classList.remove("hidden");
    };

    function closeIncomeModal() {
      L.$("#income-modal").classList.add("hidden");
    }

    L.$("#add-income-btn")?.addEventListener("click", () => openIncomeModal());
    L.$("#quick-add-income-btn")?.addEventListener("click", () => openIncomeModal());
    L.$("#income-modal-cancel").addEventListener("click", closeIncomeModal);
    L.$("#income-modal").addEventListener("click", (e) => {
      if (e.target.id === "income-modal") closeIncomeModal();
    });

    L.$("#income-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      L.$("#income-error").textContent = "";

      const id = L.$("#income-id").value;
      const payload = {
        amount: parseFloat(L.$("#income-amount").value),
        category: L.$("#income-category").value,
        payment_method: L.$("#income-method").value,
        income_date: L.$("#income-date").value,
        note: L.$("#income-note").value.trim() || null,
      };

      const saveBtn = L.$("#income-modal-save");
      await L.withButtonLoading(saveBtn, "Saving…", async () => {
        try {
          if (id) {
            await L.api.updateIncome(id, payload);
          } else {
            await L.api.createIncome(payload);
          }
          closeIncomeModal();
          L.toast(id ? "Income updated." : "Income added.", "success");
          await L.refreshData();
          L.renderDashboard?.();
          L.renderIncomesTable?.();
        } catch (err) {
          L.$("#income-error").textContent = err.message;
        }
      })();
    });
  }

  if (hasModal) initModal();
})();
