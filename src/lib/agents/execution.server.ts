import { requireAccount } from "../session.server";
import { agentRepository, agentLogs, appendLog } from "./config.server";
import { executePipeline } from "./pipeline";
import type { AgentConfig } from "./contracts";
import type { Tender } from "../demo-data";
import { executeFilterTest } from "./filter-test.server";
import { usageJournal } from "./usage-journal.server";
import type { FilterTestReply } from "./filter-test-contract";
import {
  filterTestRequestSchema,
  matchesTestConfiguration,
  allowsPaidDemoTest,
} from "./filter-test-contract";
const running = new Set<string>();
export async function adminState() {
  requireAccount(true);
  let persistentLogs: import("./contracts").AgentLog[] = [];
  let journalAvailable = true;
  try {
    persistentLogs = await usageJournal.list();
  } catch {
    journalAvailable = false;
  }
  const unique = new Map(
    [...agentLogs, ...persistentLogs].map((l) => [
      l.id ?? `${l.at}:${l.agentId}:${l.tenderId ?? ""}`,
      l,
    ]),
  );
  return {
    configs: agentRepository.list(),
    logs: [...unique.values()]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 200),
    journalAvailable,
  };
}
export async function runSingleFilterTest(
  input: unknown,
): Promise<FilterTestReply> {
  const account = requireAccount(true);
  const config = agentRepository.list().find((c) => c.id === "filter")!;
  const error = (code: string, message: string): FilterTestReply => ({
    ok: false,
    provider: config.provider ?? "mock",
    model: config.model,
    promptVersion: config.promptVersion,
    tenderId: "",
    requestMade: false,
    log: null,
    errorCode: code,
    error: message,
  });
  const parsed = filterTestRequestSchema.safeParse(input);
  if (!parsed.success)
    return error("input", "Некоректні дані тесту одного тендера.");
  if (!matchesTestConfiguration(parsed.data, config))
    return error(
      "config_changed",
      "Конфігурація змінилася. Оновіть сторінку і перевірте режим перед запуском.",
    );
  if (
    config.provider === "openai" &&
    !allowsPaidDemoTest(process.env["NODE_ENV"])
  )
    return error(
      "local_only",
      "Реальний AI тест доступний на локальному dev-сервері. Для публічного запуску спочатку потрібен закритий production ADMIN доступ.",
    );
  if (running.has(account.id))
    return error(
      "busy",
      "Тест Agent 2 уже виконується. Дочекайтеся результату.",
    );
  running.add(account.id);
  try {
    try {
      await usageJournal.prepare();
    } catch {
      return error(
        "storage",
        "Локальний журнал недоступний. Запит не відправлено.",
      );
    }
    return await executeFilterTest(
      parsed.data.input,
      config,
      account.id,
      async (log) => {
        appendLog(log);
        await usageJournal.append(log);
      },
    );
  } finally {
    running.delete(account.id);
  }
}
export function saveConfig(config: AgentConfig) {
  requireAccount(true);
  return agentRepository.save(config);
}
export function runPipeline(records: Tender[]) {
  const account = requireAccount();
  return executePipeline(
    records,
    agentRepository.list(),
    account.id,
    appendLog,
  );
}
