// ============================================================
// Ledger — api.js: REST client for the Express API
// Every request carries the Supabase access token so RLS applies.
// ============================================================
(function () {
  const L = window.Ledger;

  async function getToken() {
    const { data } = await L.sb.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const token = await getToken();
    if (!token) {
      location.href = "login.html";
      throw new Error("Not signed in.");
    }
    const res = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...headers,
      },
      body: body !== undefined
        ? (body instanceof FormData || typeof body === "string" ? body : JSON.stringify(body))
        : undefined,
    });

    if (res.status === 401) {
      location.href = "login.html";
      throw new Error("Session expired — log in again.");
    }
    const type = res.headers.get("content-type") || "";
    const payload = type.includes("json") ? await res.json() : await res.text();
    if (!res.ok) throw new Error((payload && payload.error) || `Request failed (${res.status})`);
    return payload;
  }

  // ---------- data loading ----------
  L.refreshData = async function () {
    const [exp, inc] = await Promise.all([
      request("/api/expenses"),
      request("/api/incomes"),
    ]);
    L.state.expenses = exp.expenses || [];
    L.state.incomes = inc.incomes || [];
  };

  // ---------- expenses ----------
  L.api = {
    request,

    createExpense: (payload) => request("/api/expenses", { method: "POST", body: payload }),
    updateExpense: (id, payload) => request(`/api/expenses/${id}`, { method: "PATCH", body: payload }),
    deleteExpense: (id) => request(`/api/expenses/${id}`, { method: "DELETE" }),

    createIncome: (payload) => request("/api/incomes", { method: "POST", body: payload }),
    updateIncome: (id, payload) => request(`/api/incomes/${id}`, { method: "PATCH", body: payload }),
    deleteIncome: (id) => request(`/api/incomes/${id}`, { method: "DELETE" }),

    analytics: () => request("/api/expenses/analytics"),
  };
})();
