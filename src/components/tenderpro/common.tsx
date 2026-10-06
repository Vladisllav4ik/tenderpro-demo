import { Link } from "@tanstack/react-router";
import { Sparkles, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money, type Tender } from "@/lib/demo-data";
import { useDemo } from "@/lib/demo-store";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";
export function PageHead({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Link to="/dashboard">TenderPro</Link>
            <ChevronRight className="size-3" />
            <span>{title}</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {actions}
      </div>
    </>
  );
}
export function AI({ children = "AI" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-ai/10 px-1.5 py-0.5 text-[11px] font-semibold text-ai">
      <Sparkles className="size-3" />
      {children}
    </span>
  );
}
export function Status({ children }: { children: ReactNode }) {
  const value = String(children);
  const tone =
    value.includes("Відх") || value === "C"
      ? "danger"
      : value.includes("робот") || value === "A" || value.includes("Подано")
        ? "success"
        : value.includes("анал") || value === "B"
          ? "warning"
          : "neutral";
  return <span className={`status status-${tone}`}>{children}</span>;
}
export function Score({ value }: { value: number }) {
  return (
    <span
      className={`score ${value >= 80 ? "score-high" : value >= 60 ? "score-mid" : "score-low"}`}
    >
      {value}
    </span>
  );
}
export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && <h2 className="mb-4 text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
export function Empty({ text = "Нічого не знайдено" }: { text?: string }) {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
export function TenderTable({
  items,
  compact = false,
}: {
  items: Tender[];
  compact?: boolean;
}) {
  const [preview, setPreview] = useState<Tender | null>(null);
  const { updateTender } = useDemo();
  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Score</th>
              <th>ID / Назва</th>
              <th>Замовник</th>
              {!compact && (
                <>
                  <th>Категорія</th>
                  <th>Бюджет</th>
                </>
              )}
              <th>Дедлайн</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} onClick={() => setPreview(t)}>
                <td>
                  <Score value={t.score} />
                </td>
                <td>
                  <div className="font-medium text-foreground">{t.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.id}
                  </div>
                </td>
                <td>{t.customer}</td>
                {!compact && (
                  <>
                    <td>{t.category}</td>
                    <td className="whitespace-nowrap font-medium">
                      {money(t.budget)}
                    </td>
                  </>
                )}
                <td className="whitespace-nowrap">{t.deadline}</td>
                <td>
                  <Status>{t.status}</Status>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>{preview.title}</DialogTitle>
                <DialogDescription>
                  {preview.id} · {preview.customer}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 py-3">
                <Metric label="AI score" value={`${preview.score}/100`} />
                <Metric label="Бюджет" value={money(preview.budget)} />
                <Metric label="Дедлайн" value={preview.deadline} />
              </div>
              <p className="rounded-md bg-muted p-3 text-sm">
                Тендер відповідає профілю компанії. Рекомендовано перевірити
                технічні параметри, строк поставки та гарантійні вимоги.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    updateTender(preview.id, "Відхилено");
                    toast.success("Тендер відхилено");
                    setPreview(null);
                  }}
                >
                  Відхилити
                </Button>
                <Button asChild>
                  <Link to="/tenders/$id" params={{ id: preview.id }}>
                    Відкрити картку
                  </Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function Metric({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: string;
}) {
  return (
    <div className="metric">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-xl">{value}</strong>
      {trend && (
        <span className="mt-1 block text-xs text-success">{trend}</span>
      )}
    </div>
  );
}
export function DemoButton({
  children,
  result = "Демо-дію виконано",
  variant = "default",
}: {
  children: ReactNode;
  result?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
}) {
  return (
    <Button variant={variant} onClick={() => toast.success(result)}>
      {children}
    </Button>
  );
}
