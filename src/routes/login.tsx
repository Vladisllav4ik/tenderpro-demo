import { createFileRoute, redirect } from "@tanstack/react-router";
import { login } from "@/lib/account-session";
import { useState, type FormEvent } from "react";
import { Box, ArrowRight } from "lucide-react";
export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.account) throw redirect({ to: "/tenders" });
  },
  component: Login,
});
function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    const clearPassword = () => {
      const input = form.elements.namedItem("password");
      if (input instanceof HTMLInputElement) input.value = "";
    };
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      setError("Вкажіть коректний email і пароль.");
      return;
    }
    setBusy(true);
    try {
      await login({ data: { email, password } });
      clearPassword();
      window.location.assign("/tenders");
    } catch {
      setError("Невірний email або пароль");
      clearPassword();
      setBusy(false);
    }
  }
  return (
    <main className="login-workspace">
      <header className="sheet-toolbar login-hotbar">
        <span className="sheet-brand">
          <span className="sheet-mark">
            <Box />
          </span>
          <strong>TenderPro</strong>
        </span>
      </header>
      <div className="login-center">
        <section className="login-card">
          <span className="login-icon">
            <Box />
          </span>
          <h1>Увійти в TenderPro</h1>
          <p>Ваш робочий простір тендерів</p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              disabled={busy}
              aria-invalid={!!error}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />
            <label htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
              aria-invalid={!!error}
              onChange={() => setError("")}
            />
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="admin-button primary"
              disabled={busy}
            >
              {busy ? "Вхід…" : "Увійти"}
              <ArrowRight size={16} />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
