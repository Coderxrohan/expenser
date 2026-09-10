"use client";

// Analytics: MoM delta, avg per transaction, daily bar chart, top
// merchants, category comparison. Port of client/js/analytics.js.

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

function TrendChart({ series }) {
  if (!series.length) {
    return <text x="250" y="80" textAnchor="middle" fill="#767c6c" fontSize="12">No data this month yet.</text>;
  }
  const max = Math.max(...series.map((d) => d.amount), 1);
  const w = 500, h = 160, pad = 6;
  const barW = Math.max(3, Math.floor((w - pad * 2) / series.length) - 2);
  return (
    <>
      {series.map((d, i) => {
        const barH = Math.max(2, (d.amount / max) * (h - 24));
        const x = pad + i * ((w - pad * 2) / series.length);
        const y = h - barH - 14;
        return (
          <rect key={i} x={x} y={y} width={barW} height={barH} fill="#a9843a" rx="1">
            <title>{d.date}: {money(d.amount)}</title>
          </rect>
        );
      })}
      <line x1={pad} y1={h - 14} x2={w - pad} y2={h - 14} stroke="#ddd8c8" strokeWidth="1" />
    </>
  );
}

export default function AnalyticsPage() {
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setData(await api.analytics());
      } catch (e) {
        setError(e.message);
        toast(e.message, "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const comparison = [...(data?.categoryComparison || [])].sort((x, y) => y.thisMonth - x.thisMonth);

  return (
    <AppShell loading={!data && !error}>
      <header className="view-header">
        <div>
          <p className="eyebrow-plain">Insights</p>
          <h1>Analytics</h1>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat-card">
          <p className="stat-label">Month-over-month</p>
          <p className={`stat-figure stat-figure-sm ${data?.monthOverMonth > 0 ? "delta-up" : "delta-down"}`}>
            {data == null ? "—" : data.monthOverMonth === null ? "—" : `${data.monthOverMonth > 0 ? "+" : ""}${data.monthOverMonth}%`}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Avg per transaction</p>
          <p className="stat-figure stat-figure-sm">{data ? money(data.averagePerTransaction) : "₹0"}</p>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="panel">
          <h2 className="panel-title">Daily spending this month</h2>
          <svg className="trend-chart" viewBox="0 0 500 160" preserveAspectRatio="none">
            <TrendChart series={data?.dailySeries || []} />
          </svg>
        </div>
        <div className="panel">
          <h2 className="panel-title">Top merchants</h2>
          <div className="merchants-list">
            {(data?.topMerchants || []).length
              ? data.topMerchants.map((m, i) => (
                  <div className="merchants-row" key={i}>
                    <span>{m.merchant}</span>
                    <strong>{money(m.amount)}</strong>
                  </div>
                ))
              : <p className="empty-state">No entries with names this month.</p>}
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Category comparison (this vs last month)</h2>
        <table className="compare-table">
          <thead>
            <tr><th>Category</th><th>This month</th><th>Last month</th><th>Δ</th></tr>
          </thead>
          <tbody>
            {comparison.length ? comparison.map((c) => {
              const delta = c.thisMonth - c.lastMonth;
              return (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td>{money(c.thisMonth)}</td>
                  <td>{money(c.lastMonth)}</td>
                  <td className={delta > 0 ? "delta-up" : "delta-down"}>
                    {delta > 0 ? "+" : ""}{money(delta)}
                  </td>
                </tr>
              );
            }) : <tr><td colSpan="4" className="empty-state">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
