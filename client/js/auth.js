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
  // (except when arriving from a password-reset link — that session is
  // a recovery session and must land on the new-password form instead)
  const isResetFlow = new URLSearchParams(location.search).get("reset") === "1";
  L.sb.auth.getSession().then(({ data }) => {
    if (data.session && !isResetFlow) location.href = "dashboard.html";
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

  // ---------- forgot password ----------
  function showForm(id) {
    ["login-form", "signup-form", "reset-form", "newpass-form"].forEach((f) =>
      L.$("#" + f).classList.toggle("hidden", f !== id)
    );
  }

  L.$("#forgot-link").addEventListener("click", () => {
    L.$("#reset-error").textContent = "";
    L.$("#reset-note").textContent = "";
    showForm("reset-form");
  });
  L.$("#reset-back").addEventListener("click", () => showForm("login-form"));

  L.$("#reset-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    L.$("#reset-error").textContent = "";
    L.$("#reset-note").textContent = "";
    const email = L.$("#reset-email").value.trim();
    const btn = e.target.querySelector("button[type=submit]");
    await L.withButtonLoading(btn, "Sending…", async () => {
      const { error } = await L.sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + "/login.html?reset=1",
      });
      if (error) {
        L.$("#reset-error").textContent = error.message;
      } else {
        L.$("#reset-note").textContent =
          "Reset link sent. Check your inbox (and spam) — it opens a page to set a new password.";
      }
    })();
  });

  // Coming back from the emailed reset link: show the new-password form.
  const urlParams = new URLSearchParams(location.search);
  L.sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      history.replaceState(null, "", "/login.html?reset=1");
      showForm("newpass-form");
    }
  });
  if (urlParams.get("reset") === "1") {
    // Recovery session may already be established by detectSessionInUrl;
    // if the user is signed in via a recovery link, prefer the new-password form.
    L.sb.auth.getSession().then(({ data }) => {
      if (data.session) showForm("newpass-form");
    });
  }

  L.$("#newpass-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    L.$("#newpass-error").textContent = "";
    const password = L.$("#newpass-password").value;
    const btn = e.target.querySelector("button[type=submit]");
    await L.withButtonLoading(btn, "Saving…", async () => {
      const { error } = await L.sb.auth.updateUser({ password });
      if (error) {
        L.$("#newpass-error").textContent = error.message;
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
