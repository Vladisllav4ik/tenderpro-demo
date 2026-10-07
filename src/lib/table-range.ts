import type { Tender } from "./demo-data";
import { kyivToday } from "./tender-workflow.ts";
import { exactTimestamp } from "./tender-period.ts";
export type TableRange = {
  preset: "7" | "14" | "month" | "custom" | "history";
  from: string;
  to: string;
};
export const defaultRange: TableRange = { preset: "7", from: "", to: "" };
export function dateValid(date: string): boolean {
  const stamp = Date.parse(date);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(stamp) &&
    new Date(stamp).toISOString().slice(0, 10) === date
  );
}
export function validRange(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as TableRange;
  return (
    ["7", "14", "month", "custom", "history"].includes(v.preset) &&
    typeof v.from === "string" &&
    typeof v.to === "string" &&
    (v.preset !== "custom" ||
      (dateValid(v.from) && dateValid(v.to) && v.from <= v.to))
  );
}
export function publicationDay(t: Tender): string | null {
  const stamp = exactTimestamp(t.publishedAt);
  if (stamp !== null) return kyivToday(new Date(stamp));
  const day =
    t.publishedAt?.slice(0, 10) ?? /^UA-(\d{4}-\d{2}-\d{2})-/.exec(t.id)?.[1];
  return day && dateValid(day) ? day : null;
}
export function resolveRange(
  range: TableRange,
  tenders: Tender[],
  now = new Date(),
) {
  const today = kyivToday(now);
  if (range.preset === "custom") return { from: range.from, to: range.to };
  if (range.preset === "history")
    return {
      from:
        tenders
          .map(publicationDay)
          .filter((v): v is string => !!v)
          .sort()[0] ?? today,
      to: today,
    };
  const days = range.preset === "month" ? 30 : Number(range.preset);
  return {
    from: new Date(Date.parse(today) - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10),
    to: today,
  };
}
export function inPublicationRange(
  t: Tender,
  range: { from: string; to: string },
) {
  const day = publicationDay(t);
  return !!day && day >= range.from && day <= range.to;
}
