import { randomUUID } from "node:crypto";
import type { Tender } from "../demo-data.ts";
import type { AgentConfig } from "./contracts.ts";
import type { CrashRepository, CrashRecord } from "./crash-contracts.ts";
import { mergeCrashResult } from "./crash-merge.ts";
import type { TenderOrchestrator } from "./orchestrator.server.ts";
import type { PipelineSettings } from "./system-contracts.ts";
export class CrashService {
  private repository: CrashRepository;
  private orchestrator: TenderOrchestrator;
  constructor(repository: CrashRepository, orchestrator: TenderOrchestrator) {
    this.repository = repository;
    this.orchestrator = orchestrator;
  }
  async import(records: Tender[], accountId: string) {
    const at = new Date().toISOString(),
      batchId = randomUUID();
    const created: CrashRecord[] = records.map((t) => {
      const recordId = randomUUID();
      const provenance = Object.fromEntries(
        (t.sourceFields ?? []).map((field) => [
          field,
          { source: "import" as const },
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
  ) {
    for (const record of records) {
      const claimed = await this.repository.claim(record.recordId, rerun);
      if (!claimed) continue;
      try {
        const pipeline = await this.orchestrator.run(
          claimed.rawImportedData,
          configs,
          claimed.accountId,
          settings,
          undefined,
          undefined,
          {
            excelImport: true,
            ...(!rerun && claimed.pipeline ? { resume: claimed.pipeline } : {}),
          },
        );
        const merged = mergeCrashResult(claimed.rawImportedData, pipeline);
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
