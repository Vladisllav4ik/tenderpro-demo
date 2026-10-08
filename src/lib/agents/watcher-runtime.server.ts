import { TenderWatcherService } from "./watcher-service.server.ts";
import { Agent2PreparationService } from "./preparation.server.ts";
import { crashRepository } from "./crash-repository.server.ts";
import { agentRepository, appendLog } from "./config.server.ts";
import { usageJournal } from "./usage-journal.server.ts";
import { runningAgentAccounts } from "./execution-lock.server.ts";
import {
  executeDelta,
  buildDeltaInput,
  relevantDocumentText,
} from "./delta-analysis.server.ts";
import { LifecycleService } from "./agent-services.server.ts";
import { lifecycleInputFromTender } from "./system-contracts.ts";
import { allowsPaidDemoTest } from "./filter-test-contract.ts";
import { nextWatch } from "./watcher-model.server.ts";
const sink = async (log: import("./contracts.ts").AgentLog) => {
  await usageJournal.append(log);
  appendLog(log);
};
export function createWatcher() {
  return new TenderWatcherService(crashRepository, {
    prepare: (t, p) => new Agent2PreparationService().prepare(t, p),
    delta: async (input, record) => {
      if (!allowsPaidDemoTest(process.env["NODE_ENV"]))
        throw new Error(
          "Delta AI дозволений лише у локальному авторизованому середовищі.",
        );
      const config = agentRepository.list().find((c) => c.id === "detail")!;
      await usageJournal.prepare();
      const logs: import("./contracts.ts").AgentLog[] = [];
      const audit = async (log: import("./contracts.ts").AgentLog) => {
        logs.push(log);
        await sink(log);
      };
      const usage = () => ({
        calls: logs.length,
        tokens: logs.some((l) => l.totalTokens == null)
          ? null
          : logs.reduce((n, l) => n + (l.totalTokens ?? 0), 0),
      });
      const failure = (message: string) =>
        Object.assign(new Error(message), {
          aiCalls: usage().calls,
          tokensUsed: usage().tokens,
        });
      let r = await executeDelta(input, config, record.accountId, audit);
      if (!r.ok) throw failure(r.error);
      // At most one targeted reread; never repeat the entire tender analysis.
      const selected =
        record.preparation?.documents.filter(
          (d) =>
            r.ok &&
            d.parseStatus === "parsed" &&
            !!d.text &&
            r.result.rereadDocumentIds.includes(d.documentId) &&
            !input.documents.some(
              (x) => x.documentId === d.documentId && !x.truncated,
            ),
        ) ?? [];
      if (selected.length) {
        const reread = buildDeltaInput(
          record.finalMergedTender,
          {
            changed: true,
            structured: false,
            semantic: true,
            lifecycle: false,
            documents: selected.map((d) => d.documentId),
            removedDocuments: [],
            questions: [],
            answers: [],
            reasons: ["targeted document reread"],
          },
          [],
          selected,
        );
        reread.questions = input.questions;
        for (const fragment of reread.documents) {
          const source = selected.find(
            (d) => d.documentId === fragment.documentId,
          )!;
          fragment.after = relevantDocumentText(source.text, [
            ...input.questions.flatMap((q) => [
              q.title ?? "",
              q.question ?? "",
              q.answer ?? "",
            ]),
            ...Object.values(input.oldRelevantRequirements).flat(),
          ]);
          fragment.truncated = fragment.after.length < source.text.length;
        }
        const next = await executeDelta(
          reread,
          config,
          record.accountId,
          audit,
        );
        if (!next.ok) throw failure(next.error);
        r = {
          ...next,
          result: {
            changes: [...r.result.changes, ...next.result.changes],
            questions: [...r.result.questions, ...next.result.questions],
            rereadDocumentIds: [],
            affectedFields: [
              ...r.result.affectedFields,
              ...next.result.affectedFields,
            ],
            conclusionChanges: [
              ...r.result.conclusionChanges,
              ...next.result.conclusionChanges,
            ],
          },
        };
      }
      return { result: r.result, ...usage() };
    },
    lifecycle: async (t, record) => {
      const config = agentRepository.list().find((c) => c.id === "status")!;
      // Public structured status changes use deterministic Agent 4 rules.
      const input = lifecycleInputFromTender(t);
      input.events.push(
        ...(t.hierarchy?.lots ?? []).map(
          (l) => `Source lot ${l.id}: ${l.status ?? "-"}`,
        ),
      );
      input.events.push(`Prozorro status: ${t.prozorroStatus ?? "-"}`);
      const source = record.preparation?.rawProzorroData as Record<
        string,
        any
      > | null;
      for (const kind of ["awards", "qualifications", "cancellations"])
        input.events.push(
          ...(source?.[kind] ?? []).slice(0, 40).map((r: any) =>
            JSON.stringify({
              source: kind,
              id: r.id,
              status: r.status,
              lotId: r.lotID ?? r.relatedLot ?? null,
            }),
          ),
        );
      const r = await new LifecycleService().execute(
        input,
        { ...config, mode: "rule-based" },
        record.accountId,
        sink,
      );
      if (!r.ok) throw new Error(r.error);
      await sink({
        agentId: "status",
        at: new Date().toISOString(),
        processed: 1,
        errors: 0,
        estimatedUsage: 0,
        message: r.result.reason,
        accountId: record.accountId,
        mock: false,
        provider: "rule-based",
        tenderId: t.id,
        inputSnapshot: input as any,
        outputSnapshot: r.result as any,
        totalTokens: 0,
        status: "success",
      });
      return { result: r.result, tokens: 0, calls: 0 };
    },
  });
}
export async function checkImportedChanges(recordId?: string) {
  if (runningAgentAccounts.size)
    throw new Error("Дочекайтеся поточного pipeline.");
  runningAgentAccounts.add("watcher");
  try {
    const records = await crashRepository.list();
    const selected = recordId
      ? records.filter((r) => r.recordId === recordId)
      : records;
    if (recordId && !selected.length) throw new Error("Тендер не знайдено.");
    const results = [];
    for (const record of selected)
      results.push(await createWatcher().check(record.recordId));
    return results;
  } finally {
    runningAgentAccounts.delete("watcher");
  }
}
type WatchRuntime = {
  timer: ReturnType<typeof setInterval>;
  boot: number;
  busy: boolean;
};
const globalRuntime = globalThis as typeof globalThis & {
  tenderProWatcher?: WatchRuntime;
};
export function startTenderWatcher() {
  const previous = globalRuntime.tenderProWatcher;
  if (previous) clearInterval(previous.timer);
  const runtime: WatchRuntime = {
    boot: previous?.boot ?? Date.now(),
    busy: false,
    timer: setInterval(() => {
      void tick();
    }, 60000),
  };
  runtime.timer.unref?.();
  globalRuntime.tenderProWatcher = runtime;
  async function tick() {
    if (runtime.busy || runningAgentAccounts.size) return;
    runtime.busy = true;
    try {
      const records = await crashRepository.list();
      for (const r of records) {
        if (
          !r.watcher &&
          r.preparation?.rawProzorroData &&
          nextWatch(r.preparation.rawProzorroData as Record<string, any>) ===
            null
        )
          continue;
        const due = r.watcher
          ? r.watcher.nextCheckAt &&
            Date.parse(r.watcher.nextCheckAt) <= Date.now()
          : Date.now() - runtime.boot >= 3 * 3600000;
        if (due && !r.processing) await checkImportedChanges(r.recordId);
      }
    } catch {
      console.error(
        "TenderPro watcher: перевірка не завершена; див. ADMIN log.",
      );
    } finally {
      runtime.busy = false;
    }
  }
}
