"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import "./landing.css";

const FEATURES = [
  { icon: "📊", name: "Dashboard", sub: "Your month at a glance" },
  { icon: "🧾", name: "Receipt OCR", sub: "Snap, and it's logged" },
  { icon: "✈️", name: "Telegram bot", sub: "Add expenses in chat" },
  { icon: "📈", name: "Analytics", sub: "Trends & reports" },
];

export default function LandingPage() {
  const router = useRouter();

  // Already signed in? Skip the landing page.
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <section className="landing">
      <div className="landing-brand">
        <img className="brand-logo" src="/logo.svg" alt="Ledger logo" />
        <span className="brand-name">Ledger</span>
      </div>

      <h1>Every rupee,<br /><em>quietly accounted for.</em></h1>
      <p className="landing-sub">
        A calm, fast expense manager — track spending and income, see where the
        month goes, and log purchases straight from Telegram or a receipt photo.
      </p>

      <div className="landing-actions">
        <Link className="btn btn-primary" href="/login">Log in</Link>
        <Link className="btn btn-ghost" href="/login?tab=signup">Create account</Link>
      </div>

      <div className="features">
        {FEATURES.map((f) => (
          <div className="feature" key={f.name}>
            <span className="feature-icon">{f.icon}</span>
            <div className="feature-name">{f.name}</div>
            <div className="feature-sub">{f.sub}</div>
          </div>
        ))}
      </div>

      <p className="landing-foot">Ledger — a quiet place to keep the books.</p>
    </section>
  );
}
