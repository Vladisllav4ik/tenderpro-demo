import type { Tender } from "./demo-data";

export function deadlineDate(value: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(iso + "T00:00:00Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso
    ? null
    : iso;
}
function validDate(value: string): boolean {
  const time = Date.parse(value);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}
export function exactTimestamp(value?: string): number | null {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return null;
  if (!validDate(value.slice(0, 10))) return null;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? stamp : null;
}
export function formatPeriodDate(value?: string): string {
  if (!value) return "-";
  const stamp = exactTimestamp(value);
  if (stamp !== null)
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(stamp)
      .replace(",", "");
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : deadlineDate(value);
  return iso ? iso.split("-").reverse().join(".") : value;
}
export function periodRange(period?: {
  start?: string;
  end?: string;
  text?: string;
}): string {
  if (!period) return "-";
  if (period.text?.trim()) return period.text.trim().replace(/\s+/g, " ");
  if (period.start && period.end && period.start !== period.end)
    return `${formatPeriodDate(period.start)} → ${formatPeriodDate(period.end)}`;
  return period.start
    ? formatPeriodDate(period.start)
    : period.end
      ? `До ${formatPeriodDate(period.end)}`
      : "-";
}
export function submissionPeriod(t: Tender, now: Date, today: string) {
  const start =
    t.submissionPeriod?.start ??
    (t.importSource === "excel"
      ? ""
      : (t.publishedAt ?? /^UA-(\d{4}-\d{2}-\d{2})-/.exec(t.id)?.[1] ?? today));
  const end = t.submissionPeriod?.end ?? deadlineDate(t.deadline);
  const timestamp = exactTimestamp(end ?? undefined);
  const calendarEnd = end
    ? timestamp !== null
      ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kyiv" }).format(
          timestamp,
        )
      : validDate(end)
        ? end
        : null
    : null;
  const calendarDays = calendarEnd
    ? Math.round((Date.parse(calendarEnd) - Date.parse(today)) / 86400000)
    : null;
  const remaining = timestamp !== null ? timestamp - now.getTime() : null;
  const days =
    remaining !== null
      ? Math.max(0, Math.floor(remaining / 86400000))
      : calendarDays;
  const expired =
    remaining !== null ? remaining <= 0 : days !== null && days < 0;
  const minutes =
    remaining === null ? null : Math.max(0, Math.ceil(remaining / 60000));
  const label = expired
    ? "Строк подання завершено"
    : minutes !== null && remaining! < 86400000
      ? `${Math.floor(minutes / 60)} год ${minutes % 60} хв`
      : days === null
        ? "Дата потребує уточнення"
        : days === 0
          ? "Останній день · час не вказано"
          : `${days} дн. залишилось`;
  return {
    start,
    end,
    days,
    expired,
    label,
    precise: timestamp !== null,
    startLabel:
      exactTimestamp(start) !== null
        ? formatPeriodDate(start)
        : `${formatPeriodDate(start)} --:--`,
    endLabel:
      timestamp !== null
        ? formatPeriodDate(end ?? undefined)
        : end
          ? `${formatPeriodDate(end)} --:--`
          : "-",
    tone: expired
      ? "expired"
      : days !== null && days <= 3
        ? "red"
        : days !== null && days <= 7
          ? "orange"
          : "normal",
  };
}
