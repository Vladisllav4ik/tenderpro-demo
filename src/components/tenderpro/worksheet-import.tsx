import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDemo } from "@/lib/demo-store";
import type { ImportResult } from "@/lib/excel-import";
import { toast } from "sonner";
import { importCrashTenders } from "@/lib/agents/client";
export function WorksheetImport({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, refreshTenders } = useDemo();
  const setOpen = onOpenChange;
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<ImportResult | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setResult(null);
      setError("");
    }
  }, [open]);
  const input = useRef<HTMLInputElement>(null);
  const read = async (file?: File) => {
    setResult(null);
    setError("");
    if (!file) return;
    setBusy(true);
    try {
      const { parseImportWorkbook } = await import("@/lib/excel-import");
      const parsed = await parseImportWorkbook(
        await file.arrayBuffer(),
        new Set(state.tenders.map((t) => t.id)),
        file.name,
      );
      setResult(parsed);
      if (!parsed.total)
        setError("Файл порожній. Заповніть рядки шаблону на аркуші Імпорт.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося прочитати XLSX.");
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    if (!result?.tenders.length) return;
    setBusy(true);
    setError("");
    try {
      const reply = await importCrashTenders({
        data: { tenders: result.tenders },
      });
      await refreshTenders();
      toast.success(
        `Імпортовано ${reply.imported}. Pipeline 2 → 3 → 4 завершив обробку; статуси й помилки — у ADMIN → Crash test / Pipeline.`,
      );
      setOpen(false);
      setResult(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Імпорт або pipeline не завершено.",
      );
      await refreshTenders().catch(() => {});
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="worksheet-import-dialog">
          <DialogHeader>
            <DialogTitle>Імпорт Excel</DialogTitle>
            <DialogDescription>
              Заповнений шаблон TenderPro або сумісний XLSX. Перевірені рядки
              додаються без перезапису існуючих ID.
            </DialogDescription>
          </DialogHeader>
          <input
            ref={input}
            type="file"
            accept=".xlsx"
            aria-label="Файл Excel для імпорту"
            disabled={busy}
            onChange={(e) => {
              void read(e.target.files?.[0]);
            }}
          />
          {busy && <p role="status">Перевірка / pipeline 2 → 3 → 4…</p>}
          {error && <p role="alert">{error}</p>}
          {result && (
            <div className="worksheet-import-result">
              <p>
                Рядків: {result.total} · Готові: {result.tenders.length} ·
                Дублікати: {result.duplicates} · Помилки: {result.issues.length}
              </p>
              {result.issues.length > 0 && (
                <ul>
                  {result.issues.map((issue) => (
                    <li key={issue.row}>
                      Рядок {issue.row}: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {result.tenders.length > 0 && (
                <p>
                  Буде додано 1–10 перевірених рядків. Pipeline Agent 2 → 3 → 4
                  запускається автоматично у збережених режимах агентів; OpenAI
                  режими витрачають tokens. Agent 1 не запускається.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button disabled={busy || !result?.tenders.length} onClick={commit}>
              Імпортувати {result?.tenders.length ?? 0}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
