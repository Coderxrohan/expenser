"use client";

// Authenticated app chrome: sidebar (written once — the old HTML app
// copy-pasted it into every page), mobile topbar, user menu, edit-profile
// modal, loading overlay, toasts, confirm dialog, and the shared
// expense/income modals.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { sb } from "@/lib/supabase";
import ExpenseModal from "./ExpenseModal";
import IncomeModal from "./IncomeModal";

const NAV = [
  {
    href: "/dashboard", label: "Dashboard", title: "Dashboard",
    icon: (<><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>),
  },
  {
    href: "/expenses", label: "Expenses", title: "Expenses",
    icon: (<><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" /></>),
  },
  {
    href: "/income", label: "Income", title: "Income",
    icon: (<><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>),
  },
  {
    href: "/analytics", label: "Analytics", title: "Analytics",
    icon: (<><path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.05-.998.398-.998.95v8a1 1 0 0 0 1 1h8Z" /><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /></>),
  },
  {
    href: "/connectors", label: "Connectors", title: "Connectors",
    icon: (<><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></>),
  },
  {
    href: "/settings", label: "Settings", title: "Settings",
    icon: (<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>),
  },
];

const Icon = ({ children }) => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

function initialsFor(profile, user) {
  const name = (profile?.display_name || user?.email || "?").trim();
  const parts = name.split(/[\s._@-]+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}

export function Avatar({ url, className = "" }) {
  const { profile, user } = useApp();
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => setImgOk(true), [url]);
  return (
    <span className={`avatar ${className}`}>
      {url && imgOk && <img src={url} alt="" onError={() => setImgOk(false)} />}
      <span className="avatar-fallback">{initialsFor(profile, user)}</span>
      <span className="avatar-badge"></span>
    </span>
  );
}

// ---- edit profile modal (avatar upload/remove + display name) ----
// undefined = unchanged, null = removed, string = new upload
function ProfileModal({ open, onClose }) {
  const { profile, saveProfile, toast } = useApp();
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState(undefined);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useApp();
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(profile?.display_name || "");
      setPendingAvatarUrl(undefined);
      setError("");
    }
  }, [open, profile]);

  if (!open) return null;

  const previewUrl = pendingAvatarUrl === undefined ? (profile?.avatar_url || null) : pendingAvatarUrl;

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 2 * 1024 * 1024) {
      setError("Photo must be under 2 MB.");
      e.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await sb.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        if (/bucket not found/i.test(upErr.message)) throw new Error("Run database/migrations/012_profiles.sql in Supabase first (creates the avatars bucket).");
        throw new Error(upErr.message);
      }
      const { data } = sb.storage.from("avatars").getPublicUrl(path);
      setPendingAvatarUrl(`${data.publicUrl}?v=${Date.now()}`); // bust the cached photo
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await saveProfile({ display_name: name.trim(), avatar_url: pendingAvatarUrl });
      toast("Profile updated.", "success");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <h2>Edit profile</h2>
        <form onSubmit={submit}>
          <div className="profile-avatar-row">
            <Avatar url={previewUrl} className="avatar-lg" />
            <div className="profile-avatar-actions">
              <input type="file" accept="image/*" hidden ref={fileRef} onChange={upload} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>Upload photo</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingAvatarUrl(null)}>Remove</button>
            </div>
          </div>
          <label>Display name
            <input type="text" maxLength={60} placeholder="How should we call you?" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AppShell({ children, loading = false }) {
  const { user, authResolved, profile, signOut, confirmState, resolveConfirm, toasts, dbNotice } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("ledger_sidebar_collapsed") === "1"); } catch {}
  }, []);

  // the stylesheet expects these on <body> (body.nav-open, .sidebar-collapsed .app-shell)
  useEffect(() => {
    document.body.classList.toggle("nav-open", navOpen);
    return () => document.body.classList.remove("nav-open");
  }, [navOpen]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    return () => document.body.classList.remove("sidebar-collapsed");
  }, [collapsed]);

  // close the mobile drawer after navigating
  useEffect(() => setNavOpen(false), [pathname]);

  // click-outside closes the user menu
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (!e.target.closest(".sidebar-footer")) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  // signed-out users never see app pages
  useEffect(() => {
    if (authResolved && !user) router.replace("/login");
  }, [authResolved, user, router]);

  if (!user) return null;

  const toggleCollapse = () => {
    const on = !collapsed;
    setCollapsed(on);
    try { localStorage.setItem("ledger_sidebar_collapsed", on ? "1" : "0"); } catch {}
  };

  const name = profile?.display_name || user.email;

  return (
    <>
      <div className="app-shell">
        <header className="mobile-topbar">
          <button className="hamburger" aria-label="Open menu" onClick={() => setNavOpen(true)}>&#9776;</button>
          <span className="mobile-title"><img className="brand-logo brand-logo-sm" src="/logo.svg" alt="" /> Ledger</span>
        </header>
        <div className="nav-backdrop" onClick={() => setNavOpen(false)}></div>

        <aside className="sidebar">
          <Link className="sidebar-brand" href="/dashboard" title="Ledger — home">
            <img className="brand-logo" src="/logo.svg" alt="Ledger logo" /><span className="brand-name">Ledger</span>
          </Link>
          <button className="sidebar-collapse" onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label="Collapse sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></svg>
          </button>

          <nav className="sidebar-nav">
            <p className="nav-group-label">Menu</p>
            {NAV.map((item) => (
              <Link key={item.href} className={`nav-tab${pathname === item.href ? " active" : ""}`}
                href={item.href} title={item.title}>
                <Icon>{item.icon}</Icon><span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button type="button" className="user-trigger" aria-haspopup="menu" aria-expanded={menuOpen} title={name}
              onClick={() => setMenuOpen((o) => !o)}>
              <Avatar url={profile?.avatar_url} />
              <span className="user-meta">
                <span className="user-name">{name}</span>
                <span className="user-email">{user.email}</span>
              </span>
              <span className="user-chevron">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
              </span>
            </button>
            {menuOpen && (
              <div className="user-menu" role="menu">
                <button type="button" className="user-menu-item" onClick={() => { setMenuOpen(false); setProfileModalOpen(true); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  Edit profile
                </button>
                <button type="button" className="user-menu-item user-menu-danger" onClick={signOut}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="main">
          {dbNotice && (
            <div className="db-notice">
              <b>Database isn’t set up yet.</b> Apply <code>database/schema.sql</code> plus the
              migrations in <code>database/migrations/</code> in the Supabase SQL Editor
              (or run <code>npm run db:setup</code>) to start tracking expenses.
            </div>
          )}
          {children}
        </main>
      </div>

      <div className={`loading-overlay${loading ? "" : " hidden"}`}>
        <div className="loading-mark"><img className="brand-logo brand-logo-lg" src="/logo.svg" alt="" /></div>
      </div>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === "error" ? "toast-error" : t.type === "success" ? "toast-success" : ""}`}>{t.message}</div>
        ))}
      </div>

      {confirmState && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <h2>{confirmState.title}</h2>
            <p className="confirm-message">{confirmState.message}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => resolveConfirm(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => resolveConfirm(true)}>{confirmState.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      <ExpenseModal />
      <IncomeModal />
    </>
  );
}
