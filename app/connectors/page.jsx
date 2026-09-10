"use client";

// Connectors: Telegram chat linking + the inactive Email connector.
// Port of connectors.html + client/js/telegram.js.

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

function TelegramConnector() {
  const { askConfirm, toast } = useApp();
  const [links, setLinks] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [chatId, setChatId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const { links } = await api.telegramLinks.list();
      setLinks(links || []);
    } catch (e) {
      setLoadError(`Couldn't load linked chats: ${e.message}`);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = links.length >= 1;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const id = chatId.replace(/\D/g, "");
    if (!id) return setError("Enter the numeric chat id from Telegram.");
    try {
      await api.telegramLinks.create({ chat_id: id, label: label.trim() });
      toast("Chat linked — the bot now responds as you.", "success");
      setChatId("");
      setLabel("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const unlink = async (link) => {
    if (!(await askConfirm("The bot will stop responding for this chat.", { title: "Unlink chat?" }))) return;
    try {
      await api.telegramLinks.remove(link.id);
      toast("Chat unlinked.", "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const rename = async (link) => {
    const next = window.prompt("New label for this chat:");
    if (next === null) return;
    try {
      await api.telegramLinks.update(link.id, { label: next.trim() });
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <section className="panel connector-card">
      <div className="connector-head">
        <span className="connector-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21.9 4.6 19 19.3c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.6L18.6 7c.4-.3-.1-.5-.6-.2L7.7 13.3l-4.4-1.4c-1-.3-1-1 .2-1.4L20.6 3.9c.8-.3 1.5.2 1.3.7z" /></svg>
        </span>
        <div>
          <h2 className="panel-title">Telegram</h2>
          <p className="connector-sub">Log expenses in chat — <b>@lumvexi_bot</b></p>
        </div>
        <span className="connector-status">Active</span>
      </div>

      <p className="tg-hint">Message the bot <code>/start</code> to get this chat&apos;s id,
        then link it below. Each linked chat acts as this account.</p>
      <form className={`tg-form${locked ? " tg-form-locked" : ""}`} onSubmit={submit}>
        <input type="text" placeholder="Add here" inputMode="numeric" autoComplete="off"
          disabled={locked} value={chatId} onChange={(e) => { setChatId(e.target.value); setError(""); }} />
        <input type="text" placeholder="Label (optional)" autoComplete="off" maxLength={60}
          disabled={locked} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={locked}>Link chat</button>
      </form>
      {locked && <p className="tg-hint">A chat is already linked to this account — unlink it first to link a different one.</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="tg-links">
        {loadError ? (
          <p className="empty-state">{loadError}</p>
        ) : !links.length ? (
          <p className="empty-state">No chats linked yet. Add your chat id above and the bot will respond as you.</p>
        ) : links.map((l) => (
          <div className="tg-link-row" key={l.id}>
            <div className="tg-link-main">
              {/* Privacy: never show the full chat id once linked. */}
              <span className="tg-chat-id">••••••</span>
              <span className="tg-label">{l.label || "••••"}</span>
            </div>
            <div className="row-actions">
              <button className="icon-btn" onClick={() => rename(l)}>Rename</button>
              <button className="icon-btn" onClick={() => unlink(l)}>Unlink</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ConnectorsPage() {
  return (
    <AppShell>
      <header className="view-header">
        <div>
          <p className="eyebrow-plain">Integrations</p>
          <h1>Connectors</h1>
        </div>
      </header>

      <p className="connectors-intro">
        Connect external channels to your ledger. Each connector links its own
        chats or accounts — entries made through it are logged against your
        Ledger account.
      </p>

      <div className="connectors-grid">
        <TelegramConnector />

        <section className="panel connector-card connector-card-soon">
          <div className="connector-head">
            <span className="connector-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13zm2.3-.5 7.2 6.1c.3.25.7.25 1 0L19.7 5H4.3zM20 7.2l-6.3 5.3a2.8 2.8 0 0 1-3.4 0L4 7.2v11.3h16V7.2z" /></svg>
            </span>
            <div>
              <h2 className="panel-title">Email</h2>
              <p className="connector-sub">Forward receipts by email</p>
            </div>
            <span className="connector-status connector-status-off">Inactive</span>
          </div>
          <p className="tg-hint">Add the email you&apos;d forward receipts from. Linking is
            disabled until the email-in service is switched on.</p>
          <form className="tg-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="you@example.com" disabled />
            <input type="text" placeholder="Label (optional)" disabled />
            <button className="btn btn-primary" type="button" disabled>Link email</button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
