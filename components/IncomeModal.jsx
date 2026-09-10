"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { PAYMENT_METHODS, todayISO } from "@/lib/format";

// Add/edit income modal, mirrors ExpenseModal.
export default function IncomeModal() {
  const { incomeModal, closeIncomeModal, incomeCategories, refreshData, toast } = useApp();
  const { open, income } = incomeModal;
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError("");
      setForm({
        amount: income ? income.amount : "",
        name: income ? (income.name || "") : "",
        category: income ? income.category : "",
        payment_method: income?.payment_method || "cash",
        income_date: income ? income.income_date : todayISO(),
        note: income ? (income.note || "") : "",
      });
    }
  }, [open, income]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        amount: parseFloat(form.amount),
        name: form.name.trim(),
        category: form.category,
        payment_method: form.payment_method,
        income_date: form.income_date,
        note: form.note.trim() || null,
      };
      if (income) {
        await api.updateIncome(income.id, payload);
      } else {
        await api.createIncome(payload);
      }
      closeIncomeModal();
      toast(income ? "Income updated." : "Income added.", "success");
      await refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeIncomeModal(); }}>
      <div className="modal">
        <h2>{income ? "Edit income" : "Add income"}</h2>
        <form onSubmit={submit}>
          <label>Amount
            <input type="number" min="0.01" step="0.01" required value={form.amount || ""} onChange={set("amount")} />
          </label>
          <label>Name
            <input type="text" maxLength={120} required placeholder="e.g. October salary" value={form.name || ""} onChange={set("name")} />
          </label>
          <label>Source
            <select required value={form.category || ""} onChange={set("category")}>
              {incomeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Payment method
            <select required value={form.payment_method} onChange={set("payment_method")}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label>Date
            <input type="date" required value={form.income_date || ""} onChange={set("income_date")} />
          </label>
          <label>Note (optional)
            <input type="text" maxLength={200} value={form.note || ""} onChange={set("note")} />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={closeIncomeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
