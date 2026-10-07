import { useState } from "react";
import { toast } from "sonner";
import { useDemo } from "@/lib/demo-store";
import type { AgentConfig, AgentId } from "@/lib/agents/contracts";
import type {
  PipelineRecord,
  PipelineSettings,
} from "@/lib/agents/system-contracts";
import {
  testAgentSystem,
  updatePipelineSettings,
  runDueStatusRecheck,
} from "@/lib/agents/client";
import type { RecheckJob } from "@/lib/agents/local-repositories.server";
const names = {
  collector: "Test Collector",
  filter: "Classifier Test",
  detail: "Analyzer Test",
  status: "Status Test",
};
export function PipelinePreview({ pipeline }: { pipeline: PipelineRecord }) {
  return (
    <div className="space-y-2 rounded border p-3" aria-live="polite">
      <p>
        <strong>{pipeline.currentStage}</strong> · {pipeline.status} · account{" "}
        {pipeline.accountId} · {pipeline.tenderId}
      </p>
      <p className="text-sm">
        Pipeline {pipeline.pipelineId} · input {pipeline.inputTokens} / output{" "}
        {pipeline.outputTokens} / total {pipeline.totalTokens} tokens
        {pipeline.unknownUsage ? " + невідоме usage" : ""} · cost:{" "}
        {pipeline.cost.amount ?? "не розраховано"}
      </p>
      <p className="text-xs">
        {pipeline.transitions.map((t) => t.state).join(" → ")}
      </p>
      {pipeline.thresholds && (
        <p className="text-xs">
          Thresholds цього запуску: autoAccept{" "}
          {pipeline.thresholds.autoAcceptThreshold} · review{" "}
          {pipeline.thresholds.reviewThreshold}
        </p>
      )}
      {pipeline.stages.map((s, i) => (
        <details key={`${s.agentId}:${i}`} open={s.status !== "success"}>
          <summary>
            {names[s.agentId]} · {s.status} · {s.provider ?? "—"}
            {s.reason ? ` · ${s.reason}` : ""}
          </summary>
          {s.result !== undefined && (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(s.result, null, 2)}
            </pre>
          )}
        </details>
      ))}
      <details>
        <summary>Audit / snapshots ({pipeline.runs.length})</summary>
        {pipeline.runs.map((l) => (
          <details key={l.id}>
            <summary className="text-sm">
              {l.agentName} · {l.provider} · {l.status} ·{" "}
              {l.totalTokens ?? "невідомо"} tokens · attempt {l.attempt ?? 1}
            </summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(l, null, 2)}
            </pre>
          </details>
        ))}
      </details>
    </div>
  );
}
export function AgentSystemTest({
  agentId,
  configs,
  savedConfigs,
  busy,
  setBusy,
  refresh,
  histories,
  pending,
  settings: initialSettings,
}: {
  agentId?: AgentId;
  configs: AgentConfig[];
  savedConfigs: AgentConfig[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  refresh: () => Promise<void>;
  histories?: PipelineRecord[];
  pending?: RecheckJob[];
  settings?: PipelineSettings;
}) {
  const { state, ready } = useDemo();
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<PipelineRecord | null>(null);
  const [settings, setSettings] = useState(
    initialSettings ?? { autoAcceptThreshold: 0.5, reviewThreshold: 0.3 },
  );
  const [error, setError] = useState("");
  const dirty = JSON.stringify(configs) !== JSON.stringify(savedConfigs);
  const config = agentId ? configs.find((c) => c.id === agentId) : undefined;
  const relevant =
    agentId === "detail"
      ? configs.filter((c) => ["filter", "detail"].includes(c.id))
      : agentId
        ? [config!]
        : configs;
  const potentiallyPaid = relevant.some(
    (c) =>
      c.enabled &&
      (c.id === "status"
        ? ["openai", "hybrid"].includes(c.mode ?? "")
        : c.provider === "openai"),
  );
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch {
      setError("Не вдалося виконати дію. Перевірте сервер та staging storage.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded border p-4">
      <h3 className="font-semibold">
        {agentId ? names[agentId] : "TEST PIPELINE ON 1 TENDER"}
      </h3>
      <p className="text-sm">
        {agentId === "detail"
          ? "Analyzer Test спочатку виконує Classifier і застосовує thresholds. "
          : ""}
        Тільки preview / staging. Режим:{" "}
        {config
          ? config.id === "collector"
            ? config.source
            : config.id === "status"
              ? config.mode
              : config.provider
          : "за збереженими конфігураціями"}
        .{" "}
        {potentiallyPaid
          ? "Можливі платні OpenAI запити до увімкнених AI-етапів; rules не витрачають tokens."
          : "Без платних API-запитів."}
      </p>
      {!agentId && (
        <div className="flex flex-wrap items-end gap-3">
          {(["autoAcceptThreshold", "reviewThreshold"] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                aria-label={key}
                className="ml-2 w-20 rounded border p-2"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={settings[key]}
                onChange={(e) =>
                  setSettings({ ...settings, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          <button
            className="rounded border px-3 py-2"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const saved = await updatePipelineSettings({ data: settings });
                setSettings(saved);
                toast.success("Draft thresholds збережено");
              })
            }
          >
            Зберегти thresholds
          </button>
        </div>
      )}
      <label className="block">
        Тендер
        <select
          aria-label={`Тендер для ${agentId ?? "pipeline"}`}
          value={selected}
          disabled={busy || !ready}
          className="mt-2 block w-full rounded border p-2"
          onChange={(e) => {
            setSelected(e.target.value);
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
      {dirty && (
        <p className="text-sm">Збережіть змінені конфігурації перед тестом.</p>
      )}
      <button
        className="rounded bg-primary px-4 py-2 text-primary-foreground"
        disabled={busy || !selected || dirty || !ready}
        onClick={() =>
          action(async () => {
            const tender = state.tenders.find((t) => t.id === selected);
            if (!tender) return;
            setPreview(null);
            const reply = await testAgentSystem({
              data: {
                tender,
                ...(agentId ? { agentId } : {}),
                configVersions: Object.fromEntries(
                  configs.map((c) => [c.id, c.version]),
                ) as Record<AgentId, number>,
              },
            });
            if (reply.ok) setPreview(reply.pipeline);
            else setError(reply.error);
          })
        }
      >
        {busy
          ? "Виконується…"
          : agentId
            ? names[agentId]
            : "TEST PIPELINE ON 1 TENDER"}
        {potentiallyPaid ? " · можливий OpenAI" : " · без OpenAI"}
      </button>
      {error && <p role="alert">{error}</p>}
      {preview && <PipelinePreview pipeline={preview} />}
      {!agentId && (
        <>
          <details>
            <summary>
              Pending lifecycle rechecks ({pending?.length ?? 0})
            </summary>
            <p className="text-sm">
              Повторна зміна контексту переносить один pending recheck на 3–5
              хвилин. Обробка запускається явно для одного дозрілого завдання;
              автоматичних платних викликів немає.
            </p>
            {(pending ?? []).map((j) => (
              <p key={j.jobKey} className="text-sm">
                {j.tenderId} · account {j.accountId} · revision {j.revision} ·
                statusRecheckAt {j.statusRecheckAt} ·{" "}
                {j.claimedAt ? "processing" : "pending"}
              </p>
            ))}
            <button
              className="mt-2 rounded border px-3 py-2"
              disabled={busy || dirty}
              onClick={() =>
                action(async () => {
                  const reply = await runDueStatusRecheck();
                  if (!reply.ok) setError(reply.error);
                  else if ("empty" in reply)
                    toast.info("Дозрілих rechecks немає");
                  else setPreview(reply.pipeline);
                })
              }
            >
              Обробити 1 дозрілий recheck
              {configs.find((c) => c.id === "status")?.mode === "hybrid" ||
              configs.find((c) => c.id === "status")?.mode === "openai"
                ? " · можливий AI fallback"
                : " · без OpenAI"}
            </button>
          </details>
          <details>
            <summary>Pipeline history ({histories?.length ?? 0})</summary>
            {(histories ?? []).map((p) => (
              <details key={p.pipelineId}>
                <summary>
                  {p.startedAt} · {p.tenderId} · {p.currentStage} ·{" "}
                  {p.totalTokens} tokens
                </summary>
                <PipelinePreview pipeline={p} />
              </details>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
