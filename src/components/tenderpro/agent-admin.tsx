import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Activity,
  Database,
  Filter,
  FileSearch,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAgentAdmin,
  updateAgentConfig,
  testFilterTender,
} from "@/lib/agents/client";
import type { AgentConfig, AgentLog } from "@/lib/agents/contracts";
import {
  agentModules,
  agentMode,
  agentDate,
  agentMetrics,
} from "@/lib/agent-presentation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AgentSystemTest } from "./agent-system-tests";
import { CrashTestPanel } from "./crash-test-panel";
import { useDemo } from "@/lib/demo-store";
import {
  filterInputFromTender,
  type FilterTestReply,
} from "@/lib/agents/filter-test-contract";
type AdminData = Awaited<ReturnType<typeof getAgentAdmin>>;
type Module = (typeof agentModules)[number];
const icons = [Database, Filter, FileSearch, Workflow];
function Status({ enabled }: { enabled: boolean }) {
  return (
    <span className={`agent-status ${enabled ? "enabled" : ""}`}>
      <i />
      {enabled ? "Активний" : "Вимкнено"}
    </span>
  );
}
function Metrics({ config, logs }: { config: AgentConfig; logs: AgentLog[] }) {
  const m = agentMetrics(logs, config.id);
  return (
    <dl className="agent-metrics">
      <div>
        <dt>Model</dt>
        <dd>{config.model}</dd>
      </div>
      <div>
        <dt>Mode</dt>
        <dd>{agentMode(config)}</dd>
      </div>
      <div>
        <dt>Last run</dt>
        <dd>{agentDate(m.lastRun)}</dd>
      </div>
      <div>
        <dt>Processed</dt>
        <dd>{m.processed}</dd>
      </div>
      <div>
        <dt>Errors</dt>
        <dd className={m.errors ? "agent-error" : ""}>{m.errors}</dd>
      </div>
      <div>
        <dt>Usage</dt>
        <dd>
          {m.tokens.toLocaleString("uk-UA")} tokens
          {m.unknownUsage ? " + невідоме usage" : ""}
        </dd>
      </div>
    </dl>
  );
}
export function AgentHome({ initial }: { initial: AdminData }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [showCrash, setShowCrash] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const refresh = async () => setData(await getAgentAdmin());
  return (
    <section className="admin-page">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">TECHNICAL CONTROL CENTER</p>
          <h1>AI Агенти</h1>
          <p>
            4 агенти · {data.configs.filter((c) => c.enabled).length} активні ·{" "}
            {data.logs.filter((l) => l.status === "error").length} помилок у
            журналі
          </p>
        </div>
        <Activity />
      </header>
      {!data.journalAvailable && (
        <p role="alert">Локальний журнал недоступний.</p>
      )}
      <div className="agent-grid">
        {agentModules.map((module, i) => {
          const c = data.configs.find((c) => c.id === module.id)!;
          const Icon = icons[i]!;
          return (
            <article className="agent-module" key={c.id}>
              <div className="agent-module-top">
                <span className="agent-icon">
                  <Icon />
                </span>
                <Status enabled={c.enabled} />
              </div>
              <h2>
                Agent {module.number} — {module.title}
              </h2>
              <p className="agent-subtitle">{module.subtitle}</p>
              <Metrics config={c} logs={data.logs} />
              <Link
                className="agent-open"
                to="/agents/$agentId"
                params={{ agentId: module.slug }}
              >
                Відкрити агента
                <ArrowUpRight size={16} />
              </Link>
            </article>
          );
        })}
      </div>
      <details
        className="admin-section"
        onToggle={(e) => setShowCrash(e.currentTarget.open)}
      >
        <summary>Crash test / Pipeline · імпортовані тендери</summary>
        <div className="admin-section-body">
          {showCrash && (
            <CrashTestPanel configs={data.configs} refresh={refresh} />
          )}
        </div>
      </details>
      <details
        className="admin-section"
        onToggle={(e) => setShowPipeline(e.currentTarget.open)}
      >
        <summary>Pipeline test · thresholds · history · rechecks</summary>
        <div className="admin-section-body">
          {showPipeline && (
            <AgentSystemTest
              configs={data.configs}
              savedConfigs={data.configs}
              busy={busy}
              setBusy={setBusy}
              refresh={refresh}
              histories={data.histories}
              pending={data.pendingRechecks}
              settings={data.pipelineSettings}
            />
          )}
        </div>
      </details>
    </section>
  );
}
export function AgentPage({
  initial,
  module,
}: {
  initial: AdminData;
  module: Module;
}) {
  const router = useRouter();
  const [configs, setConfigs] = useState(initial.configs);
  const [savedConfigs, setSavedConfigs] = useState(initial.configs);
  const [logs, setLogs] = useState(initial.logs);
  const [busy, setBusy] = useState(false);
  const c = configs.find((c) => c.id === module.id)!;
  const saved = savedConfigs.find((c) => c.id === module.id)!;
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);
  const edit = (change: Partial<AgentConfig>) =>
    setConfigs((values) =>
      values.map((v) => (v.id === c.id ? { ...v, ...change } : v)),
    );
  const refresh = async () => {
    const data = await getAgentAdmin();
    setLogs(data.logs);
  };
  async function save(config = c) {
    setBusy(true);
    try {
      const result = await updateAgentConfig({ data: config });
      edit(result);
      setSavedConfigs((values) =>
        values.map((v) => (v.id === result.id ? result : v)),
      );
      toast.success("Конфігурацію збережено");
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не вдалося зберегти");
    } finally {
      setBusy(false);
    }
  }
  const m = agentMetrics(logs, c.id);
  const actions = (
    <div className="admin-form-actions">
      <button
        className="admin-button primary"
        disabled={busy || !dirty}
        onClick={() => void save()}
      >
        {busy ? "Зберігаємо…" : "Зберегти зміни"}
      </button>
      <button
        className="admin-button"
        disabled={busy || !dirty}
        onClick={() => edit(saved)}
      >
        Скасувати зміни
      </button>
    </div>
  );
  return (
    <section className="admin-page">
      <Link className="admin-back" to="/agents">
        <ArrowLeft size={16} /> AI Агенти
      </Link>
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">AGENT {module.number}</p>
          <h1>
            Agent {module.number} — {module.title}
          </h1>
          <p>{module.subtitle}</p>
        </div>
        <div className="agent-header-status">
          <Status enabled={c.enabled} />
          <Switch
            aria-label="Активність агента"
            checked={c.enabled}
            disabled={busy || dirty}
            onCheckedChange={(enabled) => void save({ ...c, enabled })}
          />
        </div>
      </header>
      {dirty && (
        <p className="admin-unsaved">
          Є незбережені зміни. Збережіть або скасуйте їх перед тестом чи зміною
          активності.
        </p>
      )}
      <Tabs defaultValue="overview" className="admin-tabs">
        <TabsList aria-label="Розділи агента">
          {[
            ["overview", "Огляд"],
            ["prompt", "Prompt"],
            ["limits", "Ліміти"],
            ["test", "Тест"],
            ["logs", "Logs"],
          ].map(([id, label]) => (
            <TabsTrigger value={id!} key={id}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <section className="admin-panel">
            <h2>Операційний огляд</h2>
            <Metrics config={c} logs={logs} />
            <dl className="admin-overview">
              <div>
                <dt>Prompt version</dt>
                <dd>{c.promptVersion}</dd>
              </div>
              <div>
                <dt>Config version</dt>
                <dd>{c.version}</dd>
              </div>
              {m.documentsConsumed !== undefined && (
                <div>
                  <dt>Documents consumed · останній розбір</dt>
                  <dd>{m.documentsConsumed}</dd>
                </div>
              )}
            </dl>
          </section>
        </TabsContent>
        <TabsContent value="prompt">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <h2>System prompt</h2>
              <span>{c.promptVersion}</span>
            </div>
            <label className="admin-prompt-label">
              System prompt
              <textarea
                aria-label="System prompt"
                className="admin-prompt-editor"
                value={c.systemPrompt}
                disabled={busy}
                onChange={(e) => edit({ systemPrompt: e.target.value })}
              />
            </label>
            {actions}
          </section>
        </TabsContent>
        <TabsContent value="limits">
          <section className="admin-panel">
            <h2>Модель і режим</h2>
            <div className="admin-form-grid">
              <label>
                Модель
                <input
                  aria-label="Model"
                  value={c.model}
                  disabled={busy}
                  onChange={(e) => edit({ model: e.target.value })}
                />
              </label>
              <label>
                Режим
                <select
                  aria-label="Режим агента"
                  disabled={busy}
                  value={
                    c.id === "collector"
                      ? (c.source ?? "mock")
                      : c.id === "status"
                        ? (c.mode ?? "rule-based")
                        : (c.provider ?? "mock")
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (c.id === "collector")
                      edit({ source: v as NonNullable<AgentConfig["source"]> });
                    else if (c.id === "status")
                      edit({ mode: v as NonNullable<AgentConfig["mode"]> });
                    else
                      edit({
                        provider: v as NonNullable<AgentConfig["provider"]>,
                      });
                  }}
                >
                  {c.id === "collector" ? (
                    <>
                      <option value="mock">mock — fixture</option>
                      <option value="data-source">
                        data-source — потрібен connector
                      </option>
                    </>
                  ) : c.id === "status" ? (
                    <>
                      <option value="rule-based">rule-based — 0 tokens</option>
                      <option value="mock">mock — 0 tokens</option>
                      <option value="openai">
                        OpenAI — rules + AI evaluation
                      </option>
                      <option value="hybrid">
                        hybrid — rules → OpenAI fallback
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="mock">mock — без витрат API</option>
                      <option value="openai">OpenAI — реальний запит</option>
                    </>
                  )}
                </select>
              </label>
            </div>
            <h2>Ліміти виконання</h2>
            <div className="admin-form-grid">
              {(
                [
                  {
                    key: "maxTokens",
                    help: "Максимальна кількість tokens у відповіді.",
                  },
                  {
                    key: "timeout",
                    help: "Час очікування відповіді, секунди.",
                  },
                  { key: "retries", help: "Кількість повторних спроб." },
                  { key: "batchSize", help: "Розмір пакета обробки." },
                ] as const
              ).map(({ key, help }) => (
                <label key={key}>
                  {key}
                  <input
                    aria-label={key}
                    type="number"
                    disabled={busy}
                    value={c.limits[key]}
                    onChange={(e) =>
                      edit({
                        limits: { ...c.limits, [key]: Number(e.target.value) },
                      })
                    }
                  />
                  <small>{help}</small>
                </label>
              ))}
              {c.id === "status" && (
                <label>
                  Recheck delay (seconds)
                  <input
                    aria-label="Recheck delay"
                    type="number"
                    min={180}
                    max={300}
                    value={c.recheckDelaySeconds ?? 180}
                    disabled={busy}
                    onChange={(e) =>
                      edit({ recheckDelaySeconds: Number(e.target.value) })
                    }
                  />
                  <small>Затримка перевірки стану.</small>
                </label>
              )}
            </div>
            {actions}
          </section>
        </TabsContent>
        <TabsContent value="test">
          <section className="admin-panel">
            <h2>Тест агента</h2>
            <p className="admin-help">Тест не змінює дані тендера.</p>
            {c.id === "filter" ? (
              <FilterAgentTest
                config={c}
                saved={saved}
                busy={busy}
                setBusy={setBusy}
                refresh={refresh}
              />
            ) : (
              <AgentSystemTest
                agentId={c.id}
                configs={configs}
                savedConfigs={savedConfigs}
                busy={busy}
                setBusy={setBusy}
                refresh={refresh}
              />
            )}
          </section>
        </TabsContent>
        <TabsContent value="logs">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <h2>Журнал запусків</h2>
              <small>{m.entries.length} записів · останні доступні логи</small>
            </div>
            <AgentLogs entries={m.entries} />
          </section>
        </TabsContent>
      </Tabs>
    </section>
  );
}
function FilterAgentTest({
  config: c,
  saved,
  busy,
  setBusy,
  refresh,
}: {
  config: AgentConfig;
  saved: AgentConfig;
  busy: boolean;
  setBusy: (v: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const { state, ready } = useDemo();
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<FilterTestReply | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="agent-test">
      <p className="admin-help">
        {c.provider === "openai"
          ? "OpenAI — реальний запит до одного тендера."
          : "Mock — без платного API."}{" "}
        Зміни конфігурації потрібно зберегти перед тестом.
      </p>
      <label>
        Тендер
        <select
          aria-label="Тендер для тесту Agent 2"
          value={selected}
          disabled={busy || !ready}
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
      <button
        className="admin-button primary"
        disabled={
          busy ||
          !ready ||
          !selected ||
          !c.enabled ||
          JSON.stringify(c) !== JSON.stringify(saved)
        }
        onClick={async () => {
          const tender = state.tenders.find((t) => t.id === selected);
          if (!tender) return;
          setBusy(true);
          setPreview(null);
          setError("");
          try {
            setPreview(
              await testFilterTender({
                data: {
                  input: filterInputFromTender(tender),
                  provider: c.provider ?? "mock",
                  configVersion: c.version,
                },
              }),
            );
            try {
              await refresh();
            } catch {
              // Keep the existing safe test reply when only the log refresh fails.
            }
          } catch {
            setError(
              "Не вдалося виконати тест Agent 2. Перевірте вхід і з’єднання.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Виконується…"
          : `Запустити AI тест · ${c.provider === "openai" ? "OpenAI" : "Mock"}`}
      </button>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <div className="agent-test-result" aria-live="polite">
          <p>
            {preview.model} · {preview.promptVersion} · {preview.provider}
          </p>
          {preview.ok ? (
            <dl className="admin-overview">
              {Object.entries(preview.result).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p role="alert">{preview.error}</p>
          )}
          <p>
            {preview.requestMade
              ? "Виконано спробу HTTP-запиту до OpenAI."
              : "OpenAI request не відправлявся."}
          </p>
          {preview.log && (
            <p>
              {preview.log.durationMs} ms · {preview.log.totalTokens ?? "—"}{" "}
              tokens · {preview.log.requestId ?? "—"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function AgentLogs({ entries }: { entries: AgentLog[] }) {
  const [selected, setSelected] = useState<AgentLog | null>(null);
  return (
    <>
      <div className="agent-log-scroll">
        <table className="agent-log-table">
          <thead>
            <tr>
              {[
                "Дата/час",
                "Tender ID",
                "Status",
                "Duration",
                "Tokens",
                "Error",
              ].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((l, i) => (
              <tr
                key={l.id ?? `${l.at}-${i}`}
                tabIndex={0}
                role="button"
                aria-label={`Деталі запуску ${agentDate(l.at)} ${l.tenderId ?? ""}`}
                onClick={() => setSelected(l)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(l);
                  }
                }}
              >
                <td>{agentDate(l.at)}</td>
                <td>{l.tenderId ?? "—"}</td>
                <td>
                  <span
                    className={`agent-log-status ${l.status === "error" ? "error" : ""}`}
                  >
                    {l.status ?? "success"}
                  </span>
                </td>
                <td>{l.durationMs ?? "—"} ms</td>
                <td>{l.totalTokens ?? "—"}</td>
                <td className={l.errors ? "agent-error" : ""}>
                  {l.errorMessage ?? l.error ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && <p className="admin-help">Запусків ще немає.</p>}
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="agent-log-modal">
          <DialogHeader>
            <DialogTitle>Деталі запуску</DialogTitle>
            <DialogDescription>
              {selected?.tenderId ?? "Технічний запис"} ·{" "}
              {agentDate(selected?.at)}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <dl className="admin-overview">
                {[
                  ["Request type", selected.provider ?? "mock"],
                  ["Agent", selected.agentName ?? selected.agentId],
                  ["Model", selected.model ?? "—"],
                  [
                    "Token usage",
                    `${selected.inputTokens ?? "—"} input / ${selected.outputTokens ?? "—"} output / ${selected.totalTokens ?? "—"} total`,
                  ],
                  ["Response status", selected.status ?? "success"],
                  ["Error", selected.errorMessage ?? selected.error ?? "—"],
                  ["Request ID", selected.requestId ?? "—"],
                  ["Response ID", selected.responseId ?? "—"],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <h3>Response preview</h3>
              <pre className="agent-response-preview">
                {selected.outputSnapshot !== undefined
                  ? JSON.stringify(selected.outputSnapshot, null, 2).slice(
                      0,
                      2500,
                    )
                  : selected.message}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
