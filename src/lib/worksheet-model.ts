import type { Tender } from "./demo-data";
import type { DetailFlow } from "./tender-detail";
import {
  dataPeriod,
  fullDate,
  periodInfo,
  statusLabel,
} from "./tender-workflow.ts";
import { periodRange } from "./tender-period.ts";

export const sheetColumns = [
  { key: "number", label: "№", width: 44 },
  { key: "comment", label: "Коментар", width: 210 },
  { key: "title", label: "Назва закупівлі", width: 250 },
  { key: "objects", label: "Предмет закупівлі", width: 225 },
  { key: "quantity", label: "Кількість", width: 105 },
  { key: "unit", label: "Од. виміру", width: 110 },
  { key: "unitPrice", label: "Ціна за одиницю", width: 155 },
  { key: "budget", label: "Загальна сума", width: 165 },
  { key: "id", label: "ID", width: 210 },
  { key: "period", label: "Період подання", width: 215 },
  { key: "auctionPeriod", label: "Період аукціону", width: 200 },
  { key: "deliveryPeriod", label: "Період поставки", width: 210 },
  { key: "customer", label: "Замовник", width: 205 },
  { key: "address", label: "Адреса", width: 220 },
  { key: "technicalRequirements", label: "Технічні вимоги", width: 260 },
  {
    key: "qualificationRequirements",
    label: "Кваліфікаційні вимоги",
    width: 250,
  },
  { key: "specialRequirements", label: "Особливі вимоги", width: 240 },
  { key: "topCategory", label: "Категорія", width: 145 },
  { key: "score", label: "AI", width: 70 },
  { key: "status", label: "Статус", width: 155 },
] as const;
export type ColumnKey = (typeof sheetColumns)[number]["key"];
export type TableMode = "compact" | "detailed";
export type TableSort = { key: ColumnKey; direction: 1 | -1 };
export type TableLayout = {
  version: 1 | 2;
  order: ColumnKey[];
  visibility: ColumnKey[];
  widths: Partial<Record<ColumnKey, number>>;
  pinned: ColumnKey[];
  sort: TableSort;
};
export type ExportColumn = {
  key: ColumnKey;
  label: string;
  width: number;
  pinned?: boolean;
};
export const compactOrder: ColumnKey[] = [
  "number",
  "comment",
  "title",
  "objects",
  "id",
  "period",
  "budget",
  "customer",
  "topCategory",
  "score",
  "status",
];
export const detailedOrder: ColumnKey[] = sheetColumns.map((c) => c.key);
export function defaultLayout(mode: TableMode): TableLayout {
  const order = (mode === "compact" ? compactOrder : detailedOrder).slice();
  return {
    version: 2,
    order,
    visibility: order.slice(),
    widths: {},
    pinned: ["number", "comment"],
    sort: { key: "score", direction: -1 },
  };
}
export function validLayout(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as TableLayout;
  const keys = sheetColumns.map((c) => c.key);
  return (
    [1, 2].includes(v.version) &&
    [v.order, v.visibility, v.pinned].every(
      (list) => Array.isArray(list) && list.every((k) => keys.includes(k)),
    ) &&
    new Set(v.order).size === v.order.length &&
    !!v.widths &&
    typeof v.widths === "object" &&
    Object.entries(v.widths).every(
      ([k, w]) =>
        keys.includes(k as ColumnKey) &&
        typeof w === "number" &&
        Number.isFinite(w) &&
        w >= 44 &&
        w <= 600,
    ) &&
    !!v.sort &&
    keys.includes(v.sort.key) &&
    [1, -1].includes(v.sort.direction)
  );
}
export function migrateLayout(layout: TableLayout): TableLayout {
  if (layout.version === 2) return layout;
  const tail: ColumnKey[] = ["topCategory", "score", "status"];
  const requirements: ColumnKey[] = [
    "technicalRequirements",
    "qualificationRequirements",
    "specialRequirements",
  ];
  const hasRequirements = layout.order.some((k) => requirements.includes(k));
  const core = layout.order.filter(
    (k) => !tail.includes(k) && !(hasRequirements && requirements.includes(k)),
  );
  return {
    ...layout,
    version: 2,
    order: [...core, ...(hasRequirements ? requirements : []), ...tail],
    pinned: layout.pinned.filter((k) => !tail.includes(k)),
  };
}
export function layoutColumns(
  layout: TableLayout,
  mode: TableMode,
  aiVisible: boolean,
): (typeof sheetColumns)[number][] {
  const allowed = mode === "compact" ? compactOrder : detailedOrder;
  const order = [...new Set([...layout.order, ...allowed])].filter((k) =>
    allowed.includes(k),
  );
  const middle = order.filter(
    (k) => !["number", "comment", "topCategory", "score", "status"].includes(k),
  );
  const pinned = middle.filter((k) => layout.pinned.includes(k));
  return [
    "number",
    "comment",
    ...pinned,
    ...middle.filter((k) => !pinned.includes(k)),
    "topCategory",
    "score",
    "status",
  ]
    .filter((k) =>
      k === "score"
        ? aiVisible && layout.visibility.includes("score")
        : ["number", "comment", "title"].includes(k) ||
          layout.visibility.includes(k as ColumnKey),
    )
    .map((k) => sheetColumns.find((c) => c.key === k)!);
}
export const commentPalette = [
  { value: "none", label: "Без кольору", fill: null },
  { value: "yellow", label: "Жовтий", fill: "FFF1B8" },
  { value: "green", label: "Зелений", fill: "DCF0DF" },
  { value: "red", label: "Червоний", fill: "F8DCDC" },
  { value: "blue", label: "Блакитний", fill: "DCEBFA" },
  { value: "purple", label: "Фіолетовий", fill: "EBDDFA" },
  { value: "gray", label: "Сірий", fill: "E3E6EB" },
] as const;
export const commentFill = (color?: Tender["commentColor"]) =>
  commentPalette.find((c) => c.value === color)?.fill ?? null;
export const prozorroLink = (t: Tender) =>
  `https://prozorro.gov.ua/tender/${encodeURIComponent(t.id.replace(/-IMP.*$/, ""))}`;
export const amount = (value: number, currency?: string) =>
  `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value)}${currency ? ` ${currency}` : ""}`;
export function categoryLabel(
  t: Tender,
):
  | "Техніка"
  | "Запчастини"
  | "Будівництво"
  | "Обладнання"
  | "Матеріали"
  | "Паливо"
  | "Послуги"
  | "Інше" {
  if (t.topCategory === "Матеріали" || t.topCategory === "Паливо")
    return t.topCategory;
  if (["Техніка", "Запчастини", "Обладнання"].includes(t.topCategory))
    return t.topCategory as "Техніка" | "Запчастини" | "Обладнання";
  if (t.topCategory === "Сервіс і роботи")
    return /Будівель|Будівниц/.test(t.category) ? "Будівництво" : "Послуги";
  return "Інше";
}
export function matchesRelevance(t: Tender, filter: string) {
  return (
    filter === "all" ||
    (filter === "rejected"
      ? t.relevance === "rejected"
      : t.relevance !== "rejected")
  );
}
export function tableTender(t: Tender, flow?: DetailFlow): Tender {
  if (t.importSource === "excel")
    return {
      ...t,
      objects: t.objects ?? [],
      technicalRequirements: t.technicalRequirements ?? [],
      qualificationRequirements: t.qualificationRequirements ?? [],
      specialRequirements: t.specialRequirements ?? [],
    };
  if (t.importSource === "excel") flow = undefined;
  const technical = flow?.technical ?? [];
  const find = (label: RegExp) =>
    technical.find(([key]) => label.test(key ?? ""))?.[1];
  const specifiedCount = find(/^Кількість$/);
  const count =
    specifiedCount && /^\d/.test(specifiedCount)
      ? specifiedCount
      : t.title.match(/\d+(?:[.,]\d+)?\s*(?:од\.?|шт\.?)/u)?.[0];
  const quantity =
    t.quantity ??
    (count && /^\d+(?:[.,]\d+)?/.test(count)
      ? Number(count.match(/^\d+(?:[.,]\d+)?/)![0].replace(",", "."))
      : undefined);
  const unit =
    t.unit ??
    (count?.includes("од") ? "од." : count?.includes("шт") ? "шт." : undefined);
  const objects =
    t.objects ??
    (flow?.parts.length
      ? flow.parts.map((p) => ({
          name: p.name,
          quantity: p.qty,
          unit: "шт.",
          catalogue: p.code,
          brand: p.brand,
        }))
      : [
          {
            name:
              (find(/^Модель$/)
                ? [find(/^Тип$/), find(/^Модель$/)].filter(Boolean).join(" ")
                : [find(/^Тип$/), find(/^Бренд$/)].filter(Boolean).join(" ")) ||
              t.title.replace(/,?\s*\d+(?:[.,]\d+)?\s*(?:од\.?|шт\.?)$/, ""),
            ...(quantity !== undefined ? { quantity } : {}),
            ...(unit ? { unit } : {}),
            characteristics: technical
              .filter(
                ([label, value]) =>
                  /вантажопід|основна стріла|колісна|потужність|об.єм|комплектац/i.test(
                    label ?? "",
                  ) && !/уточнити|підтвердити|визначити/i.test(value ?? ""),
              )
              .sort(([a], [b]) => {
                const rank = (label: string) =>
                  /вантажопід/i.test(label)
                    ? 0
                    : /основна стріла/i.test(label)
                      ? 1
                      : /комплектац/i.test(label)
                        ? 2
                        : 3;
                return rank(a ?? "") - rank(b ?? "");
              })
              .slice(0, 2)
              .map(([label, value]) => `${label}: ${value}`),
          },
        ]);
  const homogeneous =
    objects.length > 0 &&
    objects.every(
      (o) => o.quantity !== undefined && o.unit === objects[0]?.unit,
    );
  const totalQuantity =
    quantity ??
    (homogeneous
      ? objects.reduce((sum, o) => sum + o.quantity!, 0)
      : undefined);
  const objectUnit = unit ?? (homogeneous ? objects[0]?.unit : undefined);
  const docs = flow?.documents ?? [];
  const qualificationDoc = docs.find((d) => /кваліфікац/i.test(d.name));
  const known = (text: string) =>
    !!text.trim() &&
    !/уточнити|підтвердити за|визначити за|не зазначено|не вказано|не знайдено|немає даних|потребує уточнення|згідно.*завданням/i.test(
      text,
    );
  const specialPattern =
    /гарант|ліцензі|авторизац|локаліза|виробник|походжен|сервіс/i;
  const technicalPattern =
    /техніч|сумісн|модель|параметр|характеристик|еквівалент|паспорт.*техніки/i;
  const qualificationPattern =
    /кваліфікац|досвід|довідк|аналогічн.*договор|звітніст|документ.*компан|сертиф/i;
  const pool = [
    ...(flow?.requirements ?? []),
    ...(qualificationDoc?.facts ?? []),
  ].filter(known);
  const specialRaw =
    t.specialRequirements ??
    pool.filter(
      (text) =>
        specialPattern.test(text) ||
        (!technicalPattern.test(text) && !qualificationPattern.test(text)),
    );
  const qualificationRaw =
    t.qualificationRequirements ??
    pool.filter(
      (text) =>
        qualificationPattern.test(text) &&
        !specialPattern.test(text) &&
        !technicalPattern.test(text),
    );
  const technicalRaw = t.technicalRequirements ?? [
    ...(flow?.parts.length
      ? flow.parts.map(
          (p) =>
            `${p.code} · ${p.brand} · ${p.name} · ${p.qty} шт. · ${p.match}`,
        )
      : technical
          .filter(
            ([label, value]) =>
              !specialPattern.test(label ?? "") && known(value ?? ""),
          )
          .map(([label, value]) => `${label}: ${value}`)),
    ...pool.filter(
      (text) => technicalPattern.test(text) && !specialPattern.test(text),
    ),
  ];
  const seen = new Set<string>();
  const unique = (list: string[]) =>
    list.filter(known).filter((text) => {
      const key = text
        .toLocaleLowerCase("uk-UA")
        .replace(/[^\p{L}\p{N}]/gu, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const tech = unique(technicalRaw),
    qual = unique(qualificationRaw),
    special = unique(specialRaw);
  return {
    ...t,
    objects,
    ...(totalQuantity !== undefined ? { quantity: totalQuantity } : {}),
    ...(objectUnit ? { unit: objectUnit } : {}),
    ...(t.deliveryPeriod
      ? {}
      : flow?.delivery && known(flow.delivery)
        ? { deliveryPeriod: { text: flow.delivery } }
        : {}),
    technicalRequirements: tech,
    qualificationRequirements: qual,
    specialRequirements: special,
  };
}
export function objectLabel(
  object: NonNullable<Tender["objects"]>[number],
): string {
  return [
    object.name,
    object.catalogue,
    ...(object.characteristics ?? []).slice(0, 3),
    object.quantity !== undefined
      ? `${object.quantity} ${object.unit ?? ""}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function worksheetValue(
  t: Tender,
  key: ColumnKey,
  index: number,
  now: Date,
): string | number {
  if (key === "number") return index + 1;
  if (key === "comment") return t.commentText ?? t.comment ?? "";
  if (key === "period") {
    const p = periodInfo(t, now);
    return `${p.startLabel} → ${p.endLabel}\n${p.label}`;
  }
  if (key === "status") return statusLabel(t.status);
  if (key === "topCategory") return categoryLabel(t);
  if (key === "objects")
    return (t.objects ?? []).map(objectLabel).join("\n") || "-";
  if (key === "auctionPeriod")
    return t.auctionPeriod?.end && !t.auctionPeriod.start
      ? periodRange({ start: t.auctionPeriod.end })
      : periodRange(t.auctionPeriod);
  if (key === "deliveryPeriod") return periodRange(t.deliveryPeriod);
  if (
    [
      "specialRequirements",
      "technicalRequirements",
      "qualificationRequirements",
    ].includes(key)
  )
    return (t[key as "specialRequirements"] ?? []).join("\n") || "-";
  if (key === "quantity" || key === "unitPrice") return t[key] ?? "-";
  if (key === "unit" || key === "address") return t[key] ?? "-";
  if (key === "score" && (t.analysisPending || t.aiScore === null)) return "-";
  if (key === "budget" || key === "score") return t[key];
  return String(t[key as "title"]) || "-";
}
export function worksheetSortValue(
  t: Tender,
  key: ColumnKey,
  now: Date,
): string | number {
  if (["budget", "score", "quantity", "unitPrice"].includes(key))
    return (t[key as "budget"] as number | undefined) ?? -1;
  if (key === "period")
    return t.submissionPeriod?.end ?? t.deadline.split(".").reverse().join("-");
  return worksheetValue(t, key, 0, now);
}
export function worksheetFilename(items: Tender[], now: Date) {
  const p = dataPeriod(items, now);
  return `TenderPro_${p.from}_${p.to}.xlsx`;
}
export const periodCaption = (items: Tender[], now: Date) => {
  if (!items.length) return "Період: немає даних";
  const p = dataPeriod(items, now);
  return `Період: ${fullDate(p.from)} — ${fullDate(p.to)}`;
};

export function worksheetPreview(t: Tender, flow: DetailFlow): DetailFlow {
  if (t.analysis || t.importSource !== "excel") return flow;
  const data = tableTender(t);
  return {
    parts: [],
    technical: [
      ...(data.quantity !== undefined
        ? [["Кількість", `${data.quantity} ${data.unit ?? ""}`]]
        : []),
      ...(data.unitPrice !== undefined
        ? [["Ціна за одиницю", amount(data.unitPrice)]]
        : []),
      ...(data.technicalRequirements ?? [])
        .slice(0, 3)
        .map((value, i) => [`Вимога ${i + 1}`, value]),
    ],
    documents: [],
    summary: t.aiSummary ?? "-",
    checks: "-",
    requirements: [
      ...(data.technicalRequirements ?? []),
      ...(data.qualificationRequirements ?? []),
      ...(data.specialRequirements ?? []),
    ],
    risks: [],
    plan: [],
    delivery: periodRange(data.deliveryPeriod),
  };
}
