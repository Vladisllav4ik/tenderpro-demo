import type { CrashRecord, CrashRepository } from "./crash-contracts.ts";
import type { Agent2Preparation } from "./source-contracts.ts";
import type { Tender } from "../demo-data.ts";
import { normalizeProzorro } from "./prozorro.server.ts";
import {
  parseTenderHierarchy,
  verifyQuestionChanges,
} from "../tender-hierarchy.ts";
import {
  classifyChanges,
  fingerprints,
  mergeDocumentVersions,
  nextWatch,
  type ChangePlan,
} from "./watcher-model.server.ts";
import {
  buildDeltaInput,
  mergeDelta,
  type DeltaResult,
} from "./delta-analysis.server.ts";
import type { LifecycleResult } from "./system-contracts.ts";
export type WatchBranches = {
  prepare: (
    t: Tender,
    previous?: Agent2Preparation,
  ) => Promise<Agent2Preparation>;
  delta: (
    input: ReturnType<typeof buildDeltaInput>,
    record: CrashRecord,
  ) => Promise<{ result: DeltaResult; tokens: number | null; calls: number }>;
  lifecycle: (
    t: Tender,
    record: CrashRecord,
  ) => Promise<{
    result: LifecycleResult;
    tokens: number | null;
    calls: number;
  }>;
};
const sourceKeys = [
  "title",
  "officialTitle",
  "customer",
  "description",
  "budget",
  "expectedValue",
  "totalAmount",
  "currency",
  "vatIncluded",
  "cpv",
  "publishedAt",
  "submissionPeriod",
  "auctionPeriod",
  "deliveryPeriod",
  "address",
  "quantity",
  "unit",
  "unitPrice",
  "objects",
  "subject",
  "sourceUrl",
  "sourceUrlProzorro",
  "workspaceUrlZakupivli",
  "prozorroStatus",
  "sourceItems",
  "sourceLots",
  "documents",
  "hierarchy",
  "lifecycle",
] as const;
export function mergePreparedSource(
  record: CrashRecord,
  prep: Agent2Preparation,
): Tender {
  const source = normalizeProzorro(
    record.rawImportedData,
    prep.rawProzorroData as Record<string, any>,
  );
  source.documents = prep.tender.documents ?? [];
  source.hierarchy = verifyQuestionChanges(
    parseTenderHierarchy(
      prep.rawProzorroData as Record<string, any>,
      mergeDocumentVersions(
        record.finalMergedTender.hierarchy?.documentVersions ??
          mergeDocumentVersions([], record.preparation?.documents ?? []),
        prep.documents,
      ),
    ),
  );
  const final = structuredClone(record.finalMergedTender);
  for (const key of sourceKeys) {
    if (key === "lifecycle") {
      final.lifecycle = { ...final.lifecycle, ...source.lifecycle };
      continue;
    }
    if (source[key] !== undefined) Object.assign(final, { [key]: source[key] });
    else if (!(record.rawImportedData.sourceFields ?? []).includes(key))
      delete (final as any)[key];
  }
  final.provenance = { ...final.provenance, ...source.provenance };
  for (const q of final.hierarchy?.questions ?? []) {
    const prior = record.finalMergedTender.hierarchy?.questions.find(
      (p) =>
        p.id === q.id && p.question === q.question && p.answer === q.answer,
    );
    if (prior) {
      q.classification = prior.classification;
      q.impact = prior.impact;
    }
  }
  return final;
}
export class TenderWatcherService {
  private repository: CrashRepository;
  private branches: WatchBranches;
  constructor(repository: CrashRepository, branches: WatchBranches) {
    this.repository = repository;
    this.branches = branches;
  }
  async check(recordId: string, now = new Date()) {
    const record = await this.repository.claim(recordId, true);
    if (!record) return null;
    const at = now.toISOString();
    let current = record;
    try {
      const previous = record.preparation;
      const prep = await this.branches.prepare(
        record.rawImportedData,
        previous,
      );
      if (!prep.flags.baseDataReady || !prep.flags.documentsFetched)
        throw new Error(
          "Джерело або реєстр документів недоступні; попередні дані збережено.",
        );
      const data = prep.rawProzorroData as Record<string, any>,
        old = previous?.rawProzorroData as Record<string, any> | null;
      // Pre-upgrade cards did not pass Q&A to Agent 3: treat newly collected Q&A as delta once.
      const baseline = old
        ? {
            ...old,
            ...(!record.finalMergedTender.hierarchy ? { questions: [] } : {}),
          }
        : data;
      const plan = classifyChanges(
        baseline,
        data,
        previous?.documents ?? prep.documents,
        prep.documents,
      );
      let final = structuredClone(record.finalMergedTender);
      if (plan.changed || !final.hierarchy) {
        final = mergePreparedSource(record, prep);
      }
      const watcher = {
        lastCheckedAt: at,
        lastChangedAt: plan.changed
          ? at
          : (record.watcher?.lastChangedAt ?? null),
        nextCheckAt: nextWatch(data, now),
        changeDetected: plan.changed,
        fingerprints: fingerprints(data, prep.documents),
        plan,
        reason: plan.reasons,
        agent3Started: false,
        scope: [] as string[],
        tokensUsed: 0 as number | null,
        aiCalls: 0,
        error: null as string | null,
      };
      const events = historyEvents(plan, baseline, data, at);
      if (plan.documents.length || plan.removedDocuments.length) {
        for (const field of [
          "technicalRequirements",
          "qualificationRequirements",
          "specialRequirements",
          "risks",
        ] as const) {
          final[field] = (final[field] ?? []).filter((value) => {
            if ((record.rawImportedData.sourceFields ?? []).includes(field))
              return true;
            const proof = final.provenance?.[`${field}:${value}`];
            return (
              !proof ||
              proof.source !== "document" ||
              ![...plan.documents, ...plan.removedDocuments].includes(
                proof.sourceId ?? "",
              ) ||
              prep.documents.some(
                (d) => d.parseStatus === "parsed" && d.text.includes(value),
              )
            );
          });
        }
        // An old digest can include requirements invalidated by the new source version.
        if (final.aiSummary && final.aiSummary !== "-") final.aiSummary = "-";
      }
      final.history = [...(final.history ?? []), ...events];
      prep.tender = { ...prep.tender, hierarchy: final.hierarchy! };
      current = {
        ...record,
        preparation: prep,
        finalMergedTender: final,
        watcher,
        updatedAt: at,
        ...(plan.changed
          ? {
              sourceSnapshots: [
                ...(record.sourceSnapshots ??
                  (old
                    ? [
                        {
                          at: previous?.fetchedAt ?? record.createdAt,
                          data: old,
                        },
                      ]
                    : [])),
                { at, data },
              ],
            }
          : {}),
      };
      // Structured values reach the table before potentially slow analysis.
      await this.saveLive(current);
      if (plan.lifecycle) {
        const r = await this.branches.lifecycle(final, current);
        current.agent4Result = r.result;
        // Agent 4 cannot establish our victory/defeat from the public winner alone.
        const terminal = ["WON", "LOST", "DISQUALIFIED", "NOT_SUBMITTED"];
        if (
          !terminal.includes(r.result.status) ||
          (r.result.status === "WON" && final.lifecycle?.decision === "won") ||
          (r.result.status === "LOST" &&
            final.lifecycle?.decision === "lost") ||
          (r.result.status === "DISQUALIFIED" &&
            final.lifecycle?.state === "disqualified") ||
          (r.result.status === "NOT_SUBMITTED" &&
            final.lifecycle?.participation === "not-submitted")
        )
          final.status = r.result.status;
        watcher.aiCalls += r.calls;
        watcher.tokensUsed =
          watcher.tokensUsed === null || r.tokens === null
            ? null
            : watcher.tokensUsed + r.tokens;
      }
      await this.saveLive(current);
      if (plan.semantic) {
        const input = buildDeltaInput(
          final,
          plan,
          previous?.documents ?? [],
          prep.documents,
        );
        input.oldRelevantRequirements = {
          technicalRequirements:
            record.finalMergedTender.technicalRequirements ?? [],
          qualificationRequirements:
            record.finalMergedTender.qualificationRequirements ?? [],
          specialRequirements:
            record.finalMergedTender.specialRequirements ?? [],
        };
        if (
          plan.documents.length &&
          !input.documents.some((d) => d.parseStatus === "parsed" && d.after) &&
          !input.questions.length &&
          !plan.reasons.includes("structured subject/requirements changed")
        )
          throw new Error(
            "Змінений документ не прочитано; delta analysis очікує доступне джерело.",
          );
        watcher.scope = input.scope;
        watcher.agent3Started = true;
        if (!input.scope.length)
          watcher.scope = ["structured subject/requirements/complaints"];
        await this.saveLive(current);
        const r = await this.branches.delta(input, current);
        const merged = mergeDelta(final, r.result, prep.documents);
        final = merged.tender;
        current.finalMergedTender = final;
        current.mergeWarnings = [...current.mergeWarnings, ...merged.warnings];
        current.deltaResults = [
          ...(current.deltaResults ?? []),
          { at, input, result: r.result, tokens: r.tokens },
        ];
        watcher.tokensUsed = r.tokens;
        watcher.aiCalls += r.calls;
        final.history = [
          ...(final.history ?? []),
          {
            at,
            kind: "agent3.reanalysis",
            text: `Agent 3: delta analysis (${watcher.scope.join(", ")})`,
          },
        ];
      }
      current.processing = false;
      await this.saveLive(current);
      return current;
    } catch (error) {
      current.processing = false;
      if (!current.watcher)
        current.watcher = {
          lastCheckedAt: at,
          lastChangedAt: null,
          nextCheckAt: nextWatch(
            (record.preparation?.rawProzorroData ?? {}) as Record<string, any>,
            now,
          ),
          changeDetected: false,
          fingerprints: fingerprints(
            (record.preparation?.rawProzorroData ?? {}) as Record<string, any>,
            record.preparation?.documents ?? [],
          ),
          plan: null,
          reason: [],
          agent3Started: false,
          scope: [],
          tokensUsed: 0,
          aiCalls: 0,
          error: null,
        };
      current.watcher.lastCheckedAt = at;
      current.watcher.nextCheckAt = nextWatch(
        (current.preparation?.rawProzorroData ?? {}) as Record<string, any>,
        now,
      );
      if (
        current.watcher &&
        error &&
        typeof error === "object" &&
        "aiCalls" in error &&
        typeof error.aiCalls === "number"
      ) {
        current.watcher.aiCalls += error.aiCalls;
        if (
          "tokensUsed" in error &&
          (typeof error.tokensUsed === "number" || error.tokensUsed === null)
        )
          current.watcher.tokensUsed = error.tokensUsed;
      }
      if (current.watcher)
        current.watcher.error =
          error instanceof Error ? error.message : "Watcher не завершено.";
      current.finalMergedTender.history = [
        ...(current.finalMergedTender.history ?? []),
        {
          at,
          kind: "watcher.error",
          text: current.watcher.error ?? "Watcher не завершено.",
        },
      ];
      await this.saveLive(current);
      return current;
    }
  }
  private async saveLive(record: CrashRecord) {
    const live = (await this.repository.list()).find(
      (r) => r.recordId === record.recordId,
    );
    if (live)
      for (const key of ["comment", "commentText", "commentColor"] as const)
        if (live.finalMergedTender[key] !== undefined)
          Object.assign(record.finalMergedTender, {
            [key]: live.finalMergedTender[key],
          });
    if (!(await this.repository.save(record, record.revision)))
      throw new Error("Watcher revision conflict.");
  }
}
function historyEvents(
  plan: ChangePlan,
  old: Record<string, any>,
  fresh: Record<string, any>,
  at: string,
): NonNullable<Tender["history"]> {
  const events: NonNullable<Tender["history"]> = [];
  for (const id of plan.questions)
    events.push({
      at,
      kind: "question",
      text: `Нове/оновлене звернення: ${id}`,
    });
  for (const id of plan.answers)
    events.push({
      at,
      kind: "answer",
      text: `Отримано/оновлено відповідь: ${id}`,
    });
  for (const id of [...plan.documents, ...plan.removedDocuments])
    events.push({
      at,
      kind: "document.changed",
      text: `Змінено реєстр документа: ${id}`,
    });
  if (
    JSON.stringify(old["tenderPeriod"]) !==
    JSON.stringify(fresh["tenderPeriod"])
  )
    events.push({
      at,
      kind: "deadline.changed",
      text: "Оновлено період подання",
    });
  if (
    JSON.stringify([
      old["auctionPeriod"],
      (old["lots"] ?? []).map((l: any) => l.auctionPeriod),
    ]) !==
    JSON.stringify([
      fresh["auctionPeriod"],
      (fresh["lots"] ?? []).map((l: any) => l.auctionPeriod),
    ])
  )
    events.push({
      at,
      kind: "auction.changed",
      text: "Оновлено дати аукціонів",
    });
  if (plan.lifecycle)
    events.push({
      at,
      kind: "status.changed",
      text: `Оновлено lifecycle / статус джерела: ${fresh["status"]}`,
    });
  return events;
}
