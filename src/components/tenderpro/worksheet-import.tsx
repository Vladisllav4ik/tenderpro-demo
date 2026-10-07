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
export function WorksheetImport({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, setState } = useDemo();
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
  const commit = () => {
    if (!result?.tenders.length) return;
    const present = new Set(state.tenders.map((t) => t.id));
    const count = result.tenders.filter((t) => !present.has(t.id)).length;
    setState((s) => {
      const known = new Set(s.tenders.map((t) => t.id));
      return {
        ...s,
        tenders: [
          ...s.tenders,
          ...result.tenders.filter((t) => !known.has(t.id)),
        ],
      };
    });
    toast.success(
      `Імпортовано ${count} тендерів. Активний період і фільтри застосовуються до нових рядків.`,
    );
    setOpen(false);
    setResult(null);
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
          {busy && <p role="status">Перевіряємо файл…</p>}
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
                  Буде додано тільки перевірені рядки. AI аналіз не запускається
                  автоматично.
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
