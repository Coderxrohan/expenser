// ============================================================
// Ledger — auth.js: login page (sign up / log in / log out)
// ============================================================
(function () {
  const L = window.Ledger;

  if (!L.sb) {
    const err = L.$("#login-error");
    if (err) {
      err.textContent =
        'Setup incomplete — add SUPABASE_URL and SUPABASE_ANON_KEY to .env and run "node server/src/server.js".';
    }
    return;
  }

  // ?tab=signup from the landing page
  if (new URLSearchParams(location.search).get("tab") === "signup") {
    L.$$('.auth-tab').find((t) => t.dataset.tab === "signup")?.click();
  }

  // already signed in → straight to the dashboard
  L.sb.auth.getSession().then(({ data }) => {
    if (data.session) location.href = "dashboard.html";
  });

  L.$$(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      L.$$(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      L.$("#login-form").classList.toggle("hidden", !isLogin);
      L.$("#signup-form").classList.toggle("hidden", isLogin);
    });
  });

  L.$("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    L.$("#login-error").textContent = "";
    const email = L.$("#login-email").value.trim();
    const password = L.$("#login-password").value;
    const btn = e.target.querySelector("button[type=submit]");
    await L.withButtonLoading(btn, "Logging in…", async () => {
      const { error } = await L.sb.auth.signInWithPassword({ email, password });
      if (error) {
        L.$("#login-error").textContent = error.message;
      } else {
        location.href = "dashboard.html";
      }
    })();
  });

  L.$("#signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    L.$("#signup-error").textContent = "";
    L.$("#signup-note").textContent = "";
    const email = L.$("#signup-email").value.trim();
    const password = L.$("#signup-password").value;
    const btn = e.target.querySelector("button[type=submit]");
    await L.withButtonLoading(btn, "Creating…", async () => {
      const { error } = await L.sb.auth.signUp({ email, password });
      if (error) {
        L.$("#signup-error").textContent = error.message;
      } else {
        L.$("#signup-note").textContent = "Account created. Check your inbox to confirm, then log in.";
      }
    })();
  });
})();
