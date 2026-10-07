import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  getAgentAdmin,
  updateAgentConfig,
  testFilterTender,
} from "@/lib/agents/client";
import type { AgentConfig } from "@/lib/agents/contracts";
import { useState } from "react";
import { useDemo } from "@/lib/demo-store";
import { toast } from "sonner";
import { AgentSystemTest } from "@/components/tenderpro/agent-system-tests";
import { CrashTestPanel } from "@/components/tenderpro/crash-test-panel";
import {
  filterInputFromTender,
  type FilterTestReply,
} from "@/lib/agents/filter-test-contract";
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
  const [savedConfigs, setSavedConfigs] = useState(initial.configs);
  const [histories, setHistories] = useState(initial.histories);
  const [pending, setPending] = useState(initial.pendingRechecks);
  async function refresh() {
    const data = await getAgentAdmin();
    setLogs(data.logs);
    setHistories(data.histories);
    setPending(data.pendingRechecks);
  }
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState<FilterTestReply | null>(null);
  const [savedFilter, setSavedFilter] = useState(
    initial.configs.find((c) => c.id === "filter"),
  );
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
        ADMIN · Collector → Classifier → Analyzer → Lifecycle. Collector: mock /
        data-source; Classifier і Analyzer: mock / OpenAI; Lifecycle: rules /
        mock / OpenAI / hybrid. Excel crash-test отримує Prozorro data і
        документи перед Analyzer; окремі тести агентів показують preview.
      </p>
      {!initial.journalAvailable && (
        <p role="alert">Локальний журнал недоступний.</p>
      )}
      <CrashTestPanel configs={configs} refresh={refresh} />
      <AgentSystemTest
        configs={configs}
        savedConfigs={savedConfigs}
        busy={busy}
        setBusy={setBusy}
        refresh={refresh}
        histories={histories}
        pending={pending}
        settings={initial.pipelineSettings}
      />
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
            {(c.id === "filter" || c.id === "detail") && (
              <label className="block">
                Режим{" "}
                <select
                  className="ml-3 rounded border p-2"
                  value={c.provider ?? "mock"}
                  disabled={busy}
                  onChange={(e) =>
                    edit(c.id, {
                      provider: e.target.value as "mock" | "openai",
                    })
                  }
                >
                  <option value="mock">mock — без витрат API</option>
                  <option value="openai">OpenAI — реальний запит</option>
                </select>
              </label>
            )}
            {c.id === "collector" && (
              <label className="block">
                Data source{" "}
                <select
                  className="ml-3 rounded border p-2"
                  value={c.source ?? "mock"}
                  onChange={(e) =>
                    edit(c.id, {
                      source: e.target.value as "mock" | "data-source",
                    })
                  }
                >
                  <option value="mock">mock — fixture</option>
                  <option value="data-source">
                    data-source — потрібен connector
                  </option>
                </select>
              </label>
            )}
            {c.id === "status" && (
              <div className="flex flex-wrap gap-3">
                <label>
                  Режим{" "}
                  <select
                    className="ml-3 rounded border p-2"
                    value={c.mode ?? "rule-based"}
                    onChange={(e) =>
                      edit(c.id, {
                        mode: e.target.value as NonNullable<
                          AgentConfig["mode"]
                        >,
                      })
                    }
                  >
                    <option value="rule-based">rule-based — 0 tokens</option>
                    <option value="mock">mock — 0 tokens</option>
                    <option value="openai">
                      OpenAI — rules + AI evaluation
                    </option>
                    <option value="hybrid">
                      hybrid — rules → OpenAI fallback
                    </option>
                  </select>
                </label>
                <label>
                  Recheck delay (seconds)
                  <input
                    className="ml-2 w-24 rounded border p-2"
                    aria-label="Recheck delay"
                    type="number"
                    min="180"
                    max="300"
                    value={c.recheckDelaySeconds ?? 180}
                    onChange={(e) =>
                      edit(c.id, {
                        recheckDelaySeconds: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            )}
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
                  setSavedConfigs((values) =>
                    values.map((value) =>
                      value.id === saved.id ? saved : value,
                    ),
                  );
                  if (c.id === "filter") {
                    setSavedFilter(saved);
                    setPreview(null);
                  }
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
            {c.id !== "filter" && (
              <AgentSystemTest
                agentId={c.id}
                configs={configs}
                savedConfigs={savedConfigs}
                busy={busy}
                setBusy={setBusy}
                refresh={refresh}
              />
            )}
            {c.id === "filter" && (
              <div className="space-y-3 rounded border p-4">
                <h3 className="font-semibold">Тест Agent 2 · один тендер</h3>
                <p className="text-sm">
                  Збережіть конфігурацію, виберіть існуючий тендер і натисніть
                  тест. Результат показується лише у preview; дані тендера не
                  змінюються. Реальні запити доступні на локальному dev-сервері;
                  демо-вхід не призначений для публічного доступу до платного
                  API.
                </p>
                <label className="block">
                  Тендер
                  <select
                    aria-label="Тендер для тесту Agent 2"
                    disabled={busy || !ready}
                    className="mt-2 block w-full rounded border p-2"
                    value={selectedId}
                    onChange={(e) => {
                      setSelectedId(e.target.value);
                      setPreview(null);
                    }}
                  >
                    <option value="">Виберіть тендер</option>
                    {state.tenders.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id} · {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                {JSON.stringify(c) !== JSON.stringify(savedFilter) && (
                  <p className="text-sm">
                    Спочатку збережіть змінені налаштування Agent 2.
                  </p>
                )}
                <button
                  className="rounded bg-primary px-4 py-2 text-primary-foreground"
                  disabled={
                    busy ||
                    !ready ||
                    !selectedId ||
                    !c.enabled ||
                    JSON.stringify(c) !== JSON.stringify(savedFilter)
                  }
                  onClick={async () => {
                    const tender = state.tenders.find(
                      (t) => t.id === selectedId,
                    );
                    if (!tender) return;
                    setBusy(true);
                    setPreview(null);
                    try {
                      const result = await testFilterTender({
                        data: {
                          input: filterInputFromTender(tender),
                          provider: c.provider ?? "mock",
                          configVersion: c.version,
                        },
                      });
                      setPreview(result);
                      if (result.log)
                        setLogs((old) => [
                          result.log!,
                          ...old.filter((l) => l.id !== result.log!.id),
                        ]);
                      try {
                        setLogs((await getAgentAdmin()).logs);
                      } catch {
                        /* The test reply already includes its safe technical record. */
                      }
                    } catch {
                      setPreview(null);
                      toast.error(
                        "Не вдалося виконати тест Agent 2. Перевірте вхід і з’єднання.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy
                    ? "Виконується…"
                    : c.provider === "openai"
                      ? "AI тест · OpenAI (1 тендер)"
                      : "AI тест · mock (1 тендер)"}
                </button>
                {preview && (
                  <div className="space-y-2" aria-live="polite">
                    <p className="text-sm">
                      Режим: {preview.provider} · Model: {preview.model} ·
                      Prompt: {preview.promptVersion}
                    </p>
                    {preview.ok ? (
                      <dl className="grid grid-cols-[110px_1fr] gap-2">
                        <dt>relevant</dt>
                        <dd>{String(preview.result.relevant)}</dd>
                        <dt>confidence</dt>
                        <dd>{preview.result.confidence}</dd>
                        <dt>category</dt>
                        <dd>{preview.result.category}</dd>
                        <dt>object</dt>
                        <dd>{preview.result.object}</dd>
                        <dt>reason</dt>
                        <dd>{preview.result.reason}</dd>
                      </dl>
                    ) : (
                      <p role="alert">{preview.error}</p>
                    )}
                    <p className="text-sm">
                      {preview.requestMade
                        ? "Виконано спробу HTTP-запиту до OpenAI."
                        : "OpenAI request не відправлявся."}
                    </p>
                    {preview.log && (
                      <p className="text-sm">
                        {preview.log.durationMs} ms · input:{" "}
                        {preview.log.inputTokens ?? "—"} · output:{" "}
                        {preview.log.outputTokens ?? "—"} · total:{" "}
                        {preview.log.totalTokens ?? "—"} · Request ID:{" "}
                        {preview.log.requestId ?? "—"} · Response ID:{" "}
                        {preview.log.responseId ?? "—"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <p>
              Last run: {entries[0]?.at ?? "—"} · Processed:{" "}
              {entries.reduce((n, l) => n + l.processed, 0)} · Errors:{" "}
              {entries.reduce((n, l) => n + l.errors, 0)} · Usage:{" "}
              {entries.reduce((n, l) => n + (l.totalTokens ?? 0), 0)} відомих
              tokens (останні 200 записів)
            </p>
            <details>
              <summary>Logs ({entries.length})</summary>
              {entries.map((l, i) => (
                <p key={i} className="text-sm">
                  {l.at} · {l.provider ?? "mock"} · {l.status ?? "success"} ·{" "}
                  {l.tenderId ?? `${l.processed} записів`} ·{" "}
                  {l.model ?? "deterministic-mock"} · {l.durationMs ?? "—"} ms ·
                  input {l.inputTokens ?? "—"} / output {l.outputTokens ?? "—"}{" "}
                  / total {l.totalTokens ?? "—"} · {l.message}
                  {l.requestId ? ` · ${l.requestId}` : ""}
                </p>
              ))}
            </details>
          </article>
        );
      })}
    </section>
  );
}
