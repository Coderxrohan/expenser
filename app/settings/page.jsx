"use client";

// Settings: add / rename / reorder / delete expense & income categories.
// Port of client/js/categories.js.

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

function CategoryPanel({ type, title, hint }) {
  const { categories, persistCategories, setCategories, askConfirm, toast } = useApp();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const rows = categories.filter((c) => c.type === type);

  const load = async () => {
    try {
      const { categories: cats } = await api.categories.list();
      persistCategories(cats || []);
    } catch (e) {
      setError(`Couldn't load categories: ${e.message}`);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter a category name.");
    try {
      await api.categories.create({ type, name: name.trim() });
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const move = async (cat, dir) => {
    const siblings = categories.filter((c) => c.type === type);
    const idx = siblings.findIndex((c) => c.id === cat.id);
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= siblings.length) return;
    const next = [...siblings];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    try {
      const { categories: cats } = await api.categories.reorder(type, next.map((c) => c.id));
      setCategories([...categories.filter((c) => c.type !== type), ...(cats || [])]);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const rename = async (cat) => {
    const next = window.prompt("New name:", cat.name);
    if (next === null || !next.trim()) return;
    try {
      await api.categories.update(cat.id, { name: next.trim() });
      await load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const remove = async (cat) => {
    const ok = await askConfirm(
      `New entries can't use "${cat.name}" anymore. Existing ${cat.type}s keep it.`,
      { title: "Delete category?" }
    );
    if (!ok) return;
    try {
      await api.categories.remove(cat.id);
      await load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const reset = async () => {
    const ok = await askConfirm(
      "This removes all your custom categories of this type and restores the built-in defaults.",
      { title: "Reset to defaults?", confirmLabel: "Reset" }
    );
    if (!ok) return;
    try {
      const { categories: cats } = await api.categories.reset(type);
      setCategories([...categories.filter((c) => c.type !== type), ...(cats || [])]);
      toast("Categories restored to defaults.", "success");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      <p className="tg-hint">{hint}</p>
      <form className="cat-add-form" onSubmit={add}>
        <input type="text" placeholder="New category name" maxLength={40} autoComplete="off"
          value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
      {error && <p className="cat-error">{error}</p>}
      <div className="cat-list">
        {rows.length ? rows.map((c, i) => (
          <div className="cat-row" key={c.id}>
            <span className="cat-order-btns">
              <button className="icon-btn cat-move" title="Move up" disabled={i === 0} onClick={() => move(c, "up")}>↑</button>
              <button className="icon-btn cat-move" title="Move down" disabled={i === rows.length - 1} onClick={() => move(c, "down")}>↓</button>
            </span>
            <span className="cat-name">{c.name}</span>
            <span className="row-actions">
              <button className="icon-btn" onClick={() => rename(c)}>Rename</button>
              <button className="icon-btn" onClick={() => remove(c)}>Delete</button>
            </span>
          </div>
        )) : <p className="empty-state">{error || "No categories — add one above."}</p>}
      </div>
      <button type="button" className="btn btn-ghost btn-block cat-reset" onClick={reset}>Reset to defaults</button>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <header className="view-header">
        <div>
          <p className="eyebrow-plain">Personalize</p>
          <h1>Settings</h1>
        </div>
      </header>

      <div className="settings-grid">
        <CategoryPanel type="expense" title="Expense categories"
          hint="Used by the Add expense form and the expenses filter. Deleting a category doesn't touch existing entries — it just disappears from new ones." />
        <CategoryPanel type="income" title="Income categories"
          hint="Used by the Add income form and the income filter (sources like Salary, Freelance…)." />
      </div>
    </AppShell>
  );
}
