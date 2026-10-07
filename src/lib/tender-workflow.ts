import {
  deadlineDate,
  submissionPeriod,
  exactTimestamp,
} from "./tender-period.ts";
export { deadlineDate } from "./tender-period.ts";
import type { Tender } from "./demo-data";

export type TenderStatus =
  | "NEW"
  | "WAITING"
  | "IN_PROGRESS"
  | "WAITING_DECISION"
  | "REJECTED"
  | "NOT_SUBMITTED"
  | "LOST"
  | "CLOSED_NO_PARTICIPATION"
  | "DISQUALIFIED"
  | "STRONG_REJECTED"
  | "CRITICAL_MISMATCH"
  | "CANCELLED"
  | "WON"
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
  { value: "WAITING_DECISION", label: "Очікує рішення", tone: "yellow" },
  { value: "REJECTED", label: "Не беремо", tone: "orange" },
  { value: "NOT_SUBMITTED", label: "Не подали", tone: "orange" },
  { value: "LOST", label: "Не перемогли", tone: "orange" },
  {
    value: "CLOSED_NO_PARTICIPATION",
    label: "Закрито без участі",
    tone: "orange",
  },
  { value: "DISQUALIFIED", label: "Дискваліфіковано", tone: "red" },
  { value: "STRONG_REJECTED", label: "Відхилено", tone: "red" },
  {
    value: "CRITICAL_MISMATCH",
    label: "Критична невідповідність",
    tone: "red",
  },
  { value: "CANCELLED", label: "Скасовано замовником", tone: "gray" },
  { value: "WON", label: "Перемога", tone: "green" },
];
const legacy: Record<string, TenderStatus> = {
  Новий: "NEW",
  Проаналізовано: "WAITING",
  Цікавий: "WAITING",
  Очікування: "WAITING",
  "На аналізі": "WAITING",
  "Ручний перегляд": "WAITING",
  "В роботі": "IN_PROGRESS",
  Подано: "WAITING_DECISION",
  Відхилено: "STRONG_REJECTED",
  "Не беремо": "REJECTED",
  Завершено: "CLOSED_NO_PARTICIPATION",
  COMPLETED_SUCCESS: "CLOSED_NO_PARTICIPATION",
  COMPLETED_FAILED: "CLOSED_NO_PARTICIPATION",
  "Очікує рішення": "WAITING_DECISION",
  Дискваліфіковано: "DISQUALIFIED",
  "Не подали": "NOT_SUBMITTED",
  "Не перемогли": "LOST",
  "Скасовано замовником": "CANCELLED",
  Перемога: "WON",
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
  normalizeStatus(t.status) === normalizeStatus(status) ||
  (normalizeStatus(status) === "WAITING" &&
    normalizeStatus(t.status) === "WAITING_DECISION") ||
  (normalizeStatus(status) === "REJECTED" &&
    [
      "REJECTED",
      "NOT_SUBMITTED",
      "LOST",
      "DISQUALIFIED",
      "STRONG_REJECTED",
      "CRITICAL_MISMATCH",
    ].includes(normalizeStatus(t.status)));
export const isCompleted = (status: string) =>
  [
    "NOT_SUBMITTED",
    "LOST",
    "CLOSED_NO_PARTICIPATION",
    "DISQUALIFIED",
    "STRONG_REJECTED",
    "CRITICAL_MISMATCH",
    "CANCELLED",
    "WON",
  ].includes(normalizeStatus(status));
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
    comment: t.commentText ?? t.comment ?? "",
    commentText: t.commentText ?? t.comment ?? "",
    commentColor: t.commentColor ?? "none",
    publishedAt: t.publishedAt ?? fromId ?? kyivToday(now),
    publicationDateSource:
      t.publicationDateSource ??
      (t.publishedAt ? "source" : fromId ? "tender-id" : "loaded"),
  };
}
export function newTender(t: Tender, now = new Date()): Tender {
  const {
    lifecycle,
    commentColor,
    commentText,
    firstViewedAt,
    manualStatusOverride,
    previousStatus,
    completedAt,
    completionType,
    commentUpdatedAt,
    statusRecalcAt,
    statusOrigin,
    statusChangedAt,
    history,
    documentStates,
    ...clean
  } = t;
  return normalizeTender(
    {
      ...clean,
      status: "NEW",
      commentColor:
        t.importSource === "excel" ? (t.commentColor ?? "none") : "none",
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
function changeStatus(
  t: Tender,
  status: string,
  now: Date,
  origin: Tender["statusOrigin"] = "lifecycle",
): Tender {
  if (t.status === status) return t;
  return recordEvent(
    { ...t, status, statusOrigin: origin, statusChangedAt: now.toISOString() },
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
    ? changeStatus(viewed, "WAITING", now, "view")
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
export function classifyComment(comment: string): TenderStatus | null {
  const text = comment
    .toLocaleLowerCase("uk-UA")
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  // Administrative outcomes require an explicit affirmative statement, not a
  // question, quote, negation or hypothetical remark.
  if (/[?？]|можливо|якщо|у разі|чи буде|ризик|можуть/.test(text)) return null;
  const explicit = [
    ["DISQUALIFIED", "дискваліфіковано"],
    ["STRONG_REJECTED", "відхилено"],
    ["CRITICAL_MISMATCH", "критична невідповідність"],
    ["CANCELLED", "скасовано замовником"],
    ["LOST", "не перемогли"],
    ["NOT_SUBMITTED", "не подали"],
    ["CLOSED_NO_PARTICIPATION", "закрито без участі"],
  ] as const;
  const outcomes = explicit.filter(
    ([, phrase]) => text.includes(phrase) && !text.includes("не " + phrase),
  );
  if (outcomes.length > 1) return null;
  if (outcomes.length === 1) return outcomes[0]![0];
  if (
    /подали пропозицію|пропозицію подано|очікує(?:мо)? рішення|очікуємо рішення/.test(
      text,
    )
  )
    return "WAITING_DECISION";
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
  if (comment === (t.commentText ?? t.comment ?? "")) return t;
  const viewed = viewTender(t, now);
  return recordEvent(
    {
      ...viewed,
      comment,
      commentText: comment,
      commentUpdatedAt: now.toISOString(),
      statusRecalcAt: new Date(now.getTime() + delay).toISOString(),
    },
    "comment",
    "Коментар змінено",
    now,
  );
}
function hasSubmitted(t: Tender) {
  if (t.lifecycle?.participation)
    return t.lifecycle.participation === "submitted";
  return (
    t.lifecycle?.participation === "submitted" ||
    !!t.lifecycle?.submittedAt ||
    t.stage === "Подано" ||
    normalizeStatus(t.status) === "WAITING_DECISION"
  );
}
function lifecycleStatus(t: Tender): TenderStatus | null {
  const life = t.lifecycle;
  if (!life) return hasSubmitted(t) ? "WAITING_DECISION" : null;
  if (life.state === "cancelled") return "CANCELLED";
  if (life.state === "disqualified") return "DISQUALIFIED";
  if (life.state === "rejected") return "STRONG_REJECTED";
  if (life.decision === "won") return "WON";
  if (life.decision === "lost") return "LOST";
  if (life.state === "closed")
    return hasSubmitted(t) ? "WAITING_DECISION" : "CLOSED_NO_PARTICIPATION";
  if (
    hasSubmitted(t) &&
    (life.decision === "pending" || life.state === "awarded")
  )
    return "WAITING_DECISION";
  return null;
}
export function recalculateTender(t: Tender, now = new Date()): Tender {
  const due =
    !t.statusRecalcAt || Date.parse(t.statusRecalcAt) <= now.getTime();
  if (due) {
    let sourceStatus = lifecycleStatus(t);
    if (
      sourceStatus &&
      !isCompleted(sourceStatus) &&
      t.statusOrigin === "comment" &&
      isCompleted(t.status) &&
      Date.parse(t.commentUpdatedAt ?? "") >
        Date.parse(t.lifecycle?.updatedAt ?? "1970-01-01")
    )
      sourceStatus = null;
    if (sourceStatus) t = changeStatus(t, sourceStatus, now);
    if (t.statusRecalcAt) {
      const { statusRecalcAt, ...saved } = t;
      let status = classifyComment(saved.commentText ?? saved.comment ?? "");
      if (
        status === "WAITING_DECISION" &&
        !hasSubmitted(saved) &&
        !/подали (?:пропозицію|документи)|пропозицію подано/.test(
          saved.commentText ?? saved.comment ?? "",
        )
      )
        status = "WAITING";
      if (hasSubmitted(saved) && status === "WAITING")
        status = "WAITING_DECISION";
      const administrative =
        status &&
        [
          "DISQUALIFIED",
          "STRONG_REJECTED",
          "CRITICAL_MISMATCH",
          "CANCELLED",
          "LOST",
        ].includes(status);
      const sourceTerminal = sourceStatus && isCompleted(sourceStatus);
      const openSubmission =
        !isCompleted(saved.status) &&
        !submissionPeriod(saved, now, kyivToday(now)).expired;
      const eligible =
        !sourceTerminal &&
        ((!sourceStatus && openSubmission) ||
          (administrative &&
            hasSubmitted(saved) &&
            !isCompleted(saved.status)));
      t =
        status && eligible
          ? changeStatus(saved, status, now, "comment")
          : saved;
    }
  }
  return expireTender(t, now);
}
export function syncLifecycle(
  t: Tender,
  lifecycle: NonNullable<Tender["lifecycle"]>,
  now = new Date(),
  delay = STATUS_RECALC_DELAY_MS,
): Tender {
  return recordEvent(
    {
      ...t,
      lifecycle: { ...t.lifecycle, ...lifecycle, updatedAt: now.toISOString() },
      statusRecalcAt: new Date(now.getTime() + delay).toISOString(),
    },
    "source",
    "Оновлено lifecycle дані джерела",
    now,
  );
}
export function expireTender(t: Tender, now = new Date()): Tender {
  const period = submissionPeriod(t, now, kyivToday(now));
  if (!period.expired || isCompleted(t.status)) return t;
  if (hasSubmitted(t))
    return changeStatus(t, "WAITING_DECISION", now, "deadline");
  const previousStatus = normalizeStatus(t.status);
  return {
    ...changeStatus(
      t,
      previousStatus === "IN_PROGRESS"
        ? "NOT_SUBMITTED"
        : "CLOSED_NO_PARTICIPATION",
      now,
      "deadline",
    ),
    previousStatus,
    completionType: "failed",
    completedAt: now.toISOString(),
  };
}
export function periodInfo(t: Tender, now = new Date()) {
  return submissionPeriod(t, now, kyivToday(now));
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
