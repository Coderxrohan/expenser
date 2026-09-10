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
  state: { expenses: [], incomes: [], categories: [] }, // signed-in user's data
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

  // LOCAL date string — toISOString() is UTC and reports yesterday
  // between midnight and 5:30 AM in IST.
  L.localISO = (d = new Date()) =>
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");

  L.todayISO = () => L.localISO();

  L.monthBounds = (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: L.localISO(start), end: L.localISO(end) };
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

  // ---------- state cache ----------
  // Pages are separate HTML documents; sessionStorage lets each page
  // paint instantly from the previous page's data, then revalidate.
  const CACHE_KEY = "ledger_state_cache";

  L.persistStateCache = function () {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(L.state)); } catch {}
  };

  // Persist only the custom category lists (localStorage — used by every page).
  L.persistCategories = function () {
    try { localStorage.setItem("ledger_categories", JSON.stringify(L.state.categories)); } catch {}
  };

  L.loadStoredCategories = function () {
    try {
      const stored = JSON.parse(localStorage.getItem("ledger_categories") || "null");
      if (Array.isArray(stored) && stored.length) {
        L.state.categories = stored;
        L.CATEGORIES = stored.filter((c) => c.type === "expense").map((c) => c.name);
        L.INCOME_CATEGORIES = stored.filter((c) => c.type === "income").map((c) => c.name);
      }
    } catch {}
  };

  L.loadCachedState = function () {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (cached && Array.isArray(cached.expenses) && Array.isArray(cached.incomes)) {
        L.state.expenses = cached.expenses;
        L.state.incomes = cached.incomes;
        if (Array.isArray(cached.categories)) {
          L.state.categories = cached.categories;
          L.CATEGORIES = L.state.categories.filter((c) => c.type === "expense").map((c) => c.name);
          L.INCOME_CATEGORIES = L.state.categories.filter((c) => c.type === "income").map((c) => c.name);
        }
        return true;
      }
    } catch {}
    return false;
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

  L.loadStoredCategories();

  // ---------- mobile hamburger menu ----------
  const menuBtn = L.$("#menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
    });
    L.$("#nav-backdrop").addEventListener("click", () => {
      document.body.classList.remove("nav-open");
    });
    // close the drawer after navigating
    L.$$(".sidebar-nav .nav-tab").forEach((t) =>
      t.addEventListener("click", () => document.body.classList.remove("nav-open"))
    );
  }

  // ---------- auth ----------
  L.showAuth = () => {
    L.$("#auth-screen")?.classList.remove("hidden");
    L.$("#app-shell")?.classList.add("hidden");
  };

  L.showApp = () => {
    L.$("#auth-screen")?.classList.add("hidden");
    L.$("#app-shell")?.classList.remove("hidden");
  };

  // ---------- sidebar user (avatar + menu + edit profile) ----------
  // Profile lives in Supabase: public.profiles (display_name, avatar_url),
  // images in the public `avatars` storage bucket under <user_id>/.
  L.profile = null;
  const PROFILE_CACHE_KEY = "ledger_profile";

  const ICONS = {
    chevronUp: `<path d="m18 15-6-6-6 6"/>`,
    user: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
    logout: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>`,
    image: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`,
    trash: `<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  };
  const svg = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  function initialsFor() {
    const name = (L.profile?.display_name || L.user?.email || "?").trim();
    const parts = name.split(/[\s._@-]+/).filter(Boolean);
    const a = parts[0]?.[0] || "?";
    const b = parts[1]?.[0] || parts[0]?.[1] || "";
    return (a + b).toUpperCase();
  }

  // shadcn-style avatar: photo (when set & loaded) over initials fallback,
  // green status badge bottom-right.
  function avatarHtml(url, cls = "") {
    return `<span class="avatar ${cls}">` +
      (url ? `<img src="${L.escapeHtml(url)}" alt="" onerror="this.remove()" />` : "") +
      `<span class="avatar-fallback">${L.escapeHtml(initialsFor())}</span>` +
      `<span class="avatar-badge"></span></span>`;
  }

  function cacheProfile() {
    try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(L.profile)); } catch {}
  }

  async function loadProfile() {
    try {
      const { data, error } = await L.sb.from("profiles").select("*").eq("id", L.user.id).maybeSingle();
      if (error) throw error;
      if (data) { L.profile = data; cacheProfile(); }
    } catch {
      // profiles table likely missing (migration 012 not run) — fall back to email
    }
  }

  async function saveProfile({ display_name, avatar_url }) {
    const row = {
      id: L.user.id,
      display_name: display_name || null,
      avatar_url: avatar_url ?? L.profile?.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await L.sb.from("profiles").upsert(row).select().single();
    if (error) {
      if (/relation .*profiles.* does not exist/i.test(error.message)) {
        throw new Error("Run database/migrations/012_profiles.sql in Supabase first.");
      }
      throw new Error(error.message);
    }
    L.profile = data;
    cacheProfile();
    renderSidebarUser();
    return data;
  }

  function renderSidebarUser() {
    const el = L.$("#sidebar-user");
    if (!el || !L.user) return;
    const name = L.profile?.display_name || L.user.email;
    el.innerHTML = `
      <button type="button" class="user-trigger" id="user-trigger" aria-haspopup="menu" aria-expanded="false" title="${L.escapeHtml(name)}">
        ${avatarHtml(L.profile?.avatar_url)}
        <span class="user-meta">
          <span class="user-name">${L.escapeHtml(name)}</span>
          <span class="user-email">${L.escapeHtml(L.user.email)}</span>
        </span>
        <span class="user-chevron">${svg(ICONS.chevronUp)}</span>
      </button>
      <div class="user-menu hidden" id="user-menu" role="menu">
        <button type="button" class="user-menu-item" data-action="edit-profile">${svg(ICONS.user)} Edit profile</button>
        <button type="button" class="user-menu-item user-menu-danger" data-action="logout">${svg(ICONS.logout)} Log out</button>
      </div>`;

    const trigger = L.$("#user-trigger");
    const menu = L.$("#user-menu");
    trigger.addEventListener("click", () => {
      const open = menu.classList.toggle("hidden") === false;
      trigger.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => {
      if (!menu.classList.contains("hidden") && !e.target.closest("#user-trigger") && !e.target.closest("#user-menu")) {
        menu.classList.add("hidden");
      }
    });
    menu.addEventListener("click", async (e) => {
      const item = e.target.closest("[data-action]");
      if (!item) return;
      menu.classList.add("hidden");
      if (item.dataset.action === "logout") {
        await L.sb.auth.signOut();
        location.href = "login.html";
      } else if (item.dataset.action === "edit-profile") {
        openProfileModal();
      }
    });
  }

  // ---- edit profile modal (avatar upload/remove + display name) ----
  // undefined = unchanged, null = removed, string = new upload
  let pendingAvatarUrl;

  function ensureProfileModal() {
    if (L.$("#profile-modal")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div id="profile-modal" class="modal-overlay hidden">
        <div class="modal modal-sm">
          <h2>Edit profile</h2>
          <form id="profile-form">
            <div class="profile-avatar-row">
              <span id="profile-avatar-preview"></span>
              <div class="profile-avatar-actions">
                <input type="file" id="profile-avatar-input" accept="image/*" hidden />
                <button type="button" class="btn btn-ghost btn-sm" id="profile-avatar-btn">${svg(ICONS.image)} Upload photo</button>
                <button type="button" class="btn btn-ghost btn-sm" id="profile-avatar-remove">${svg(ICONS.trash)} Remove</button>
              </div>
            </div>
            <label>Display name
              <input type="text" id="profile-name" maxlength="60" placeholder="How should we call you?" />
            </label>
            <p class="auth-error" id="profile-error"></p>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" id="profile-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary" id="profile-save">Save</button>
            </div>
          </form>
        </div>
      </div>`);

    const renderPreview = () => {
      const url = pendingAvatarUrl === undefined ? (L.profile?.avatar_url || null) : pendingAvatarUrl;
      L.$("#profile-avatar-preview").innerHTML = avatarHtml(url, "avatar-lg");
    };

    L.$("#profile-avatar-btn").addEventListener("click", () => L.$("#profile-avatar-input").click());
    L.$("#profile-avatar-input").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      L.$("#profile-error").textContent = "";
      if (file.size > 2 * 1024 * 1024) {
        L.$("#profile-error").textContent = "Photo must be under 2 MB.";
        e.target.value = "";
        return;
      }
      const btn = L.$("#profile-avatar-btn");
      btn.disabled = true;
      try {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${L.user.id}/avatar.${ext}`;
        const { error } = await L.sb.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
        if (error) {
          if (/bucket not found/i.test(error.message)) throw new Error("Run database/migrations/012_profiles.sql in Supabase first (creates the avatars bucket).");
          throw new Error(error.message);
        }
        const { data } = L.sb.storage.from("avatars").getPublicUrl(path);
        pendingAvatarUrl = `${data.publicUrl}?v=${Date.now()}`; // bust the cached photo
        renderPreview();
      } catch (err) {
        L.$("#profile-error").textContent = err.message;
      } finally {
        btn.disabled = false;
        e.target.value = "";
      }
    });
    L.$("#profile-avatar-remove").addEventListener("click", () => {
      pendingAvatarUrl = null;
      renderPreview();
    });

    L.$("#profile-cancel").addEventListener("click", () => L.$("#profile-modal").classList.add("hidden"));
    L.$("#profile-modal").addEventListener("click", (e) => {
      if (e.target.id === "profile-modal") L.$("#profile-modal").classList.add("hidden");
    });

    L.$("#profile-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      L.$("#profile-error").textContent = "";
      const saveBtn = L.$("#profile-save");
      saveBtn.disabled = true;
      try {
        await saveProfile({
          display_name: L.$("#profile-name").value.trim(),
          avatar_url: pendingAvatarUrl,
        });
        L.toast("Profile updated.", "success");
        L.$("#profile-modal").classList.add("hidden");
      } catch (err) {
        L.$("#profile-error").textContent = err.message;
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  function openProfileModal() {
    ensureProfileModal();
    L.$("#profile-error").textContent = "";
    L.$("#profile-name").value = L.profile?.display_name || "";
    pendingAvatarUrl = undefined;
    L.$("#profile-avatar-preview").innerHTML = avatarHtml(L.profile?.avatar_url || null, "avatar-lg");
    L.$("#profile-modal").classList.remove("hidden");
  }

  // ---------- sidebar collapse (shadcn-style icon rail) ----------
  function initSidebarCollapse() {
    const btn = L.$("#sidebar-collapse-btn");
    if (!btn) return;
    try {
      if (localStorage.getItem("ledger_sidebar_collapsed") === "1") {
        document.body.classList.add("sidebar-collapsed");
        btn.title = "Expand sidebar";
      }
    } catch {}
    btn.addEventListener("click", () => {
      const on = document.body.classList.toggle("sidebar-collapsed");
      btn.title = on ? "Expand sidebar" : "Collapse sidebar";
      try { localStorage.setItem("ledger_sidebar_collapsed", on ? "1" : "0"); } catch {}
    });
  }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", async () => {
    L.populateCategorySelects();

    // login page: handled by auth.js
    const page = document.body.dataset.page;
    if (!page) return;

    if (!L.sb) {
      location.href = "login.html";
      return;
    }

    // logout now lives in the sidebar user menu (rendered below)
    const { data } = await L.sb.auth.getSession();
    const user = data?.session?.user;
    if (!user) {
      location.href = "login.html";
      return;
    }
    L.user = user;

    initSidebarCollapse();

    // paint the cached profile instantly, then revalidate
    try { L.profile = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null"); } catch {}
    renderSidebarUser();
    await loadProfile();
    renderSidebarUser();

    if (!L.CONFIG.supabaseUrl || !L.CONFIG.supabaseAnonKey) {
      L.toast('Setup incomplete — check config / .env.', "error");
      return;
    }

    // paint cached data immediately (if any), then revalidate quietly
    const hadCache = L.loadCachedState();
    if (page === "dashboard") L.renderDashboard();
    if (page === "expenses") L.renderExpensesTable();
    if (page === "income") L.renderIncomesTable();

    L.setLoading(!hadCache);
    try {
      if (page !== "analytics") await L.refreshData();
      if (page === "dashboard") L.renderDashboard();
      if (page === "expenses") L.renderExpensesTable();
      if (page === "income") L.renderIncomesTable();
      if (page === "analytics") await L.renderAnalytics();
    } catch (e) {
      L.toast(e.message, "error");
    } finally {
      L.setLoading(false);
    }
  });
})();
