// ============================================================
// Ledger — categories.js: Settings panel on the Connectors page
// Add / rename / delete expense & income category names.
// Saves via /api/categories and refreshes the app's dropdowns.
// ============================================================
(function () {
  const L = window.Ledger;
  if (!L.$("#cat-list-expense")) return;

  const lists = {
    expense: { el: L.$("#cat-list-expense"), err: L.$("#cat-error-expense"), form: L.$("#cat-form-expense"), input: L.$("#cat-name-expense") },
    income: { el: L.$("#cat-list-income"), err: L.$("#cat-error-income"), form: L.$("#cat-form-income"), input: L.$("#cat-name-income") },
  };

  function showError(type, msg) {
    lists[type].err.textContent = msg || "";
    lists[type].err.classList.toggle("hidden", !msg);
  }

  // Keep the app's live category lists (modal dropdowns, filters) in sync.
  function syncAppLists() {
    L.CATEGORIES = L.state.categories.filter((c) => c.type === "expense").map((c) => c.name);
    L.INCOME_CATEGORIES = L.state.categories.filter((c) => c.type === "income").map((c) => c.name);
    L.persistCategories();
    L.populateCategorySelects();
  }

  function render() {
    for (const type of ["expense", "income"]) {
      const rows = L.state.categories.filter((c) => c.type === type);
      lists[type].el.innerHTML = rows.length ? rows.map((c, i) => `
        <div class="cat-row" data-id="${c.id}">
          <span class="cat-order-btns">
            <button class="icon-btn cat-move" data-action="up" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-btn cat-move" data-action="down" title="Move down" ${i === rows.length - 1 ? "disabled" : ""}>↓</button>
          </span>
          <span class="cat-name">${L.escapeHtml(c.name)}</span>
          <span class="row-actions">
            <button class="icon-btn" data-action="rename">Rename</button>
            <button class="icon-btn" data-action="delete">Delete</button>
          </span>
        </div>
      `).join("") : `<p class="empty-state">No categories — add one above.</p>`;
    }
  }

  async function load() {
    try {
      const { categories } = await L.api.categories.list();
      L.state.categories = categories || [];
      render();
      syncAppLists();
    } catch (e) {
      for (const type of ["expense", "income"]) {
        lists[type].el.innerHTML = `<p class="empty-state">Couldn't load categories: ${L.escapeHtml(e.message)}</p>`;
      }
    }
  }

  for (const type of ["expense", "income"]) {
    lists[type].form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      showError(type, "");
      const name = lists[type].input.value.trim();
      if (!name) return showError(type, "Enter a category name.");
      try {
        await L.api.categories.create({ type, name });
        lists[type].input.value = "";
        await load();
      } catch (e) {
        showError(type, e.message);
      }
    });
  }

  document.querySelector(".settings-grid").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const row = btn.closest(".cat-row");
    const id = row.dataset.id;
    const cat = L.state.categories.find((c) => c.id === id);
    if (!cat) return;

    if (btn.dataset.action === "up" || btn.dataset.action === "down") {
      const type = cat.type;
      const rows = L.state.categories.filter((c) => c.type === type);
      const idx = rows.findIndex((c) => c.id === id);
      const swapWith = btn.dataset.action === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= rows.length) return;
      const next = [...rows];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      try {
        const { categories } = await L.api.categories.reorder(type, next.map((c) => c.id));
        L.state.categories = [
          ...L.state.categories.filter((c) => c.type !== type),
          ...(categories || []),
        ];
        render();
        syncAppLists();
      } catch (e) {
        L.toast(e.message, "error");
      }
    } else if (btn.dataset.action === "rename") {
      const name = prompt("New name:", cat.name);
      if (name === null || !name.trim()) return;
      try {
        await L.api.categories.update(id, { name: name.trim() });
        await load();
      } catch (e) {
        L.toast(e.message, "error");
      }
    } else {
      const ok = await L.askConfirm(
        `New entries can't use "${cat.name}" anymore. Existing ${cat.type}s keep it.`,
        { title: "Delete category?" }
      );
      if (!ok) return;
      try {
        await L.api.categories.remove(id);
        await load();
      } catch (e) {
        L.toast(e.message, "error");
      }
    }
  });

  document.querySelectorAll(".cat-reset").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const type = btn.dataset.type;
      const ok = await L.askConfirm(
        "This removes all your custom categories of this type and restores the built-in defaults.",
        { title: "Reset to defaults?", confirmLabel: "Reset" }
      );
      if (!ok) return;
      try {
        const { categories } = await L.api.categories.reset(type);
        L.state.categories = [
          ...L.state.categories.filter((c) => c.type !== type),
          ...(categories || []),
        ];
        render();
        syncAppLists();
        L.toast("Categories restored to defaults.", "success");
      } catch (e) {
        L.toast(e.message, "error");
      }
    });
  });

  load();
})();
