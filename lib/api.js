"use client";

import { sb } from "./supabase";

async function getToken() {
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token || null;
}

function gotoLogin() {
  window.location.href = "/login";
}

export async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = await getToken();
  if (!token) {
    gotoLogin();
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
    gotoLogin();
    throw new Error("Session expired — log in again.");
  }
  const type = res.headers.get("content-type") || "";
  const payload = type.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error((payload && payload.error) || `Request failed (${res.status})`);
  return payload;
}

// Binary-safe download (CSV / PDF) — fetches with the auth header
// and saves via a blob.
export async function downloadFile(path, filename) {
  const token = await getToken();
  if (!token) {
    gotoLogin();
    throw new Error("Not signed in.");
  }
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// True when a request failed because the Supabase schema (tables)
// hasn't been created yet — surfaced as a setup banner, not an error toast.
export const isDbError = (e) =>
  /schema cache|does not exist|could not find the table|relation/i.test(e?.message || "");

export const api = {
  request,

  createExpense: (payload) => request("/api/expenses", { method: "POST", body: payload }),
  updateExpense: (id, payload) => request(`/api/expenses/${id}`, { method: "PATCH", body: payload }),
  deleteExpense: (id) => request(`/api/expenses/${id}`, { method: "DELETE" }),

  createIncome: (payload) => request("/api/incomes", { method: "POST", body: payload }),
  updateIncome: (id, payload) => request(`/api/incomes/${id}`, { method: "PATCH", body: payload }),
  deleteIncome: (id) => request(`/api/incomes/${id}`, { method: "DELETE" }),

  analytics: () => request("/api/expenses/analytics"),

  categories: {
    list: () => request("/api/categories"),
    create: (payload) => request("/api/categories", { method: "POST", body: payload }),
    update: (id, payload) => request(`/api/categories/${id}`, { method: "PATCH", body: payload }),
    remove: (id) => request(`/api/categories/${id}`, { method: "DELETE" }),
    reset: (type) => request("/api/categories/reset", { method: "POST", body: { type } }),
    reorder: (type, ids) => request("/api/categories/reorder", { method: "POST", body: { type, ids } }),
  },

  telegramLinks: {
    list: () => request("/api/telegram/links"),
    create: (payload) => request("/api/telegram/links", { method: "POST", body: payload }),
    update: (id, payload) => request(`/api/telegram/links/${id}`, { method: "PATCH", body: payload }),
    remove: (id) => request(`/api/telegram/links/${id}`, { method: "DELETE" }),
  },
};
