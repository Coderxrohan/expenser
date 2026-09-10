"use client";

// Dashboard: this month's stats, last-7-days wave, radar "donut",
// category breakdown, recent entries. Port of client/js/dashboard.js.

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { useApp } from "@/context/AppContext";
import { isDbError } from "@/lib/api";
import { formatDate, localISO, money, monthBounds } from "@/lib/format";

const shortCat = (cat) => (cat.length > 9 ? cat.slice(0, 8) + "…" : cat);

// Radar chart: one spoke per category, dot at each category's spend.
function DonutChart({ rows, total }) {
  const top = [...rows].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const C = 60, R = 40; // center and max radius

  if (!top.length || total === 0) {
    return (
      <>
        <circle cx="60" cy="60" r="44" fill="none" stroke="#ddd8c8" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="3" fill="#ddd8c8" />
      </>
    );
  }

  const n = top.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const max = Math.max(...top.map(([, amt]) => amt), 1);

  const web = [];
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    const points = top.map((_, i) => {
      const a = angle(i);
      return `${(C + Math.cos(a) * R * f).toFixed(2)},${(C + Math.sin(a) * R * f).toFixed(2)}`;
    }).join(" ");
    web.push(<polygon key={`ring${f}`} points={points} fill="none" stroke="#d9d3c2" strokeWidth="0.7" />);
  });
  top.forEach((_, i) => {
    const a = angle(i);
    web.push(<line key={`spoke${i}`} x1={C} y1={C} x2={(C + Math.cos(a) * R).toFixed(2)} y2={(C + Math.sin(a) * R).toFixed(2)} stroke="#d9d3c2" strokeWidth="0.7" />);
  });

  const dataPts = top.map(([, amt], i) => {
    const a = angle(i);
    const r = R * (amt / max);
    return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, a };
  });
  const poly = dataPts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  const labels = top.map(([cat], i) => {
    const a = angle(i);
    const lx = C + Math.cos(a) * (R + 9);
    const ly = C + Math.sin(a) * (R + 9);
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
    return (
      <text key={`lbl${i}`} x={lx.toFixed(2)} y={(ly + 2).toFixed(2)} textAnchor={anchor}
        fontSize="5.5" fontFamily="Inter, sans-serif" fill="var(--muted)">{shortCat(cat)}</text>
    );
  });

  return (
    <>
      {web}
      <polygon points={poly} fill="rgba(169, 132, 58, 0.28)" stroke="var(--brass)" strokeWidth="1.4" strokeLinejoin="round" />
      {dataPts.map((p, i) => (
        <circle key={`dot${i}`} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="2.6" fill="var(--rust)" stroke="var(--paper)" strokeWidth="1" />
      ))}
      {labels}
    </>
  );
}

// Last-7-days wave (Catmull-Rom → cubic bezier, like the original).
function WaveChart({ expenses, width }) {

  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      iso: localISO(d),
      label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
      amount: 0,
    });
  }
  const byDate = {};
  for (const e of expenses) byDate[e.expense_date] = (byDate[e.expense_date] || 0) + Number(e.amount);
  days.forEach((d) => { d.amount = byDate[d.iso] || 0; });

  const W = width, H = 150;
  const padX = 28, padTop = 24, padBottom = 30;
  const max = Math.max(...days.map((d) => d.amount), 1);
  const px = (i) => padX + (i * (W - padX * 2)) / (days.length - 1);
  const py = (a) => padTop + (1 - a / max) * (H - padTop - padBottom);
  const pts = days.map((d, i) => ({ x: px(i), y: py(d.amount), ...d }));

  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  const area = path + ` L ${pts[pts.length - 1].x} ${H - padBottom} L ${pts[0].x} ${H - padBottom} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a9843a" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#a9843a" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#waveFill)" />
      <path d={path} fill="none" stroke="var(--brass)" strokeWidth="2.5" strokeLinecap="round" />
      {pts.map((p, i) => {
        const last = i === pts.length - 1;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={last ? 5.5 : 4}
              fill={last ? "var(--rust)" : "var(--paper)"}
              stroke={last ? "var(--rust)" : "var(--brass)"} strokeWidth="2" />
            <text x={p.x} y={H - 10} textAnchor="middle" fontSize="11"
              fill={last ? "var(--rust)" : "var(--muted)"} fontFamily="Inter, sans-serif">{p.label}</text>
            {p.amount > 0 && (
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10.5"
                fill="var(--ink)" fontFamily="Inter, sans-serif">₹{Math.round(p.amount)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DashboardContent() {
  const { expenses, incomes, loadCachedState, refreshData, toast, openExpenseModal, openIncomeModal } = useApp();
  const [loading, setLoading] = useState(true);
  const waveRef = useRef(null);
  const [waveWidth, setWaveWidth] = useState(320);

  useEffect(() => {
    (async () => {
      const hadCache = loadCachedState();
      try {
        await refreshData();
      } catch (e) {
        if (!isDbError(e)) toast(e.message, "error");
      } finally {
        setLoading(false);
        if (waveRef.current) setWaveWidth(Math.max(waveRef.current.clientWidth, 320));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const { start, end } = monthBounds(now);
  const thisMonth = expenses.filter((e) => e.expense_date >= start && e.expense_date <= end);
  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);

  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { start: pStart, end: pEnd } = monthBounds(prevDate);
  const lastMonth = expenses.filter((e) => e.expense_date >= pStart && e.expense_date <= pEnd);
  const lastTotal = lastMonth.reduce((s, e) => s + Number(e.amount), 0);

  const totalIn = incomes.reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalIn - totalOut;

  const todayIso = localISO(now);
  const todayTotal = expenses
    .filter((e) => e.expense_date === todayIso)
    .reduce((s, e) => s + Number(e.amount), 0);

  const thisMonthIncome = incomes.filter((e) => e.income_date >= start && e.income_date <= end);
  const incomeTotal = thisMonthIncome.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = {};
  thisMonth.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
  const maxCat = Math.max(1, ...Object.values(byCategory));
  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  const recent = expenses.slice(0, 6);

  return (
    <AppShell loading={loading}>
      <header className="view-header">
        <div>
          <p className="eyebrow-plain">This month</p>
          <h1>{now.toLocaleString(undefined, { month: "long", year: "numeric" })}</h1>
        </div>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => openIncomeModal()}>+ Add income</button>
          <button className="btn btn-primary" onClick={() => openExpenseModal()}>+ Add expense</button>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat-card stat-card-balance">
          <p className="stat-label">Left balance</p>
          <p className="stat-figure" style={{ color: balance < 0 ? "var(--rust)" : "" }}>{money(balance)}</p>
        </div>
        <div className="stat-card stat-card-hero stat-card-spent">
          <p className="stat-label">Spent this month</p>
          <p className="stat-figure">{money(monthTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Earned this month</p>
          <p className="stat-figure stat-figure-sm">{money(incomeTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Spent today</p>
          <p className="stat-figure stat-figure-sm">{money(todayTotal)}</p>
        </div>
      </div>

      <div className="panel wave-panel">
        <h2 className="panel-title">Last 7 days</h2>
        <div className="wave-chart" ref={waveRef}>
          <WaveChart expenses={expenses} width={waveWidth} />
        </div>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <h2 className="panel-title">By category</h2>
          <div className="donut-wrap">
            <svg viewBox="0 0 120 120" className="donut-svg">
              <DonutChart rows={rows} total={monthTotal} />
            </svg>
            <div className="donut-center">
              <span className="donut-center-label">Total</span>
              <span className="donut-center-figure">{money(monthTotal)}</span>
            </div>
          </div>
          <div className="category-breakdown">
            {rows.length ? rows.map(([cat, amt]) => (
              <div className="category-row" key={cat}>
                <div className="category-row-top">
                  <span className="category-name">{cat}</span>
                  <span className="category-amount">{money(amt)}</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(amt / maxCat) * 100}%` }}></div></div>
              </div>
            )) : <p className="empty-state">Nothing logged this month yet.</p>}
          </div>
        </div>
        <div className="panel">
          <h2 className="panel-title">Recent entries</h2>
          <div className="recent-list">
            {recent.length ? recent.map((e) => (
              <div className="recent-row" key={e.id}>
                <div>
                  <div>{e.name || e.category}</div>
                  <div className="recent-meta">{e.category} · {formatDate(e.expense_date)}</div>
                </div>
                <div className="recent-amount">{money(e.amount)}</div>
              </div>
            )) : <p className="empty-state">No entries yet.</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
