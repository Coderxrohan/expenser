// ============================================================
// Ledger — app.js: shared namespace, helpers, boot
// Loaded on every page before the page-specific modules.
// ============================================================
window.Ledger = {
  CATEGORIES: [
    "Food", "Transport", "Shopping", "Bills",
    "Entertainment", "Health", "Education", "Other",
  ],
  INCOME_CATEGORIES: ["Salary", "Freelance", "Business", "Investment", "Gift", "Other"],
  PAYMENT_METHODS: {
    cash: "Cash", upi: "UPI", credit_card: "Credit card",
    debit_card: "Debit card", bank_transfer: "Bank transfer", wallet: "Wallet",
  },
  CURRENCY: "₹",
  state: { expenses: [], incomes: [] }, // cache of the signed-in user's data
};

(function () {
  const L = window.Ledger;

  // Config comes from .env (served at /config.js) or the client/config.js
  // fallback for static hosting.
  L.CONFIG = window.LEDGER_CONFIG || {};

  if (window.supabase && L.CONFIG.supabaseUrl && L.CONFIG.supabaseAnonKey) {
    L.sb = window.supabase.createClient(L.CONFIG.supabaseUrl, L.CONFIG.supabaseAnonKey);
  }

  // ---------- DOM helpers ----------
  L.$ = (sel) => document.querySelector(sel);
  L.$$ = (sel) => Array.from(document.querySelectorAll(sel));

  L.money = (n) =>
    L.CURRENCY + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  L.todayISO = () => new Date().toISOString().slice(0, 10);

  L.monthBounds = (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  };

  L.formatDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };

  L.escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };

  // ---------- UI primitives ----------
  L.setLoading = (isLoading) => {
    const el = L.$("#loading-overlay");
    if (el) el.classList.toggle("hidden", !isLoading);
  };

  L.toast = (message, type = "default") => {
    const stack = L.$("#toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  };

  L.askConfirm = (message, { title = "Are you sure?", confirmLabel = "Delete" } = {}) =>
    new Promise((resolve) => {
      const modal = L.$("#confirm-modal");
      if (!modal) return resolve(window.confirm(message));
      L.$("#confirm-title").textContent = title;
      L.$("#confirm-message").textContent = message;
      L.$("#confirm-ok").textContent = confirmLabel;
      modal.classList.remove("hidden");

      const cleanup = (result) => {
        modal.classList.add("hidden");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);

      const okBtn = L.$("#confirm-ok");
      const cancelBtn = L.$("#confirm-cancel");
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
    });

  L.withButtonLoading = (button, busyLabel, fn) => {
    const original = button.textContent;
    return async (...args) => {
      button.disabled = true;
      button.textContent = busyLabel;
      try {
        return await fn(...args);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };
  };

  L.populateCategorySelects = () => {
    const expenseSelect = L.$("#expense-category");
    if (expenseSelect) {
      expenseSelect.innerHTML = L.CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
    }
    const incomeSelect = L.$("#income-category");
    if (incomeSelect) {
      incomeSelect.innerHTML = L.INCOME_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
    }
    const filterSelect = L.$("#filter-category");
    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">All categories</option>` +
        L.CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
    }
    const incomeFilterSelect = L.$("#income-filter-category");
    if (incomeFilterSelect) {
      incomeFilterSelect.innerHTML = `<option value="">All sources</option>` +
        L.INCOME_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
    }
  };

  // ---------- auth ----------
  L.showAuth = () => {
    L.$("#auth-screen")?.classList.remove("hidden");
    L.$("#app-shell")?.classList.add("hidden");
  };

  L.showApp = () => {
    L.$("#auth-screen")?.classList.add("hidden");
    L.$("#app-shell")?.classList.remove("hidden");
  };

  // ---------- navigation (dashboard page) ----------
  L.initNavTabs = () => {
    L.$$(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        L.$$(".nav-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        L.$$(".view").forEach((v) => v.classList.add("hidden"));
        L.$(`#view-${tab.dataset.view}`)?.classList.remove("hidden");
        // analytics renders lazily — it needs a fresh API call
        if (tab.dataset.view === "analytics" && L.renderAnalytics) L.renderAnalytics();
      });
    });
  };

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", async () => {
    L.populateCategorySelects();

    // login page: handled by auth.js
    if (!L.$("#app-shell")) return;

    if (!L.sb) {
      location.href = "login.html";
      return;
    }

    L.initNavTabs();
    const logoutBtn = L.$("#logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await L.sb.auth.signOut();
        location.href = "login.html";
      });
    }

    const { data } = await L.sb.auth.getSession();
    const user = data?.session?.user;
    if (!user) {
      location.href = "login.html";
      return;
    }
    L.user = user;
    L.$("#user-email").textContent = user.email;

    if (!L.CONFIG.supabaseUrl || !L.CONFIG.supabaseAnonKey) {
      L.toast('Setup incomplete — check config / .env.', "error");
      return;
    }

    L.setLoading(true);
    try {
      await L.refreshData();
      L.renderDashboard();
      L.renderExpensesTable();
      L.renderIncomesTable();
    } catch (e) {
      L.toast(e.message, "error");
    } finally {
      L.setLoading(false);
    }
  });
})();
