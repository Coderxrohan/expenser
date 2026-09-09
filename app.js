// ============================================================
// Ledger — app logic
// ============================================================

const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills",
  "Entertainment", "Health", "Education", "Other"
];

const CURRENCY = "₹"; // change to your currency symbol

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allExpenses = [];   // cache of the signed-in user's expenses
let allBudgets = [];    // cache of the signed-in user's budgets

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function money(n) {
  return CURRENCY + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function populateCategorySelects() {
  const selects = [$("#expense-category"), $("#budget-category")];
  const filterSelect = $("#filter-category");
  selects.forEach((sel) => {
    sel.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  });
  filterSelect.innerHTML = `<option value="">All categories</option>` +
    CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

// ------------------------------------------------------------
// Loading overlay
// ------------------------------------------------------------
function setLoading(isLoading) {
  $("#loading-overlay").classList.toggle("hidden", !isLoading);
}

// ------------------------------------------------------------
// Toasts
// ------------------------------------------------------------
function toast(message, type = "default") {
  const stack = $("#toast-stack");
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ------------------------------------------------------------
// Custom confirm dialog (replaces window.confirm)
// ------------------------------------------------------------
function askConfirm(message, { title = "Are you sure?", confirmLabel = "Delete" } = {}) {
  return new Promise((resolve) => {
    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-ok").textContent = confirmLabel;
    $("#confirm-modal").classList.remove("hidden");

    const cleanup = (result) => {
      $("#confirm-modal").classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);

    const okBtn = $("#confirm-ok");
    const cancelBtn = $("#confirm-cancel");
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

// ------------------------------------------------------------
// Button loading state
// ------------------------------------------------------------
function withButtonLoading(button, busyLabel, fn) {
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
}

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------
$$(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".auth-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    $("#login-form").classList.toggle("hidden", !isLogin);
    $("#signup-form").classList.toggle("hidden", isLogin);
  });
});

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-error").textContent = "";
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  const btn = e.target.querySelector("button[type=submit]");
  const run = withButtonLoading(btn, "Logging in…", async () => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) $("#login-error").textContent = error.message;
  });
  await run();
});

$("#signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#signup-error").textContent = "";
  $("#signup-note").textContent = "";
  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;
  const btn = e.target.querySelector("button[type=submit]");
  const run = withButtonLoading(btn, "Creating…", async () => {
    const { error } = await sb.auth.signUp({ email, password });
    if (error) {
      $("#signup-error").textContent = error.message;
    } else {
      $("#signup-note").textContent = "Account created. Check your inbox to confirm, then log in.";
    }
  });
  await run();
});

$("#logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
});

sb.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    showApp();
  } else {
    showAuth();
  }
});

function showAuth() {
  $("#auth-screen").classList.remove("hidden");
  $("#app-shell").classList.add("hidden");
}

async function showApp() {
  $("#auth-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  $("#user-email").textContent = currentUser.email;
  setLoading(true);
  try {
    await refreshData();
    renderDashboard();
    renderExpensesTable();
    renderBudgets();
  } finally {
    setLoading(false);
  }
}

// ------------------------------------------------------------
// Navigation
// ------------------------------------------------------------
$$(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".nav-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".view").forEach((v) => v.classList.add("hidden"));
    $(`#view-${tab.dataset.view}`).classList.remove("hidden");
  });
});

// ------------------------------------------------------------
// Data loading
// ------------------------------------------------------------
async function refreshData() {
  const [{ data: expenses, error: expErr }, { data: budgets, error: budErr }] = await Promise.all([
    sb.from("expenses").select("*").order("expense_date", { ascending: false }),
    sb.from("budgets").select("*"),
  ]);
  if (expErr) console.error(expErr);
  if (budErr) console.error(budErr);
  allExpenses = expenses || [];
  allBudgets = budgets || [];
}

// ------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------
function renderDashboard() {
  const now = new Date();
  $("#month-label").textContent = now.toLocaleString(undefined, { month: "long", year: "numeric" });

  const { start, end } = monthBounds(now);
  const thisMonth = allExpenses.filter((e) => e.expense_date >= start && e.expense_date <= end);

  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { start: pStart, end: pEnd } = monthBounds(prevDate);
  const lastMonth = allExpenses.filter((e) => e.expense_date >= pStart && e.expense_date <= pEnd);

  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const lastTotal = lastMonth.reduce((s, e) => s + Number(e.amount), 0);

  $("#stat-month-total").textContent = money(monthTotal);
  $("#stat-count").textContent = thisMonth.length;

  const dayOfMonth = now.getDate();
  $("#stat-daily-avg").textContent = money(dayOfMonth ? monthTotal / dayOfMonth : 0);

  const diffEl = $("#stat-month-diff");
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

  const breakdownEl = $("#category-breakdown");
  breakdownEl.innerHTML = rows.length ? rows.map(([cat, amt]) => `
    <div class="category-row">
      <div class="category-row-top">
        <span class="category-name">${cat}</span>
        <span class="category-amount">${money(amt)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${(amt / maxCat) * 100}%"></div></div>
    </div>
  `).join("") : `<p class="empty-state">Nothing logged this month yet.</p>`;

  renderDonut(rows, monthTotal);

  // recent entries
  const recentEl = $("#recent-list");
  const recent = allExpenses.slice(0, 6);
  recentEl.innerHTML = recent.length ? recent.map((e) => `
    <div class="recent-row">
      <div>
        <div>${e.note || e.category}</div>
        <div class="recent-meta">${e.category} · ${formatDate(e.expense_date)}</div>
      </div>
      <div class="recent-amount">${money(e.amount)}</div>
    </div>
  `).join("") : `<p class="empty-state">No entries yet.</p>`;
}

const DONUT_COLORS = ["#a9843a", "#5f8267", "#9c4a3d", "#2c4c44", "#c9b37a", "#7a9e83", "#b97363", "#767c6c"];

function renderDonut(rows, total) {
  const svg = $("#donut-chart");
  $("#donut-center-figure").textContent = money(total);

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

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// ------------------------------------------------------------
// Expenses table + filters
// ------------------------------------------------------------
function getFilteredExpenses() {
  const search = $("#filter-search").value.trim().toLowerCase();
  const category = $("#filter-category").value;
  const from = $("#filter-from").value;
  const to = $("#filter-to").value;

  return allExpenses.filter((e) => {
    if (search && !(e.note || "").toLowerCase().includes(search)) return false;
    if (category && e.category !== category) return false;
    if (from && e.expense_date < from) return false;
    if (to && e.expense_date > to) return false;
    return true;
  });
}

function renderExpensesTable() {
  const rows = getFilteredExpenses();
  const tbody = $("#expenses-tbody");
  $("#expenses-empty").classList.toggle("hidden", rows.length !== 0);

  tbody.innerHTML = rows.map((e) => `
    <tr data-id="${e.id}">
      <td>${formatDate(e.expense_date)}</td>
      <td><span class="category-tag">${e.category}</span></td>
      <td>${e.note ? escapeHtml(e.note) : "—"}</td>
      <td class="align-right amount-cell">${money(e.amount)}</td>
      <td class="align-right">
        <div class="row-actions">
          <button class="icon-btn" data-action="edit">Edit</button>
          <button class="icon-btn" data-action="delete">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

["#filter-search", "#filter-category", "#filter-from", "#filter-to"].forEach((sel) => {
  $(sel).addEventListener("input", renderExpensesTable);
});
$("#filter-clear").addEventListener("click", () => {
  $("#filter-search").value = "";
  $("#filter-category").value = "";
  $("#filter-from").value = "";
  $("#filter-to").value = "";
  renderExpensesTable();
});

$("#expenses-tbody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const row = btn.closest("tr");
  const id = row.dataset.id;
  const expense = allExpenses.find((x) => x.id === id);

  if (btn.dataset.action === "edit") {
    openExpenseModal(expense);
  } else if (btn.dataset.action === "delete") {
    const label = expense ? (expense.note || expense.category) : "this entry";
    const ok = await askConfirm(`This removes "${label}" for good. It can't be undone.`, {
      title: "Delete expense?",
    });
    if (!ok) return;

    const { error } = await sb.from("expenses").delete().eq("id", id);
    if (error) {
      toast(error.message, "error");
      return;
    }
    toast("Expense deleted.", "success");
    await refreshData();
    renderDashboard();
    renderExpensesTable();
    renderBudgets();
  }
});

// ------------------------------------------------------------
// Expense modal (add / edit)
// ------------------------------------------------------------
function openExpenseModal(expense = null) {
  $("#expense-error").textContent = "";
  $("#modal-title").textContent = expense ? "Edit expense" : "Add expense";
  $("#expense-id").value = expense ? expense.id : "";
  $("#expense-amount").value = expense ? expense.amount : "";
  $("#expense-category").value = expense ? expense.category : CATEGORIES[0];
  $("#expense-date").value = expense ? expense.expense_date : todayISO();
  $("#expense-note").value = expense ? (expense.note || "") : "";
  $("#expense-modal").classList.remove("hidden");
}

function closeExpenseModal() {
  $("#expense-modal").classList.add("hidden");
}

$("#quick-add-btn").addEventListener("click", () => openExpenseModal());
$("#add-expense-btn").addEventListener("click", () => openExpenseModal());
$("#modal-cancel").addEventListener("click", closeExpenseModal);
$("#expense-modal").addEventListener("click", (e) => {
  if (e.target.id === "expense-modal") closeExpenseModal();
});

$("#expense-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#expense-error").textContent = "";

  const id = $("#expense-id").value;
  const payload = {
    amount: parseFloat($("#expense-amount").value),
    category: $("#expense-category").value,
    expense_date: $("#expense-date").value,
    note: $("#expense-note").value.trim() || null,
  };

  const saveBtn = $("#modal-save");
  const run = withButtonLoading(saveBtn, "Saving…", async () => {
    let error;
    if (id) {
      ({ error } = await sb.from("expenses").update(payload).eq("id", id));
    } else {
      ({ error } = await sb.from("expenses").insert({ ...payload, user_id: currentUser.id }));
    }

    if (error) {
      $("#expense-error").textContent = error.message;
      return;
    }

    closeExpenseModal();
    toast(id ? "Expense updated." : "Expense added.", "success");
    await refreshData();
    renderDashboard();
    renderExpensesTable();
    renderBudgets();
  });
  await run();
});

// ------------------------------------------------------------
// Budgets
// ------------------------------------------------------------
$("#budget-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const category = $("#budget-category").value;
  const monthly_limit = parseFloat($("#budget-amount").value);
  const btn = e.target.querySelector("button[type=submit]");

  const run = withButtonLoading(btn, "Saving…", async () => {
    const { error } = await sb.from("budgets")
      .upsert({ user_id: currentUser.id, category, monthly_limit }, { onConflict: "user_id,category" });

    if (error) {
      toast(error.message, "error");
      return;
    }
    toast(`Budget set for ${category}.`, "success");
    $("#budget-amount").value = "";
    await refreshData();
    renderBudgets();
  });
  await run();
});

function renderBudgets() {
  const { start, end } = monthBounds();
  const thisMonth = allExpenses.filter((e) => e.expense_date >= start && e.expense_date <= end);
  const spentByCategory = {};
  thisMonth.forEach((e) => { spentByCategory[e.category] = (spentByCategory[e.category] || 0) + Number(e.amount); });

  const listEl = $("#budgets-list");
  if (!allBudgets.length) {
    listEl.innerHTML = `<p class="empty-state">No budgets set. Pick a category above to start tracking a limit.</p>`;
    return;
  }

  listEl.innerHTML = allBudgets.map((b) => {
    const spent = spentByCategory[b.category] || 0;
    const pct = Math.min(100, (spent / b.monthly_limit) * 100);
    const over = spent > b.monthly_limit;
    return `
      <div class="budget-card">
        <div class="budget-card-top">
          <strong>${b.category}</strong>
          <span class="${over ? "budget-over" : ""}">${money(spent)} / ${money(b.monthly_limit)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%; background:${over ? "var(--rust)" : "var(--brass)"}"></div>
        </div>
      </div>
    `;
  }).join("");
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
populateCategorySelects();
