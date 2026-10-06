import type { Tender } from "./demo-data";

export type TenderStatus =
  | "NEW"
  | "WAITING"
  | "IN_PROGRESS"
  | "REJECTED"
  | "COMPLETED_SUCCESS"
  | "COMPLETED_FAILED";
export const statusOptions: {
  value: TenderStatus;
  label: string;
  tone: string;
  hint?: string;
}[] = [
  { value: "NEW", label: "Новий", tone: "blue" },
  { value: "WAITING", label: "Очікування", tone: "yellow" },
  { value: "IN_PROGRESS", label: "В роботі", tone: "green" },
  { value: "REJECTED", label: "Не беремо", tone: "red" },
  {
    value: "COMPLETED_SUCCESS",
    label: "Завершено",
    tone: "green",
    hint: "Успішно · demo",
  },
  {
    value: "COMPLETED_FAILED",
    label: "Завершено",
    tone: "red",
    hint: "Неуспішно · demo",
  },
];
const legacy: Record<string, TenderStatus> = {
  Новий: "NEW",
  Проаналізовано: "WAITING",
  Цікавий: "WAITING",
  Очікування: "WAITING",
  "На аналізі": "WAITING",
  "Ручний перегляд": "WAITING",
  "В роботі": "IN_PROGRESS",
  Подано: "IN_PROGRESS",
  Відхилено: "REJECTED",
  "Не беремо": "REJECTED",
  Завершено: "COMPLETED_SUCCESS",
};
export function normalizeStatus(status: string): TenderStatus {
  return statusOptions.some((option) => option.value === status)
    ? (status as TenderStatus)
    : (legacy[status] ?? "NEW");
}
export const statusLabel = (status: string) =>
  statusOptions.find((option) => option.value === normalizeStatus(status))!
    .label;
export const statusTone = (status: string) =>
  statusOptions.find((option) => option.value === normalizeStatus(status))!
    .tone;
export const matchesStatus = (t: Tender, status: string) =>
  normalizeStatus(t.status) === normalizeStatus(status);
export const isCompleted = (status: string) =>
  normalizeStatus(status).startsWith("COMPLETED_");
const kyivFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Kyiv",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function kyivToday(now = new Date()): string {
  const parts = kyivFormatter.formatToParts(now);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join("-");
}
export function deadlineDate(value: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(iso + "T00:00:00Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso
    ? null
    : iso;
}
export const shortDate = (iso: string) =>
  iso.slice(0, 10).split("-").reverse().slice(0, 2).join(".");
export const fullDate = (iso: string) =>
  iso.slice(0, 10).split("-").reverse().join(".");
export function normalizeTender(t: Tender, now = new Date()): Tender {
  const fromId = /^UA-(\d{4}-\d{2}-\d{2})-/.exec(t.id)?.[1];
  return {
    ...t,
    status: normalizeStatus(t.status),
    manualStatusOverride: false,
    comment: t.comment ?? "",
    publishedAt: t.publishedAt ?? fromId ?? kyivToday(now),
    publicationDateSource:
      t.publicationDateSource ??
      (t.publishedAt ? "source" : fromId ? "tender-id" : "loaded"),
  };
}
export function newTender(t: Tender, now = new Date()): Tender {
  const {
    firstViewedAt,
    manualStatusOverride,
    previousStatus,
    completedAt,
    completionType,
    commentUpdatedAt,
    statusRecalcAt,
    history,
    documentStates,
    ...clean
  } = t;
  return normalizeTender(
    {
      ...clean,
      status: "NEW",
      comment: t.comment ?? "",
      history: [
        { at: now.toISOString(), kind: "imported", text: "Тендер імпортовано" },
      ],
    },
    now,
  );
}
export const STATUS_RECALC_DELAY_MS = 180000;
export function recordEvent(
  t: Tender,
  kind: string,
  text: string,
  now = new Date(),
  from?: string,
  to?: string,
): Tender {
  return {
    ...t,
    history: [
      ...(t.history ?? []),
      {
        at: now.toISOString(),
        kind,
        text,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      },
    ],
  };
}
function changeStatus(t: Tender, status: string, now: Date): Tender {
  if (t.status === status) return t;
  return recordEvent(
    { ...t, status },
    "status",
    "Автоматично змінено статус",
    now,
    t.status,
    status,
  );
}
export function viewTender(t: Tender, now = new Date()): Tender {
  t = recalculateTender(t, now);
  if (t.firstViewedAt) return t;
  const viewed = recordEvent(
    { ...t, firstViewedAt: now.toISOString() },
    "viewed",
    "Переглянуто",
    now,
  );
  return matchesStatus(viewed, "NEW")
    ? changeStatus(viewed, "WAITING", now)
    : viewed;
}
const positive = [
  "подали запит на кп",
  "чекаємо пропозицію",
  "запросили ціну",
  "подали документи",
  "прораховуємо",
  "готую документи",
  "чекаємо відповідь",
  "відправили постачальнику",
];
const negative = [
  "не встигли",
  "не відповідає",
  "не наш профіль",
  "не підходимо",
  "дорого",
  "не цікаво",
  "не беремо",
  "немає товару",
  "строки не підходять",
];
export function classifyComment(
  comment: string,
): "IN_PROGRESS" | "REJECTED" | null {
  const text = comment
    .toLocaleLowerCase("uk-UA")
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  // Contradictory or negated working phrases leave the current status intact.
  const contains = (phrase: string) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${phrase}($|[^\\p{L}\\p{N}])`, "u").test(
      text,
    );
  const work = positive.some(contains);
  const reject = negative.some(
    (phrase) =>
      contains(phrase) && (phrase !== "дорого" || !contains("не дорого")),
  );
  if (
    work === reject ||
    (work && positive.some((phrase) => text.includes(`не ${phrase}`)))
  )
    return null;
  return work ? "IN_PROGRESS" : "REJECTED";
}
export function saveComment(
  t: Tender,
  comment: string,
  now = new Date(),
  delay = STATUS_RECALC_DELAY_MS,
): Tender {
  if (comment === (t.comment ?? "")) return t;
  const viewed = viewTender(t, now);
  return recordEvent(
    {
      ...viewed,
      comment,
      commentUpdatedAt: now.toISOString(),
      statusRecalcAt: new Date(now.getTime() + delay).toISOString(),
    },
    "comment",
    "Коментар змінено",
    now,
  );
}
export function recalculateTender(t: Tender, now = new Date()): Tender {
  t = expireTender(t, now);
  if (t.statusRecalcAt && Date.parse(t.statusRecalcAt) <= now.getTime()) {
    const { statusRecalcAt, ...saved } = t;
    const status = classifyComment(saved.comment ?? "");
    t =
      status && !isCompleted(saved.status)
        ? changeStatus(saved, status, now)
        : saved;
  }
  return expireTender(t, now);
}
export function expireTender(t: Tender, now = new Date()): Tender {
  const end = deadlineDate(t.deadline);
  // Source deadlines have no time: the whole final day is available in Kyiv.
  if (!end || end >= kyivToday(now) || isCompleted(t.status)) return t;
  const previousStatus = normalizeStatus(t.status);
  const success = previousStatus === "IN_PROGRESS";
  return {
    ...changeStatus(t, success ? "COMPLETED_SUCCESS" : "COMPLETED_FAILED", now),
    previousStatus,
    completionType: success ? "success" : "failed",
    completedAt: now.toISOString(),
  };
}
export function periodInfo(t: Tender, now = new Date()) {
  const start = normalizeTender(t, now).publishedAt!.slice(0, 10);
  const end = deadlineDate(t.deadline);
  const days = end
    ? Math.round(
        (Date.parse(end + "T00:00:00Z") -
          Date.parse(kyivToday(now) + "T00:00:00Z")) /
          86400000,
      )
    : null;
  return {
    start,
    end,
    days,
    label:
      days === null
        ? "Дата потребує уточнення"
        : days < 0
          ? "Строк завершено"
          : days === 0
            ? "Останній день"
            : `${days} дн. залишилось`,
    tone:
      days !== null && days < 0
        ? "expired"
        : days !== null && days <= 3
          ? "red"
          : days !== null && days <= 7
            ? "orange"
            : "normal",
  };
}
export function dataPeriod(tenders: Tender[], now = new Date()) {
  const dates = tenders
    .map((t) => normalizeTender(t, now).publishedAt!.slice(0, 10))
    .sort();
  return {
    from: dates[0] ?? kyivToday(now),
    to: dates.at(-1) ?? kyivToday(now),
  };
}
