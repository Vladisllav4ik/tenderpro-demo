import { randomUUID } from "node:crypto";
import type { Tender } from "../demo-data.ts";
import type { AgentConfig } from "./contracts.ts";
import type { CrashRepository, CrashRecord } from "./crash-contracts.ts";
import { mergeCrashResult } from "./crash-merge.ts";
import type { TenderOrchestrator } from "./orchestrator.server.ts";
import type { PipelineSettings } from "./system-contracts.ts";
import type { SourcePreparationService } from "./source-contracts.ts";
import { fingerprints, nextWatch } from "./watcher-model.server.ts";
export class CrashService {
  private repository: CrashRepository;
  private orchestrator: TenderOrchestrator;
  private preparation: SourcePreparationService | undefined;
  constructor(
    repository: CrashRepository,
    orchestrator: TenderOrchestrator,
    preparation?: SourcePreparationService,
  ) {
    this.repository = repository;
    this.orchestrator = orchestrator;
    this.preparation = preparation;
  }
  async import(records: Tender[], accountId: string) {
    const at = new Date().toISOString(),
      batchId = randomUUID();
    const created: CrashRecord[] = records.map((t) => {
      const recordId = randomUUID();
      const provenance = Object.fromEntries(
        (t.sourceFields ?? []).map((field) => [
          field,
          { source: "import" as const, sourceType: "import" as const },
        ]),
      );
      const raw = {
        ...structuredClone(t),
        provenance,
        importSource: "excel" as const,
        crashRecordId: recordId,
      };
      return {
        recordId,
        batchId,
        accountId,
        createdAt: at,
        updatedAt: at,
        rawImportedData: raw,
        agent2Result: null,
        agent3Result: null,
        agent4Result: null,
        finalMergedTender: raw,
        pipeline: null,
        mergeWarnings: [],
        processing: false,
        revision: 0,
      };
    });
    return this.repository.insert(created);
  }
  async run(
    records: CrashRecord[],
    configs: AgentConfig[],
    settings: PipelineSettings,
    rerun = false,
    skipLifecycle = false,
  ) {
    for (const record of records) {
      const claimed = await this.repository.claim(record.recordId, rerun);
      if (!claimed) continue;
      try {
        // Only raw import/source/documents may seed a rerun, never prior AI outputs.
        const preparation = this.preparation
          ? await this.preparation.prepare(
              claimed.rawImportedData,
              claimed.preparation,
            )
          : undefined;
        if (preparation) {
          claimed.preparation = preparation;
          await this.repository.save(claimed, claimed.revision);
        }
        const base = preparation?.tender ?? claimed.rawImportedData;
        const pipeline = await this.orchestrator.run(
          base,
          configs,
          claimed.accountId,
          settings,
          undefined,
          undefined,
          {
            excelImport: true,
            ...(preparation ? { preparation } : {}),
            skipLifecycle,
            ...(!rerun && !preparation && claimed.pipeline
              ? { resume: claimed.pipeline }
              : {}),
          },
        );
        const merged = mergeCrashResult(base, pipeline);
        if (skipLifecycle) {
          merged.agent4Result = claimed.agent4Result;
          merged.finalMergedTender.status = claimed.finalMergedTender.status;
        }
        const input = pipeline.runs.find((r) => r.agentId === "detail")
          ?.inputSnapshot as any;
        claimed.agent3Debug = {
          started: pipeline.stages.some(
            (s) => s.agentId === "detail" && s.status !== "skipped",
          ),
          documentsConsumed: input?.documents?.length ?? 0,
          extractedFieldsCount: merged.agent3Result
            ? Object.values(merged.agent3Result).filter(
                (v) =>
                  v !== null &&
                  v !== "-" &&
                  (!Array.isArray(v) || v.length > 0),
              ).length
            : 0,
          errors: pipeline.stages
            .filter((s) => s.agentId === "detail" && s.status === "error")
            .map((s) => s.reason ?? "Analysis failed"),
        };
        // Preserve comments/colors edited while the request was running; source facts stay immutable.
        const live = (await this.repository.list()).find(
          (r) => r.recordId === claimed.recordId,
        );
        if (live) {
          for (const key of ["comment", "commentText", "commentColor"] as const)
            if (live.finalMergedTender[key] !== undefined)
              Object.assign(merged.finalMergedTender, {
                [key]: live.finalMergedTender[key],
              });
        }
        await this.repository.save(
          {
            ...claimed,
            ...merged,
            pipeline,
            ...(preparation?.rawProzorroData
              ? {
                  watcher: {
                    lastCheckedAt: preparation.fetchedAt,
                    lastChangedAt: claimed.watcher?.lastChangedAt ?? null,
                    nextCheckAt: nextWatch(
                      preparation.rawProzorroData as Record<string, any>,
                    ),
                    changeDetected: false,
                    fingerprints: fingerprints(
                      preparation.rawProzorroData as Record<string, any>,
                      preparation.documents,
                    ),
                    plan: null,
                    reason: [],
                    agent3Started: false,
                    scope: [],
                    tokensUsed: 0,
                    aiCalls: 0,
                    error: null,
                  },
                }
              : {}),
            processing: false,
            updatedAt: new Date().toISOString(),
          },
          claimed.revision,
        );
      } catch {
        await this.repository.save(
          {
            ...claimed,
            processing: false,
            updatedAt: new Date().toISOString(),
            mergeWarnings: [
              ...claimed.mergeWarnings,
              "Pipeline не завершено: перевірте конфігурацію та журнал.",
            ],
          },
          claimed.revision,
        );
      }
    }
    return this.repository.list();
  }
}
