import { requireAccount } from "../session.server";
import { agentRepository, agentLogs, appendLog } from "./config.server";
import { executePipeline } from "./pipeline";
import type { AgentConfig } from "./contracts";
import type { Tender } from "../demo-data";
import { executeFilterTest } from "./filter-test.server";
import { usageJournal } from "./usage-journal.server";
import {
  localAgentRepositories,
  recheckRepository,
} from "./local-repositories.server";
import { sanitizeSnapshot } from "./snapshots.server";
import { randomUUID } from "node:crypto";
import type { FilterTestReply } from "./filter-test-contract";
import {
  filterTestRequestSchema,
  matchesTestConfiguration,
  allowsPaidDemoTest,
} from "./filter-test-contract";
import { runningAgentAccounts as running } from "./execution-lock.server";
import {
  loadConfigurations,
  persistConfiguration,
} from "./configuration-storage.server";
export async function adminState() {
  requireAccount(true);
  await loadConfigurations();
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
    logs: sanitizeSnapshot(
      [...unique.values()]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 200),
    ),
    journalAvailable,
    histories: await localAgentRepositories.list().catch(() => []),
    pendingRechecks: await recheckRepository.list().catch(() => []),
    pipelineSettings: await localAgentRepositories.settings(),
  };
}
export async function runSingleFilterTest(
  input: unknown,
): Promise<FilterTestReply> {
  const account = requireAccount(true);
  await loadConfigurations();
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
    const startedAt = new Date();
    const reply = await executeFilterTest(
      parsed.data.input,
      config,
      account.id,
      async (log) => {
        appendLog(log);
        await usageJournal.append(log);
      },
    );
    if (!reply.log) {
      const log: import("./contracts").AgentLog = {
        id: randomUUID(),
        runId: randomUUID(),
        pipelineId: null,
        agentId: "filter",
        agentName: config.name,
        accountId: account.id,
        at: startedAt.toISOString(),
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        provider: reply.provider,
        model: reply.model,
        promptVersion: reply.promptVersion,
        tenderId: parsed.data.input.id,
        mock: reply.provider === "mock",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        status: "error",
        processed: 0,
        errors: 1,
        estimatedUsage: 0,
        error: reply.ok ? null : reply.error,
        errorMessage: reply.ok ? "Помилка тесту" : reply.error,
        message: reply.ok ? "Помилка тесту" : reply.error,
        inputSnapshot: sanitizeSnapshot(parsed.data.input),
        outputSnapshot: null,
        requestId: null,
        responseId: null,
      };
      try {
        const safeLog = sanitizeSnapshot(log);
        await usageJournal.append(safeLog);
        appendLog(safeLog);
        return { ...reply, log: safeLog };
      } catch {
        return error("storage", "Не вдалося записати журнал тесту.");
      }
    }
    return reply;
  } finally {
    running.delete(account.id);
  }
}
export async function saveConfig(config: AgentConfig) {
  requireAccount(true);
  return persistConfiguration(config);
}
export async function runPipeline(records: Tender[]) {
  const account = requireAccount();
  await loadConfigurations();
  return executePipeline(
    records,
    agentRepository.list(),
    account.id,
    appendLog,
  );
}
