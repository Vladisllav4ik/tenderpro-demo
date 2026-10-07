import { createFileRoute, redirect } from "@tanstack/react-router";
import { demoAccounts } from "@/lib/account";
import { login } from "@/lib/account-session";
import { useState } from "react";
export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.account) throw redirect({ to: "/tenders" });
  },
  component: Login,
});
function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center bg-muted">
      <section className="w-full max-w-md space-y-4 rounded-xl border bg-background p-8">
        <h1 className="text-2xl font-bold">TenderPro</h1>
        <p>Демо-вхід</p>
        <p className="text-sm text-muted-foreground">
          Акаунти і ролі для перевірки MVP. Це симуляція входу без реєстрації та
          паролів.
        </p>
        {demoAccounts.map((a) => (
          <button
            disabled={busy}
            className="block w-full rounded border p-3 text-left hover:bg-muted"
            key={a.id}
            onClick={async () => {
              setBusy(true);
              try {
                await login({ data: a.id });
                window.location.assign("/tenders");
              } catch {
                setError("Не вдалося увійти");
                setBusy(false);
              }
            }}
          >
            {a.name} · {a.role}
          </button>
        ))}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
