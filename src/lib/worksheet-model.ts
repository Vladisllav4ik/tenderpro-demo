import type { Tender } from "./demo-data";
import {
  dataPeriod,
  fullDate,
  periodInfo,
  shortDate,
  statusLabel,
} from "./tender-workflow.ts";

export const sheetColumns = [
  { key: "number", label: "№", width: 44 },
  { key: "comment", label: "Коментар", width: 210 },
  { key: "title", label: "Назва", width: 260 },
  { key: "id", label: "ID", width: 224 },
  { key: "period", label: "Період", width: 154 },
  { key: "link", label: "Посилання", width: 58 },
  { key: "score", label: "AI", width: 70 },
  { key: "customer", label: "Замовник", width: 205 },
  { key: "topCategory", label: "Категорія", width: 145 },
  { key: "budget", label: "Сума", width: 170 },
  { key: "region", label: "Регіон", width: 140 },
  { key: "stage", label: "Етап", width: 150 },
  { key: "status", label: "Статус", width: 125 },
] as const;
export type ColumnKey = (typeof sheetColumns)[number]["key"];
export type ExportColumn = { key: ColumnKey; label: string; width: number };
export const prozorroLink = (t: Tender) =>
  `https://prozorro.gov.ua/tender/${encodeURIComponent(t.id.replace(/-IMP.*$/, ""))}`;
export function categoryLabel(
  t: Tender,
):
  "Техніка" | "Запчастини" | "Будівництво" | "Обладнання" | "Послуги" | "Інше" {
  if (
    t.topCategory === "Техніка" ||
    t.topCategory === "Запчастини" ||
    t.topCategory === "Обладнання"
  )
    return t.topCategory;
  if (t.topCategory === "Сервіс і роботи")
    return t.category.includes("Будівельні") ? "Будівництво" : "Послуги";
  return "Інше";
}
export function worksheetValue(
  t: Tender,
  key: ColumnKey,
  index: number,
  now: Date,
): string | number {
  if (key === "number") return index + 1;
  if (key === "comment") return t.comment ?? "";
  if (key === "period") {
    const p = periodInfo(t, now);
    return `${shortDate(p.start)} → ${p.end ? shortDate(p.end) : "—"}\n${p.label}`;
  }
  if (key === "status") return statusLabel(t.status);
  if (key === "topCategory") return categoryLabel(t);
  if (key === "link") return prozorroLink(t);
  return t[key];
}
export function worksheetFilename(items: Tender[], now: Date) {
  const period = dataPeriod(items, now);
  return `TenderPro_${period.from}_${period.to}.xlsx`;
}
export const periodCaption = (items: Tender[], now: Date) => {
  if (!items.length) return "Період: немає даних";
  const period = dataPeriod(items, now);
  return `Період: ${fullDate(period.from)} — ${fullDate(period.to)}`;
};
