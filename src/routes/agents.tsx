import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  getAgentAdmin,
  updateAgentConfig,
  processTenders,
} from "@/lib/agents/client";
import type { AgentConfig } from "@/lib/agents/contracts";
import { useState } from "react";
import { useDemo } from "@/lib/demo-store";
import { toast } from "sonner";
export const Route = createFileRoute("/agents")({
  beforeLoad: ({ context }) => {
    if (!context.account) throw redirect({ to: "/login" });
    if (context.account.role !== "ADMIN") throw redirect({ to: "/tenders" });
  },
  loader: () => getAgentAdmin(),
  component: AgentAdmin,
});
function AgentAdmin() {
  const initial = Route.useLoaderData();
  const [configs, setConfigs] = useState(initial.configs);
  const [logs, setLogs] = useState(initial.logs);
  const [busy, setBusy] = useState(false);
  const { state, ready } = useDemo();
  function edit(id: string, change: Partial<AgentConfig>) {
    setConfigs((values) =>
      values.map((c) => (c.id === id ? { ...c, ...change } : c)),
    );
  }
  return (
    <section className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">AI Агенти</h1>
      <p>
        ADMIN · Mock-сервіси. Промпти та моделі збережені як конфігурація
        майбутнього backend; mock виконує детерміновані правила. OpenAI та
        Prozorro не підключено. Конфігурації та журнали зберігаються в пам’яті
        demo-сервера до його перезапуску.
      </p>
      <button
        disabled={busy || !ready}
        className="rounded border px-4 py-2"
        onClick={async () => {
          setBusy(true);
          try {
            const result = await processTenders({
              data: state.tenders.slice(
                0,
                Math.min(
                  ...configs
                    .filter((c) => c.enabled)
                    .map((c) => c.limits.batchSize),
                  100,
                ),
              ),
            });
            setLogs((await getAgentAdmin()).logs);
            toast.success(
              `Тест pipeline: ${result.accepted} прийнято, ${result.rejected} відсіяно. Дані таблиці не змінено.`,
            );
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Помилка");
          } finally {
            setBusy(false);
          }
        }}
      >
        Тестовий запуск pipeline
      </button>
      {configs.map((c) => {
        const entries = logs.filter((l) => l.agentId === c.id);
        return (
          <article
            key={c.id}
            className="space-y-3 rounded-xl border bg-background p-5"
          >
            <h2 className="text-xl font-semibold">{c.name}</h2>
            <p>{c.description}</p>
            <p>
              Версія {c.version} · Prompt {c.promptVersion}
            </p>
            <label className="block">
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={(e) => edit(c.id, { enabled: e.target.checked })}
              />{" "}
              Увімкнено
            </label>
            <label className="block">
              Model
              <input
                className="ml-3 rounded border p-2"
                value={c.model}
                onChange={(e) => edit(c.id, { model: e.target.value })}
              />
            </label>
            <label className="block">
              System prompt
              <textarea
                className="mt-2 block min-h-32 w-full rounded border p-3"
                value={c.systemPrompt}
                onChange={(e) => edit(c.id, { systemPrompt: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-4">
              {(["maxTokens", "timeout", "retries", "batchSize"] as const).map(
                (key) => (
                  <label key={key}>
                    {key}
                    <input
                      type="number"
                      className="ml-2 w-24 rounded border p-2"
                      value={c.limits[key]}
                      onChange={(e) =>
                        edit(c.id, {
                          limits: {
                            ...c.limits,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ),
              )}
            </div>
            <button
              disabled={busy}
              className="rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={async () => {
                setBusy(true);
                try {
                  const saved = await updateAgentConfig({ data: c });
                  edit(c.id, saved);
                  toast.success("Конфігурацію збережено");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Помилка");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Зберегти {c.name}
            </button>
            <p>
              Last run: {entries[0]?.at ?? "—"} · Processed:{" "}
              {entries.reduce((n, l) => n + l.processed, 0)} · Errors:{" "}
              {entries.reduce((n, l) => n + l.errors, 0)} · Usage: 0 tokens
              (mock)
            </p>
            <details>
              <summary>Logs ({entries.length})</summary>
              {entries.map((l, i) => (
                <p key={i} className="text-sm">
                  {l.at} · {l.processed} · {l.message}
                </p>
              ))}
            </details>
          </article>
        );
      })}
    </section>
  );
}
