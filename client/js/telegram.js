// ============================================================
// Ledger — telegram.js: chat link management panel (dashboard)
// Full CRUD against /api/telegram/links. A linked chat id makes
// the shared Telegram bot act as the signed-in account.
// ============================================================
(function () {
  const L = window.Ledger;
  if (!L.$("#tg-links")) return;

  const linksEl = L.$("#tg-links");
  const form = L.$("#tg-form");
  const chatInput = L.$("#tg-chat-id");
  const labelInput = L.$("#tg-label");
  const errorEl = L.$("#tg-error");

  // Privacy: never show the full chat id once linked.
  function maskChatId(id) {
    const s = String(id);
    return s.length > 4 ? s.slice(0, 2) + "•••••" + s.slice(-2) : "•••••";
  }

  // One chat per account: the add form locks while a link exists.
  function setFormLocked(locked) {
    [chatInput, labelInput].forEach((el) => (el.disabled = locked));
    form.querySelector("button[type=submit]").disabled = locked;
    form.classList.toggle("tg-form-locked", locked);
    L.$("#tg-locked-note")?.classList.toggle("hidden", !locked);
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }
  function clearError() {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }

  L.renderTelegramLinks = function (links) {
    setFormLocked(links.length >= 1);
    if (!links.length) {
      linksEl.innerHTML = `<p class="empty-state">No chats linked yet. Add your chat id above and the bot will respond as you.</p>`;
      return;
    }
    linksEl.innerHTML = links.map((l) => `
      <div class="tg-link-row" data-id="${l.id}">
        <div class="tg-link-main">
          <span class="tg-chat-id">${L.escapeHtml(maskChatId(l.chat_id))}</span>
          <span class="tg-label">${l.label ? L.escapeHtml(l.label) : "<em>no label</em>"}</span>
        </div>
        <div class="row-actions">
          <button class="icon-btn" data-action="rename">Rename</button>
          <button class="icon-btn" data-action="unlink">Unlink</button>
        </div>
      </div>
    `).join("");
  };

  async function load() {
    try {
      const { links } = await L.api.telegramLinks.list();
      L.renderTelegramLinks(links);
    } catch (e) {
      linksEl.innerHTML = `<p class="empty-state">Couldn't load linked chats: ${L.escapeHtml(e.message)}</p>`;
    }
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clearError();
    const chat_id = chatInput.value.replace(/\D/g, "");
    if (!chat_id) return showError("Enter the numeric chat id from Telegram.");
    try {
      await L.api.telegramLinks.create({ chat_id, label: labelInput.value.trim() });
      L.toast("Chat linked — the bot now responds as you.", "success");
      chatInput.value = "";
      labelInput.value = "";
      load();
    } catch (e) {
      showError(e.message);
    }
  });

  linksEl.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest(".tg-link-row").dataset.id;
    if (btn.dataset.action === "unlink") {
      if (!(await L.askConfirm("The bot will stop responding for this chat.", { title: "Unlink chat?" }))) return;
      try {
        await L.api.telegramLinks.remove(id);
        L.toast("Chat unlinked.", "success");
        load();
      } catch (e) {
        L.toast(e.message, "error");
      }
    } else if (btn.dataset.action === "rename") {
      const label = prompt("New label for this chat:");
      if (label === null) return;
      try {
        await L.api.telegramLinks.update(id, { label: label.trim() });
        load();
      } catch (e) {
        L.toast(e.message, "error");
      }
    }
  });

  load();
})();
