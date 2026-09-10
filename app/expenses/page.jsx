"use client";

// Expenses: filter bar, table, delete confirm, CSV/PDF export.
// Port of the expenses page + expenses.js table logic.

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useApp } from "@/context/AppContext";
import { api, downloadFile, isDbError } from "@/lib/api";
import { formatDate, money } from "@/lib/format";

const EMPTY_FILTERS = { search: "", category: "", from: "", to: "" };

export default function ExpensesPage() {
  const {
    expenses, expenseCategories, loadCachedState, refreshData, toast,
    askConfirm, openExpenseModal,
  } = useApp();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    (async () => {
      loadCachedState();
      try {
        await refreshData();
      } catch (e) {
        if (!isDbError(e)) toast(e.message, "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const clear = () => setFilters(EMPTY_FILTERS);

  const rows = expenses.filter((e) => {
    if (filters.search && !`${e.name || ""} ${e.note || ""}`.toLowerCase().includes(filters.search.trim().toLowerCase())) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.from && e.expense_date < filters.from) return false;
    if (filters.to && e.expense_date > filters.to) return false;
    return true;
  });

  const remove = async (expense) => {
    const label = expense.name || expense.note || expense.category;
    const ok = await askConfirm(`This removes "${label}" for good. It can't be undone.`, { title: "Delete expense?" });
    if (!ok) return;
    try {
      await api.deleteExpense(expense.id);
      toast("Expense deleted.", "success");
      await refreshData();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <AppShell loading={loading}>
      <header className="view-header">
        <div>
          <p className="eyebrow-plain">All entries</p>
          <h1>Expenses</h1>
        </div>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => downloadFile("/api/reports/expenses.csv", "ledger-expenses.csv").catch((err) => toast(err.message, "error"))}>Export CSV</button>
          <button className="btn btn-ghost" onClick={() => downloadFile("/api/reports/expenses.pdf", "ledger-report.pdf").catch((err) => toast(err.message, "error"))}>PDF report</button>
          <button className="btn btn-primary" onClick={() => openExpenseModal()}>+ Add expense</button>
        </div>
      </header>

      <div className="filter-bar">
        <input type="text" placeholder="Search name…" value={filters.search} onChange={set("search")} />
        <select value={filters.category} onChange={set("category")}>
          <option value="">All categories</option>
          {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={set("from")} />
        <span className="filter-sep">to</span>
        <input type="date" value={filters.to} onChange={set("to")} />
        <button className="btn btn-ghost" onClick={clear}>Clear</button>
      </div>

      <div className="ledger-table-wrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Name</th>
              <th className="align-right">Amount</th>
              <th className="align-right">—</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.expense_date)}</td>
                <td><span className="category-tag">{e.category}</span></td>
                <td>{e.name || e.category}</td>
                <td className="align-right amount-cell">{money(e.amount)}</td>
                <td className="align-right">
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => openExpenseModal(e)}>Edit</button>
                    <button className="icon-btn" onClick={() => remove(e)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty-state">No entries yet. The page is blank — add the first line.</p>}
      </div>
    </AppShell>
  );
}
