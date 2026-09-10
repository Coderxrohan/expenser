// ============================================================
// Ledger — expenses.js: table, filters, add/edit modal
// ============================================================
(function () {
  const L = window.Ledger;
  const hasTable = !!L.$("#expenses-tbody");
  const hasModal = !!L.$("#expense-form");
  if (!hasTable && !hasModal) return;

  let openExpenseModal = () => {};

  function getFilteredExpenses() {
    const search = L.$("#filter-search").value.trim().toLowerCase();
    const category = L.$("#filter-category").value;
    const from = L.$("#filter-from").value;
    const to = L.$("#filter-to").value;

    return L.state.expenses.filter((e) => {
      if (search && !`${e.name || ""} ${e.note || ""}`.toLowerCase().includes(search)) return false;
      if (category && e.category !== category) return false;
      if (from && e.expense_date < from) return false;
      if (to && e.expense_date > to) return false;
      return true;
    });
  }

  if (!hasTable) return initModal();

  L.renderExpensesTable = function () {
    const rows = getFilteredExpenses();
    const tbody = L.$("#expenses-tbody");
    L.$("#expenses-empty").classList.toggle("hidden", rows.length !== 0);

    tbody.innerHTML = rows.map((e) => `
      <tr data-id="${e.id}">
        <td>${L.formatDate(e.expense_date)}</td>
        <td><span class="category-tag">${L.escapeHtml(e.category)}</span></td>
        <td>${e.name ? L.escapeHtml(e.name) : L.escapeHtml(e.category)}</td>
        <td class="align-right amount-cell">${L.money(e.amount)}</td>
        <td class="align-right">
          <div class="row-actions">
            <button class="icon-btn" data-action="edit">Edit</button>
            <button class="icon-btn" data-action="delete">Delete</button>
          </div>
        </td>
      </tr>
    `).join("");
  };

  ["#filter-search", "#filter-category", "#filter-from", "#filter-to"].forEach((sel) => {
    L.$(sel).addEventListener("input", L.renderExpensesTable);
  });
  L.$("#filter-clear").addEventListener("click", () => {
    L.$("#filter-search").value = "";
    L.$("#filter-category").value = "";
    L.$("#filter-from").value = "";
    L.$("#filter-to").value = "";
    L.renderExpensesTable();
  });

  L.$("#expenses-tbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const row = btn.closest("tr");
    const id = row.dataset.id;
    const expense = L.state.expenses.find((x) => x.id === id);

    if (btn.dataset.action === "edit") {
      openExpenseModal(expense);
    } else if (btn.dataset.action === "delete") {
      const label = expense ? (expense.name || expense.note || expense.category) : "this entry";
      const ok = await L.askConfirm(`This removes "${label}" for good. It can't be undone.`, {
        title: "Delete expense?",
      });
      if (!ok) return;

      try {
        await L.api.deleteExpense(id);
        L.toast("Expense deleted.", "success");
        await L.refreshData();
        L.renderDashboard?.();
        L.renderExpensesTable();
      } catch (err) {
        L.toast(err.message, "error");
      }
    }
  });

  // ---------- exports (need the auth header, so fetch → blob) ----------
  L.$("#export-csv-btn").addEventListener("click", (e) => {
    e.preventDefault();
    L.api.downloadFile("/api/reports/expenses.csv", "ledger-expenses.csv").catch((err) => L.toast(err.message, "error"));
  });
  L.$("#export-pdf-btn").addEventListener("click", (e) => {
    e.preventDefault();
    L.api.downloadFile("/api/reports/expenses.pdf", "ledger-report.pdf").catch((err) => L.toast(err.message, "error"));
  });

  // ---------- modal (dashboard quick-add + expenses page) ----------
  function initModal() {
    openExpenseModal = function (expense = null) {
      L.$("#expense-error").textContent = "";
      L.$("#modal-title").textContent = expense ? "Edit expense" : "Add expense";
      L.$("#expense-id").value = expense ? expense.id : "";
      L.$("#expense-amount").value = expense ? expense.amount : "";
      L.$("#expense-name").value = expense ? (expense.name || "") : "";
      L.$("#expense-category").value = expense ? expense.category : L.CATEGORIES[0];
      L.$("#expense-method").value = expense?.payment_method || "cash";
      L.$("#expense-date").value = expense ? expense.expense_date : L.todayISO();
      L.$("#expense-note").value = expense ? (expense.note || "") : "";
      L.$("#expense-modal").classList.remove("hidden");
    }

    function closeExpenseModal() {
      L.$("#expense-modal").classList.add("hidden");
    }

    L.$("#quick-add-btn")?.addEventListener("click", () => openExpenseModal());
    L.$("#add-expense-btn")?.addEventListener("click", () => openExpenseModal());
    L.$("#modal-cancel").addEventListener("click", closeExpenseModal);
    L.$("#expense-modal").addEventListener("click", (e) => {
      if (e.target.id === "expense-modal") closeExpenseModal();
    });

    L.$("#expense-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      L.$("#expense-error").textContent = "";

      const id = L.$("#expense-id").value;
      const payload = {
        amount: parseFloat(L.$("#expense-amount").value),
        name: L.$("#expense-name").value.trim(),
        category: L.$("#expense-category").value,
        payment_method: L.$("#expense-method").value,
        expense_date: L.$("#expense-date").value,
        note: L.$("#expense-note").value.trim() || null,
      };

      const saveBtn = L.$("#modal-save");
      await L.withButtonLoading(saveBtn, "Saving…", async () => {
        try {
          if (id) {
            await L.api.updateExpense(id, payload);
          } else {
            await L.api.createExpense(payload);
          }
          closeExpenseModal();
          L.toast(id ? "Expense updated." : "Expense added.", "success");
          await L.refreshData();
          L.renderDashboard?.();
          L.renderExpensesTable?.();
        } catch (err) {
          L.$("#expense-error").textContent = err.message;
        }
      })();
    });
  }

  if (hasModal) initModal();
})();
