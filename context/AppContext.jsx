"use client";

// App-wide store: Supabase session, ledger data, toasts, confirm dialog,
// and the shared expense/income modals (dashboard quick-add + list pages).

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import { api, isDbError } from "@/lib/api";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/format";

const AppContext = createContext(null);

const STATE_CACHE_KEY = "ledger_state_cache";
const CATEGORIES_KEY = "ledger_categories";
const PROFILE_CACHE_KEY = "ledger_profile";

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function AppProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profile, setProfile] = useState(() => readJSON(PROFILE_CACHE_KEY));
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [categories, setCategories] = useState(() => readJSON(CATEGORIES_KEY) || []);
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // {title, message, confirmLabel, resolve}
  const [expenseModal, setExpenseModal] = useState({ open: false, expense: null });
  const [incomeModal, setIncomeModal] = useState({ open: false, income: null });
  const [dbNotice, setDbNotice] = useState(false);

  const confirmResolve = useRef(null);
  confirmResolve.current = confirmState?.resolve ?? null;

  const toast = useCallback((message, type = "default") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const askConfirm = useCallback((message, { title = "Are you sure?", confirmLabel = "Delete" } = {}) =>
    new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(false);
      // reuse the styled modal
      setConfirmState({ message, title, confirmLabel, resolve });
    }), []);

  const resolveConfirm = useCallback((result) => {
    confirmResolve.current?.(result);
    setConfirmState(null);
  }, []);

  const expenseCategories = categories.length
    ? categories.filter((c) => c.type === "expense").map((c) => c.name)
    : DEFAULT_EXPENSE_CATEGORIES;
  const incomeCategories = categories.length
    ? categories.filter((c) => c.type === "income").map((c) => c.name)
    : DEFAULT_INCOME_CATEGORIES;

  const persistCategories = useCallback((cats) => {
    setCategories(cats);
    writeJSON(CATEGORIES_KEY, cats);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [exp, inc] = await Promise.all([
        api.request("/api/expenses"),
        api.request("/api/incomes"),
      ]);
      setExpenses(exp.expenses || []);
      setIncomes(inc.incomes || []);
      try { sessionStorage.setItem(STATE_CACHE_KEY, JSON.stringify({ expenses: exp.expenses || [], incomes: inc.incomes || [] })); } catch {}
    } catch (e) {
      if (isDbError(e)) setDbNotice(true);
      throw e;
    }
  }, []);

  const loadCachedState = useCallback(() => {
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(STATE_CACHE_KEY) || "null"); } catch {}
    if (cached && Array.isArray(cached.expenses) && Array.isArray(cached.incomes)) {
      setExpenses(cached.expenses);
      setIncomes(cached.incomes);
      return true;
    }
    return false;
  }, []);

  const loadProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      if (data) {
        setProfile(data);
        writeJSON(PROFILE_CACHE_KEY, data);
      }
    } catch {
      // profiles table likely missing (migration 012 not run) — fall back to email
    }
  }, []);

  const saveProfile = useCallback(async ({ display_name, avatar_url }) => {
    const row = {
      id: user.id,
      display_name: display_name || null,
      avatar_url: avatar_url ?? profile?.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("profiles").upsert(row).select().single();
    if (error) {
      if (/relation .*profiles.* does not exist/i.test(error.message)) {
        throw new Error("Run database/migrations/012_profiles.sql in Supabase first.");
      }
      throw new Error(error.message);
    }
    setProfile(data);
    writeJSON(PROFILE_CACHE_KEY, data);
    return data;
  }, [user, profile]);

  // session bootstrap
  useEffect(() => {
    let cancelled = false;
    sb.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data?.session?.user) {
        setUser(data.session.user);
        await loadProfile(data.session.user.id);
      }
      setAuthResolved(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    router.push("/login");
  }, [router]);

  const value = {
    sb,
    user,
    authResolved,
    profile,
    saveProfile,
    expenses,
    incomes,
    categories,
    expenseCategories,
    incomeCategories,
    persistCategories,
    setCategories,
    refreshData,
    dbNotice,
    loadCachedState,
    toast,
    askConfirm,
    confirmState,
    resolveConfirm,
    expenseModal,
    openExpenseModal: (expense = null) => setExpenseModal({ open: true, expense }),
    closeExpenseModal: () => setExpenseModal((m) => ({ ...m, open: false })),
    incomeModal,
    openIncomeModal: (income = null) => setIncomeModal({ open: true, income }),
    closeIncomeModal: () => setIncomeModal((m) => ({ ...m, open: false })),
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
