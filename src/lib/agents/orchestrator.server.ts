import { randomUUID } from "node:crypto";
import type { Tender } from "../demo-data.ts";
import type { AgentConfig, AgentId, AgentLog, JsonValue } from "./contracts.ts";
import {
  filterInputFromTender,
  filterInputSchema,
  filterResultSchema,
} from "./filter-test-contract.ts";
import { executeFilterTest } from "./filter-test.server.ts";
import {
  CollectorService,
  AnalyzerService,
  LifecycleService,
  type CollectorConnector,
} from "./agent-services.server.ts";
import {
  analyzerInputFromTender,
  lifecycleInputFromTender,
  pipelineSettingsSchema,
  defaultPipelineSettings,
  type LifecycleInput,
  type PipelineRecord,
  type PipelineSettings,
  type PipelineState,
} from "./system-contracts.ts";
import type { PipelineRepository } from "./local-repositories.server.ts";
import type { ResponseDependencies } from "./responses.server.ts";
import { sanitizeSnapshot } from "./snapshots.server.ts";
export type OrchestratorDependencies = {
  pipelines: PipelineRepository;
  record: (log: AgentLog) => Promise<void>;
  responses?: ResponseDependencies;
  connector?: CollectorConnector;
  now?: () => Date;
};
class AgentFailure extends Error {}
export class TenderOrchestrator {
  private dependencies: OrchestratorDependencies;
  constructor(dependencies: OrchestratorDependencies) {
    this.dependencies = dependencies;
  }
  async run(
    tender: Tender,
    configs: AgentConfig[],
    accountId: string,
    settings: PipelineSettings = defaultPipelineSettings,
    only?: AgentId,
    lifecycleInput?: LifecycleInput,
    options: {
      excelImport?: boolean;
      resume?: PipelineRecord;
      preparation?: import("./source-contracts.ts").Agent2Preparation;
      skipLifecycle?: boolean;
    } = {},
  ): Promise<PipelineRecord> {
    const now = this.dependencies.now ?? (() => new Date());
    const startedAt = now().toISOString();
    const p: PipelineRecord = {
      pipelineId: randomUUID(),
      accountId,
      tenderId: tender.id,
      startedAt,
      finishedAt: null,
      currentStage: "RAW",
      status: "running",
      transitions: [{ state: "RAW", at: startedAt }],
      stages: [],
      runs: [],
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      unknownUsage: false,
      cost: { amount: null, currency: "USD", pricingVersion: null },
      thresholds: structuredClone(settings),
    };
    const checkpoint = async (state: PipelineState) => {
      p.currentStage = state;
      p.transitions.push({ state, at: now().toISOString() });
      await this.dependencies.pipelines.save(p);
    };
    const config = (id: AgentId) => {
      const c = configs.find((v) => v.id === id);
      if (!c) throw new Error("Конфігурація агента недоступна.");
      return c;
    };
    const saveAudit = async (
      log: AgentLog,
      input: unknown,
      output: unknown,
    ) => {
      const safe = sanitizeSnapshot({
        ...log,
        pipelineId: p.pipelineId,
        agentName: config(log.agentId).name,
        startedAt: log.startedAt ?? log.at,
        finishedAt: log.finishedAt ?? now().toISOString(),
        error: log.errorMessage ?? null,
        requestId: log.requestId ?? null,
        responseId: log.responseId ?? null,
        inputSnapshot: input,
        outputSnapshot: output,
      }) as AgentLog;
      await this.dependencies.record(safe);
      p.runs.push(safe);
      p.inputTokens += safe.inputTokens ?? 0;
      p.outputTokens += safe.outputTokens ?? 0;
      p.totalTokens += safe.totalTokens ?? 0;
      if (safe.totalTokens == null) p.unknownUsage = true;
    };
    const stage = async (
      id: AgentId,
      input: unknown,
      work: (
        sink: (log: AgentLog) => Promise<void>,
      ) => Promise<{ result: unknown; provider: string }>,
    ) => {
      const c = config(id);
      const cached = options.resume?.stages.find(
        (s) => s.agentId === id && s.status === "success",
      );
      if (cached?.result !== undefined) {
        p.stages.push({ ...structuredClone(cached), cached: true });
        return cached.result;
      }
      const start = now();
      let recorded = false;
      const sink = async (log: AgentLog) => {
        recorded = true;
        await saveAudit(log, input, log.outputSnapshot ?? null);
      };
      try {
        if (!c.enabled) throw new Error(`${c.name}: агент вимкнено.`);
        const reply = await work(sink);
        if (!recorded)
          await saveAudit(
            {
              id: randomUUID(),
              runId: randomUUID(),
              agentId: id,
              accountId,
              at: start.toISOString(),
              provider: reply.provider as NonNullable<AgentLog["provider"]>,
              mock: reply.provider === "mock",
              model: reply.provider === "openai" ? c.model : reply.provider,
              promptVersion: c.promptVersion,
              durationMs: now().getTime() - start.getTime(),
              tenderId: tender.id,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              status: "success",
              processed: 1,
              errors: 0,
              estimatedUsage: 0,
              message: "Однотендерний staging-тест.",
            },
            input,
            reply.result,
          );
        p.stages.push({
          agentId: id,
          status: "success",
          result: sanitizeSnapshot(reply.result) as JsonValue,
          provider: reply.provider,
        });
        await this.dependencies.pipelines.save(p);
        return reply.result;
      } catch (error) {
        const reason =
          error instanceof AgentFailure
            ? error.message
            : recorded
              ? (p.runs.at(-1)?.errorMessage ??
                "Агент не повернув валідного результату.")
              : `${c.name}: агент вимкнено, дані недоступні або не відповідають схемі.`;
        if (!recorded)
          await saveAudit(
            {
              id: randomUUID(),
              runId: randomUUID(),
              agentId: id,
              accountId,
              at: start.toISOString(),
              provider:
                id === "collector"
                  ? (c.source ?? "mock")
                  : id === "status" && c.mode === "rule-based"
                    ? "rule-based"
                    : id === "status" &&
                        ["openai", "hybrid"].includes(c.mode ?? "")
                      ? "openai"
                      : (c.provider ?? "mock"),
              mock: c.provider !== "openai",
              model: c.model,
              promptVersion: c.promptVersion,
              tenderId: tender.id,
              durationMs: now().getTime() - start.getTime(),
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              status: "error",
              processed: 0,
              errors: 1,
              estimatedUsage: 0,
              message: reason,
              errorMessage: reason,
            },
            input,
            null,
          );
        p.stages.push({ agentId: id, status: "error", reason });
        throw new Error(reason);
      }
    };
    const lifecycle = () =>
      stage(
        "status",
        lifecycleInput ?? lifecycleInputFromTender(tender),
        async (sink) => {
          const r = await new LifecycleService().execute(
            lifecycleInput ?? lifecycleInputFromTender(tender),
            config("status"),
            accountId,
            sink,
            this.dependencies.responses,
            now(),
          );
          if (!r.ok) throw new AgentFailure(r.error);
          return r;
        },
      );
    const skip = (id: AgentId, reason: string) =>
      p.stages.push({ agentId: id, status: "skipped", reason });
    try {
      const thresholds = pipelineSettingsSchema.parse(settings);
      if (
        options.preparation &&
        (!options.preparation.flags.agent2Completed ||
          !options.preparation.flags.baseDataReady)
      )
        throw new AgentFailure(
          "Agent 2 preparation не завершено; Agent 3 заблоковано.",
        );
      filterInputSchema.parse(filterInputFromTender(tender));
      await this.dependencies.pipelines.save(p);
      if (only === "status") {
        await lifecycle();
        await checkpoint("MONITORING");
      } else {
        let baseTender = tender;
        let sourceMetadata: import("./system-contracts.ts").AnalyzerInput["metadata"] =
          {};
        if ((!only && !options.excelImport) || only === "collector") {
          const collected = await stage(
            "collector",
            {
              tenderId: tender.id,
              title: tender.title,
              buyer: tender.customer,
              amount: tender.totalAmount ?? tender.budget,
              cpv: tender.cpv ?? null,
              publicationDate: tender.publishedAt ?? null,
              submissionDeadline:
                tender.submissionPeriod?.end ?? tender.deadline ?? null,
              sourceUrl: tender.sourceUrl ?? null,
            },
            async () => ({
              result: await new CollectorService(
                config("collector"),
                this.dependencies.connector,
              ).execute(tender),
              provider: config("collector").source ?? "mock",
            }),
          );
          // Collector output owns base source facts; the orchestrator merges available document context.
          const c =
            collected as import("./system-contracts.ts").CollectedTender;
          sourceMetadata = {
            ...c.rawMetadata,
            source: c.source,
            sourceTenderId: c.sourceTenderId,
            currency: c.currency,
          };
          baseTender = {
            ...tender,
            id: c.tenderId,
            title: c.title,
            customer: c.buyer,
            cpv: c.cpv,
            totalAmount: c.amount ?? tender.totalAmount ?? tender.budget,
            ...(c.submissionDeadline
              ? {
                  submissionPeriod: {
                    ...tender.submissionPeriod,
                    end: c.submissionDeadline,
                  },
                }
              : {}),
            ...(c.sourceUrl ? { sourceUrl: c.sourceUrl } : {}),
            ...(c.publicationDate ? { publishedAt: c.publicationDate } : {}),
          };
          await checkpoint("COLLECTED");
        }
        if (options.excelImport) {
          skip(
            "collector",
            "Excel — попередньо відібрана вибірка. Collector не запускається.",
          );
          sourceMetadata = {
            ...(tender.rawImport?.cells ?? {}),
            currency: tender.currency ?? null,
            source: "import",
          };
        }
        if (only !== "collector") {
          await checkpoint("CLASSIFICATION_PENDING");
          const input = filterInputFromTender(baseTender);
          if (options.preparation) input.documentTexts = [];
          const classification = filterResultSchema.parse(
            await stage("filter", input, async (sink) => {
              const r = await executeFilterTest(
                input,
                config("filter"),
                accountId,
                sink,
                this.dependencies.responses,
              );
              if (!r.ok) throw new AgentFailure(r.error);
              return r;
            }),
          );
          if (classification.confidence < thresholds.autoAcceptThreshold) {
            p.status = "review";
            await checkpoint("NEEDS_REVIEW");
            skip(
              "detail",
              classification.confidence < thresholds.reviewThreshold
                ? "Confidence нижче reviewThreshold."
                : "Confidence між reviewThreshold та autoAcceptThreshold.",
            );
            skip(
              "status",
              "Pipeline потребує перегляду; lifecycle можна тестувати окремо.",
            );
          } else if (!classification.relevant) {
            p.status = "rejected";
            await checkpoint("REJECTED");
            skip("detail", "Classifier відхилив тендер.");
            skip("status", "Тендер відхилено.");
          } else {
            await checkpoint("CLASSIFIED");
            if (only !== "filter") {
              if (
                options.preparation &&
                (!options.preparation.flags.documentsFetched ||
                  (options.preparation.flags.documentsAvailable &&
                    !options.preparation.flags.documentsParsed))
              ) {
                p.status = "review";
                await checkpoint("NEEDS_REVIEW");
                skip(
                  "detail",
                  "Документи не отримано або жоден документ не прочитано; Agent 3 заблоковано.",
                );
                skip("status", "Очікуємо готову картку.");
              } else {
                await checkpoint("ANALYSIS_PENDING");
                const input = analyzerInputFromTender(
                  baseTender,
                  classification,
                );
                input.metadata = sourceMetadata;
                if (options.preparation) {
                  const raw = options.preparation.rawProzorroData as Record<
                    string,
                    unknown
                  > | null;
                  input.sourceData = raw
                    ? Object.fromEntries(
                        [
                          "id",
                          "tenderID",
                          "title",
                          "description",
                          "status",
                          "value",
                          "procuringEntity",
                          "tenderPeriod",
                          "auctionPeriod",
                          "items",
                          "lots",
                          "features",
                        ]
                          .filter((k) => raw[k] !== undefined)
                          .map((k) => [k, raw[k]]),
                      )
                    : {};
                  input.documentMetadata = options.preparation.documents.map(
                    (d) => ({
                      documentId: d.documentId,
                      name: d.name,
                      mimeType: d.mimeType,
                      sourceUrl: d.url,
                      parseStatus: d.parseStatus,
                      downloadStatus: d.downloadStatus,
                    }),
                  );
                }
                await stage("detail", input, async (sink) => {
                  const r = await new AnalyzerService().execute(
                    input,
                    config("detail"),
                    accountId,
                    sink,
                    this.dependencies.responses,
                  );
                  if (!r.ok) throw new AgentFailure(r.error);
                  return r;
                });
                await checkpoint("ANALYZED");
                await checkpoint("READY");
                if (!only && !options.skipLifecycle) {
                  await lifecycle();
                  await checkpoint("MONITORING");
                }
              }
            }
          }
        }
      }
      if (p.status === "running") p.status = "success";
    } catch {
      p.status = "error";
      await checkpoint("ERROR");
      for (const id of ["collector", "filter", "detail", "status"] as const)
        if (!p.stages.some((s) => s.agentId === id))
          skip(
            id,
            "Попередній етап завершився помилкою або окремий тест не потребує цього етапу.",
          );
    }
    p.finishedAt = now().toISOString();
    await this.dependencies.pipelines.save(p);
    return sanitizeSnapshot(p);
  }
}
