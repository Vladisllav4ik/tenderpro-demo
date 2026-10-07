import { z } from "zod";
import { requireAccount } from "../session.server";
import type { Tender } from "../demo-data";
import { agentRepository, agentLogs, appendLog } from "./config.server";
import { loadConfigurations } from "./configuration-storage.server";
import { crashRepository } from "./crash-repository.server";
import { localAgentRepositories } from "./local-repositories.server";
import { usageJournal } from "./usage-journal.server";
import { CrashService } from "./crash-service.server";
import { TenderOrchestrator } from "./orchestrator.server";
import {
  filterInputFromTender,
  filterInputSchema,
  allowsPaidDemoTest,
} from "./filter-test-contract";
import {
  statusInputSchema,
  lifecycleInputFromTender,
} from "./system-contracts";
import { sanitizeSnapshot } from "./snapshots.server";
import { runningAgentAccounts } from "./execution-lock.server";
let initializing: Promise<void> | undefined;
export function initializeCrashStorage() {
  if (!initializing)
    initializing = (async () => {
      await loadConfigurations();
      if (!(await crashRepository.exists())) {
        await localAgentRepositories.clearRunHistory();
        await usageJournal.clear();
        agentLogs.splice(0);
        await crashRepository.clear();
      }
    })().catch(() => {
      initializing = undefined;
      throw new Error("Crash-test storage недоступний.");
    });
  return initializing;
}
const service = () =>
  new CrashService(
    crashRepository,
    new TenderOrchestrator({
      pipelines: localAgentRepositories,
      record: async (log) => {
        await usageJournal.append(log);
        appendLog(log);
      },
    }),
  );
function checkModes() {
  const configs = agentRepository.list();
  if (
    configs.some(
      (c) =>
        (c.enabled &&
          (c.id === "filter" || c.id === "detail") &&
          c.provider === "openai") ||
        (c.id === "status" &&
          c.enabled &&
          ["hybrid", "openai"].includes(c.mode ?? "")),
    ) &&
    !allowsPaidDemoTest(process.env["NODE_ENV"])
  )
    throw new Error(
      "Платний pipeline доступний на локальному dev-сервері; production потребує закритої авторизації.",
    );
  return configs;
}
export async function importedState() {
  const account = requireAccount();
  await initializeCrashStorage();
  return crashRepository.list(
    account.role === "ADMIN" ? undefined : account.id,
  );
}
export async function importAndRunCrash(raw: { tenders: Tender[] }) {
  const account = requireAccount();
  await initializeCrashStorage();
  if (runningAgentAccounts.size)
    throw new Error(
      "Pipeline вже виконується. Дочекайтеся завершення перед імпортом.",
    );
  const parsed = z
    .object({
      tenders: z
        .array(
          z
            .object({ id: z.string(), importSource: z.literal("excel") })
            .passthrough(),
        )
        .min(1)
        .max(10),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success || JSON.stringify(raw).length > 3000000)
    throw new Error("Імпортуйте 1–10 тендерів за один crash-test.");
  const configs = checkModes();
  const tenders = sanitizeSnapshot(raw.tenders);
  for (const t of tenders) {
    filterInputSchema.parse(filterInputFromTender(t));
    statusInputSchema.parse(lifecycleInputFromTender(t));
  }
  runningAgentAccounts.add(account.id);
  try {
    const existing = await crashRepository.list();
    const known = new Set(existing.map((r) => r.rawImportedData.id));
    const extra = new Set(
      tenders.filter((t) => !known.has(t.id)).map((t) => t.id),
    ).size;
    if (existing.length + extra > 10)
      throw new Error(
        "Ліміт crash-test — 10 активних тендерів. Очистіть попередню вибірку.",
      );
    await usageJournal.prepare();
    const added = await service().import(tenders, account.id);
    await service().run(
      added,
      configs,
      await localAgentRepositories.settings(),
    );
    return {
      imported: added.length,
      records: await crashRepository.list(
        account.role === "ADMIN" ? undefined : account.id,
      ),
    };
  } finally {
    runningAgentAccounts.delete(account.id);
  }
}
export async function rerunImportedCrash() {
  const account = requireAccount(true);
  await initializeCrashStorage();
  if (runningAgentAccounts.size)
    throw new Error("Дочекайтеся поточного pipeline.");
  const configs = checkModes();
  runningAgentAccounts.add(account.id);
  try {
    const records = await crashRepository.list();
    if (records.length > 10)
      throw new Error(
        "Crash-test підтримує максимум 10 активних тендерів. Очистіть попередню вибірку.",
      );
    await usageJournal.prepare();
    return await service().run(
      records,
      configs,
      await localAgentRepositories.settings(),
      true,
    );
  } finally {
    runningAgentAccounts.delete(account.id);
  }
}
export async function clearImportedCrash() {
  requireAccount(true);
  await initializeCrashStorage();
  if (runningAgentAccounts.size)
    throw new Error("Дочекайтеся pipeline перед очищенням.");
  runningAgentAccounts.add("crash-clear");
  try {
  const ids = new Set(
    (await crashRepository.list()).map((r) => r.rawImportedData.id),
  );
  await localAgentRepositories.removeTenderHistory(ids);
  await usageJournal.removeTenderIds(ids);
  for (let i = agentLogs.length - 1; i >= 0; i--)
    if (ids.has(agentLogs[i]!.tenderId ?? "")) agentLogs.splice(i, 1);
  return { cleared: await crashRepository.clear() };
  } finally{runningAgentAccounts.delete("crash-clear");}
}
export async function updateImportedComment(raw: unknown) {
  const account = requireAccount();
  await initializeCrashStorage();
  const parsed = z
    .object({
      id: z.string(),
      comment: z.string().max(30000).optional(),
      color: z
        .enum(["none", "yellow", "green", "red", "blue", "purple", "gray"])
        .optional(),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) throw new Error("Некоректний коментар.");
  const record = (
    await crashRepository.list(
      account.role === "ADMIN" ? undefined : account.id,
    )
  ).find((r) => r.rawImportedData.id === parsed.data.id);
  if (!record) return;
  const final = {
    ...record.finalMergedTender,
    ...(parsed.data.comment !== undefined
      ? { comment: parsed.data.comment, commentText: parsed.data.comment }
      : {}),
    ...(parsed.data.color !== undefined
      ? { commentColor: parsed.data.color }
      : {}),
  };
  await crashRepository.save(
    { ...record, finalMergedTender: sanitizeSnapshot(final) },
    record.revision,
  );
}
