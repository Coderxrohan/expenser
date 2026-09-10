"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { PAYMENT_METHODS, todayISO } from "@/lib/format";

// Add/edit expense modal. Opened from the dashboard quick-add button
// or the Expenses page via openExpenseModal(expenseOrNull) in context.
export default function ExpenseModal() {
  const { expenseModal, closeExpenseModal, expenseCategories, refreshData, toast } = useApp();
  const { open, expense } = expenseModal;
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError("");
      setForm({
        amount: expense ? expense.amount : "",
        name: expense ? (expense.name || "") : "",
        category: expense ? expense.category : "",
        payment_method: expense?.payment_method || "cash",
        expense_date: expense ? expense.expense_date : todayISO(),
        note: expense ? (expense.note || "") : "",
      });
    }
  }, [open, expense]);

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
        expense_date: form.expense_date,
        note: form.note.trim() || null,
      };
      if (expense) {
        await api.updateExpense(expense.id, payload);
      } else {
        await api.createExpense(payload);
      }
      closeExpenseModal();
      toast(expense ? "Expense updated." : "Expense added.", "success");
      await refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeExpenseModal(); }}>
      <div className="modal">
        <h2>{expense ? "Edit expense" : "Add expense"}</h2>
        <form onSubmit={submit}>
          <label>Amount
            <input type="number" min="0.01" step="0.01" required value={form.amount || ""} onChange={set("amount")} />
          </label>
          <label>Name
            <input type="text" maxLength={120} required placeholder="e.g. Groceries at DMart" value={form.name || ""} onChange={set("name")} />
          </label>
          <label>Category
            <select required value={form.category || ""} onChange={set("category")}>
              {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Payment method
            <select required value={form.payment_method} onChange={set("payment_method")}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label>Date
            <input type="date" required value={form.expense_date || ""} onChange={set("expense_date")} />
          </label>
          <label>Note (optional)
            <input type="text" maxLength={200} value={form.note || ""} onChange={set("note")} />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={closeExpenseModal}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
