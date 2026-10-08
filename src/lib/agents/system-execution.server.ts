import { z } from "zod";
import { requireAccount } from "../session.server";
import type { Tender } from "../demo-data";
import { agentRepository, appendLog } from "./config.server";
import { usageJournal } from "./usage-journal.server";
import {
  localAgentRepositories,
  recheckRepository,
} from "./local-repositories.server";
import { TenderOrchestrator } from "./orchestrator.server";
import {
  filterInputFromTender,
  filterInputSchema,
  allowsPaidDemoTest,
} from "./filter-test-contract";
import {
  statusInputSchema,
  pipelineSettingsSchema,
  type AgentTestRequest,
  type PipelineSettings,
  type PipelineRecord,
} from "./system-contracts";
import { sanitizeSnapshot } from "./snapshots.server";
import { runningAgentAccounts as busy } from "./execution-lock.server";
import { loadConfigurations } from "./configuration-storage.server";
const requestSchema = z
  .object({
    tender: z.object({ id: z.string().min(1).max(150) }).passthrough(),
    agentId: z.enum(["collector", "filter", "detail", "status"]).optional(),
    configVersions: z
      .object({
        collector: z.number().int(),
        filter: z.number().int(),
        detail: z.number().int(),
        status: z.number().int(),
      })
      .strict(),
  })
  .strict();
export type SystemTestReply =
  { ok: true; pipeline: PipelineRecord } | { ok: false; error: string };
const orchestrator = () =>
  new TenderOrchestrator({
    pipelines: localAgentRepositories,
    record: async (log) => {
      await usageJournal.append(log);
      appendLog(log);
    },
  });
export async function runSystemTest(
  raw: AgentTestRequest,
): Promise<SystemTestReply> {
  const account = await requireAccount(true);
  await loadConfigurations();
  if (busy.has(account.id))
    return {
      ok: false,
      error: "Тест уже виконується. Дочекайтеся результату.",
    };
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success || JSON.stringify(raw).length > 500000)
    return { ok: false, error: "Некоректні або завеликі дані одного тендера." };
  const configs = agentRepository.list();
  if (configs.some((c) => parsed.data.configVersions[c.id] !== c.version))
    return {
      ok: false,
      error: "Конфігурація змінилася. Оновіть сторінку перед тестом.",
    };
  // Gate every stage that could incur cost, including Analyzer's Classifier prerequisite.
  const ids =
    raw.agentId === "collector"
      ? ["collector"]
      : raw.agentId === "status"
        ? ["status"]
        : raw.agentId === "filter"
          ? ["filter"]
          : raw.agentId === "detail"
            ? ["filter", "detail"]
            : ["collector", "filter", "detail", "status"];
  const paid = configs.some(
    (c) =>
      ids.includes(c.id) &&
      c.enabled &&
      (c.id === "status"
        ? ["openai", "hybrid"].includes(c.mode ?? "")
        : c.provider === "openai"),
  );
  if (paid && !allowsPaidDemoTest(process.env["NODE_ENV"]))
    return {
      ok: false,
      error:
        "Платні AI тести доступні лише локально, доки не підключено закритий production ADMIN доступ.",
    };
  busy.add(account.id);
  try {
    const tender = sanitizeSnapshot(raw.tender);
    filterInputSchema.parse(filterInputFromTender(tender));
    statusInputSchema.parse(
      (await import("./system-contracts")).lifecycleInputFromTender(tender),
    );
    await usageJournal.prepare();
    return {
      ok: true,
      pipeline: await orchestrator().run(
        tender,
        configs,
        account.id,
        await localAgentRepositories.settings(),
        raw.agentId,
      ),
    };
  } catch {
    return {
      ok: false,
      error:
        "Дані не відповідають схемі або staging/journal недоступні. Перевірте конфігурацію.",
    };
  } finally {
    busy.delete(account.id);
  }
}
export async function savePipelineSettings(input: PipelineSettings) {
  await requireAccount(true);
  const parsed = pipelineSettingsSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "Thresholds мають бути 0–1; reviewThreshold ≤ autoAcceptThreshold.",
    );
  try {
    return await localAgentRepositories.saveSettings(parsed.data);
  } catch {
    throw new Error("Не вдалося зберегти thresholds.");
  }
}
export async function scheduleStatusRecheck(raw: unknown) {
  const account = await requireAccount();
  await loadConfigurations();
  const parsed = statusInputSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false as const, error: "Некоректний lifecycle context." };
  try {
    const config = agentRepository.list().find((c) => c.id === "status")!;
    const job = await recheckRepository.schedule(
      account.id,
      sanitizeSnapshot(parsed.data),
      config.recheckDelaySeconds ?? 180,
    );
    return {
      ok: true as const,
      revision: job.revision,
      statusRecheckAt: job.statusRecheckAt,
    };
  } catch {
    return {
      ok: false as const,
      error: "Не вдалося поставити status recheck у чергу.",
    };
  }
}
// Explicit one-job driver: no background/bulk paid requests in this demo.
export async function processOneDueRecheck(): Promise<
  SystemTestReply | { ok: true; empty: true }
> {
  const account = await requireAccount(true);
  await loadConfigurations();
  if (busy.has(account.id))
    return { ok: false, error: "Дочекайтеся поточного тесту." };
  const configs = agentRepository.list();
  const status = configs.find((c) => c.id === "status")!;
  if (
    ["openai", "hybrid"].includes(status.mode ?? "") &&
    !allowsPaidDemoTest(process.env["NODE_ENV"])
  )
    return { ok: false, error: "AI fallback у публічному demo вимкнено." };
  busy.add(account.id);
  let job: Awaited<ReturnType<typeof recheckRepository.claimDue>> = null;
  try {
    await usageJournal.prepare();
    // ADMIN explicitly processes one due job, including director/USER contexts.
    job = await recheckRepository.claimDue();
    if (!job) return { ok: true, empty: true };
    const input = job.input;
    // Lifecycle only needs its validated DTO; no production Tender is fetched or overwritten.
    const t: Tender = {
      id: input.id,
      title: "Lifecycle recheck",
      customer: "Source context",
      budget: 0,
      category: "Інше",
      topCategory: "Інше",
      deadline: "",
      region: "",
      priority: "C",
      score: 0,
      status: input.currentStatus,
      manager: "",
      stage: "",
      recommendation: "",
    };
    const pipeline = await orchestrator().run(
      t,
      configs,
      job.accountId,
      await localAgentRepositories.settings(),
      "status",
      input,
    );
    if (pipeline.status === "error") {
      await recheckRepository.release(job);
      return { ok: true, pipeline };
    }
    const current = await recheckRepository.finish(job);
    if (!current) {
      pipeline.status = "review";
      pipeline.currentStage = "NEEDS_REVIEW";
      pipeline.stages.push({
        agentId: "status",
        status: "skipped",
        reason:
          "Контекст змінився під час оцінки. Результат застарів; новий recheck залишається pending.",
      });
      await localAgentRepositories.save(pipeline);
    }
    return { ok: true, pipeline };
  } catch {
    if (job) await recheckRepository.release(job).catch(() => {});
    return {
      ok: false,
      error: "Recheck не виконано: перевірте journal/staging.",
    };
  } finally {
    busy.delete(account.id);
  }
}
