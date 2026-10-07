import type { AgentConfig, AgentId, AgentLog } from "./agents/contracts.ts";
export const agentModules: {
  id: AgentId;
  slug: string;
  number: number;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "collector",
    slug: "agent-1",
    number: 1,
    title: "Збір",
    subtitle: "Джерела й базові дані тендерів",
  },
  {
    id: "filter",
    slug: "agent-2",
    number: 2,
    title: "Первинний фільтр",
    subtitle: "Релевантність і категоризація",
  },
  {
    id: "detail",
    slug: "agent-3",
    number: 3,
    title: "Детальний розбір",
    subtitle: "Документи й глибокий аналіз",
  },
  {
    id: "status",
    slug: "agent-4",
    number: 4,
    title: "Статуси",
    subtitle: "Життєвий цикл тендерів",
  },
];
export const agentMode = (c: AgentConfig) =>
  c.id === "collector"
    ? (c.source ?? "mock")
    : c.id === "status"
      ? (c.mode ?? "rule-based")
      : c.provider === "openai"
        ? "OpenAI"
        : "Mock";
export const agentDate = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("uk-UA", {
        timeZone: "Europe/Kyiv",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export function agentMetrics(logs: AgentLog[], id: AgentId) {
  const entries = logs
    .filter((l) => l.agentId === id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return {
    entries,
    lastRun: entries[0]?.at,
    processed: entries.reduce((n, l) => n + l.processed, 0),
    errors: entries.reduce((n, l) => n + l.errors, 0),
    tokens: entries.reduce((n, l) => n + (l.totalTokens ?? 0), 0),
    unknownUsage: entries.some((l) => l.totalTokens == null),
    documentsConsumed: entries
      .map((l) => l.inputSnapshot)
      .filter((v) => v && typeof v === "object" && !Array.isArray(v))
      .map((v) => (v as Record<string, unknown>)["documents"])
      .find(Array.isArray)?.length,
  };
}
