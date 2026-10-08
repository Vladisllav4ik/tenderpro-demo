import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getImportedCrash,
  rerunCrashTenders,
  clearCrashTenders,
  rerunPreparedTender,
  checkTenderChanges,
} from "@/lib/agents/client";
import type { CrashRecord } from "@/lib/agents/crash-contracts";
import type { AgentConfig } from "@/lib/agents/contracts";
import { useDemo } from "@/lib/demo-store";
import { aggregateHierarchy } from "@/lib/tender-hierarchy";
export function CrashTestPanel({
  configs,
  refresh,
}: {
  configs: AgentConfig[];
  refresh: () => Promise<void>;
}) {
  const [records, setRecords] = useState<CrashRecord[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { refreshTenders } = useDemo();
  const processing = records.some((r) => r.processing);
  const read = async () => {
    setRecords(await getImportedCrash());
  };
  useEffect(() => {
    let active = true;
    const check = () =>
      getImportedCrash()
        .then((r) => {
          if (active) setRecords(r);
        })
        .catch(() => {
          if (active) setError("Crash-test storage недоступний.");
        });
    void check();
    // Source snapshots contain document text; avoid polling megabytes while idle.
    const timer = setInterval(check, processing ? 2500 : 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [processing]);
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await read();
      await refreshTenders();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crash-test не завершено.");
    } finally {
      setBusy(false);
    }
  }
  const last = records
    .map((r) => r.pipeline?.finishedAt ?? r.updatedAt)
    .sort()
    .at(-1);
  return (
    <section
      className="space-y-3 rounded-xl border bg-background p-5"
      aria-label="Crash test / Pipeline"
    >
      <h2 className="text-xl font-semibold">Crash test / Pipeline</h2>
      <p>
        Імпортовано: <strong>{records.length}</strong> / 10 · pipeline state:{" "}
        {processing
          ? "RUNNING"
          : records.some((r) => r.pipeline?.status === "error")
            ? "ERROR"
            : records.length
              ? "COMPLETED"
              : "EMPTY"}{" "}
        · last run: {last ?? "—"}
      </p>
      <p className="text-sm">
        Excel → Agent 2 → Agent 3 → Agent 4 автоматично. Collector не
        запускається. Raw, результати та final зберігаються окремо; заповнені
        поля Excel захищені.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["filter", "detail", "status"] as const).map((id, i) => (
          <p key={id}>
            Agent {i + 2}: processed{" "}
            {
              records.filter((r) =>
                r.pipeline?.stages.some(
                  (s) => s.agentId === id && s.status === "success",
                ),
              ).length
            }{" "}
            / errors{" "}
            {
              records.filter((r) =>
                r.pipeline?.stages.some(
                  (s) => s.agentId === id && s.status === "error",
                ),
              ).length
            }
            <br />
            <small>
              Режим:{" "}
              {id === "status"
                ? configs.find((c) => c.id === id)?.mode
                : configs.find((c) => c.id === id)?.provider}
            </small>
          </p>
        ))}
      </div>
      <p className="text-sm">
        OpenAI режими виконують платні запити. Mock перевіряє транспорт даних,
        його synthetic AI conclusions не застосовуються до final.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy || processing || !records.length}
          className="rounded bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => action(() => rerunCrashTenders())}
        >
          Повторити pipeline для всіх crash-test тендерів
        </button>
        <button
          disabled={busy || processing || !records.length}
          className="rounded border px-4 py-2"
          onClick={() =>
            action(async () => {
              const r = await clearCrashTenders();
              toast.success(
                `Очищено ${r.cleared} імпортованих тендерів; конфігурації агентів збережено.`,
              );
            })
          }
        >
          Очистити тестові тендери
        </button>
        <button
          disabled={busy}
          className="rounded border px-4 py-2"
          onClick={() => action(read)}
        >
          Оновити
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="text-sm">
        Короткий log: {records.filter((r) => r.pipeline).length} завершених
        спроб · {records.filter((r) => !r.pipeline && !r.processing).length} raw
        / pending ·{" "}
        {records.reduce((n, r) => n + (r.pipeline?.totalTokens ?? 0), 0)} tokens
        останніх запусків.
      </p>
      {records.map((r) => (
        <details key={r.recordId} className="rounded border p-3">
          <summary>
            {r.rawImportedData.id} ·{" "}
            {r.processing ? "RUNNING" : (r.pipeline?.currentStage ?? "RAW")} ·{" "}
            {r.rawImportedData.rawImport?.fileName ?? "—"} / рядок{" "}
            {r.rawImportedData.rawImport?.row ?? "—"}
          </summary>
          <button
            className="my-2 rounded border px-3 py-2"
            disabled={busy || processing}
            onClick={() =>
              action(() =>
                rerunPreparedTender({ data: { recordId: r.recordId } }),
              )
            }
          >
            Повторити Agent 2 → Agent 3
          </button>
          <button
            className="my-2 ml-2 rounded border px-3 py-2"
            disabled={busy || processing}
            onClick={() =>
              action(() =>
                checkTenderChanges({ data: { recordId: r.recordId } }),
              )
            }
          >
            Перевірити зміни зараз
          </button>
          <details open>
            <summary>Watcher / Lots / Questions / Reanalysis</summary>
            <p className="text-sm">
              Last check: {r.watcher?.lastCheckedAt ?? "-"} · Next:{" "}
              {r.watcher?.nextCheckAt ?? "off / pending"} · Change detected:{" "}
              {String(r.watcher?.changeDetected ?? false)}
            </p>
            <p className="text-sm">
              Lots: {r.finalMergedTender.hierarchy?.lots.length ?? 0} · Auction
              dates: {aggregateHierarchy(r.finalMergedTender).auctions.length} ·
              Differing fields:{" "}
              {aggregateHierarchy(r.finalMergedTender).differingFields.join(
                ", ",
              ) || "-"}
            </p>
            <p className="text-sm">
              Questions: {r.finalMergedTender.hierarchy?.questions.length ?? 0}{" "}
              · Answered:{" "}
              {r.finalMergedTender.hierarchy?.questions.filter((q) => q.answer)
                .length ?? 0}{" "}
              · Semantic changes: {String(r.watcher?.plan?.semantic ?? false)}
            </p>
            <p className="text-sm">
              Agent 3 started: {String(r.watcher?.agent3Started ?? false)} ·
              Tokens: {r.watcher?.tokensUsed ?? "-"} · AI calls:{" "}
              {r.watcher?.aiCalls ?? 0} · Reason:{" "}
              {r.watcher?.reason.join(", ") || "-"} · Scope:{" "}
              {r.watcher?.scope.join(", ") || "-"}
            </p>
            {r.watcher?.error && <p role="alert">{r.watcher.error}</p>}
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(r.watcher?.fingerprints ?? null, null, 2)}
            </pre>
          </details>
          <p className="text-sm">
            Agent 2: Prozorro fetched{" "}
            {r.preparation?.prozorroFetched ? "yes" : "no"} · base fields{" "}
            {r.preparation?.baseFieldsCount ?? 0} · documents found{" "}
            {r.preparation?.documents.length ?? 0} / downloaded{" "}
            {r.preparation?.documents.filter(
              (d) => d.downloadStatus === "downloaded",
            ).length ?? 0}{" "}
            / parsed{" "}
            {r.preparation?.documents.filter((d) => d.parseStatus === "parsed")
              .length ?? 0}
          </p>
          <p className="text-sm">
            Flags: baseDataReady{" "}
            {String(r.preparation?.flags.baseDataReady ?? false)} ·
            documentsFetched{" "}
            {String(r.preparation?.flags.documentsFetched ?? false)} ·
            documentsParsed{" "}
            {String(r.preparation?.flags.documentsParsed ?? false)} ·
            documentsAvailable{" "}
            {String(r.preparation?.flags.documentsAvailable ?? "unknown")} ·
            agent2Completed{" "}
            {String(r.preparation?.flags.agent2Completed ?? false)}
          </p>
          <p className="text-sm">
            Agent 3: started {r.agent3Debug?.started ? "yes" : "no"} · documents
            consumed {r.agent3Debug?.documentsConsumed ?? 0} · extracted fields{" "}
            {r.agent3Debug?.extractedFieldsCount ?? 0}
          </p>
          <p className="text-sm">
            Agent 4: {r.agent4Result?.status ?? "—"} ·{" "}
            {r.agent4Result?.reason ?? "—"}
          </p>
          {[
            ...(r.preparation?.errors ?? []),
            ...(r.agent3Debug?.errors ?? []),
          ].map((e, i) => (
            <p key={i} className="text-sm">
              {e}
            </p>
          ))}
          <details>
            <summary>Raw Prozorro / document registry</summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(
                {
                  rawProzorroData: r.preparation?.rawProzorroData ?? null,
                  documents: r.preparation?.documents ?? [],
                },
                null,
                2,
              )}
            </pre>
          </details>
          {r.pipeline?.stages.map((s) => (
            <p key={s.agentId} className="text-sm">
              {s.agentId} · {s.status} ·{" "}
              {s.cached ? "cached" : (s.provider ?? "—")}
              {s.reason ? ` · ${s.reason}` : ""}
            </p>
          ))}
          {r.mergeWarnings.length > 0 && (
            <details>
              <summary>Merge guard ({r.mergeWarnings.length})</summary>
              {r.mergeWarnings.map((w, i) => (
                <p key={i} className="text-sm">
                  {w}
                </p>
              ))}
            </details>
          )}
          {(
            [
              ["Raw imported data", r.rawImportedData],
              ["Agent 2 result", r.agent2Result],
              ["Agent 3 result", r.agent3Result],
              ["Agent 3 delta results / input", r.deltaResults],
              ["Source changes / revisions", r.sourceSnapshots],
              ["Agent 4 result", r.agent4Result],
              ["Final merged Tender", r.finalMergedTender],
              ["Provenance / source", r.finalMergedTender.provenance],
            ] as const
          ).map(([name, data]) => (
            <details key={name}>
              <summary>{name}</summary>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(data ?? null, null, 2)}
              </pre>
            </details>
          ))}
        </details>
      ))}
    </section>
  );
}
