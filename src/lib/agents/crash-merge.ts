import type { Tender } from "../demo-data.ts";
import type { CrashRecord } from "./crash-contracts.ts";
import { canonicalTender } from "../tender-model.ts";
import { filterResultSchema } from "./filter-test-contract.ts";
import {
  analyzerResultSchema,
  statusResultSchema,
  type PipelineRecord,
} from "./system-contracts.ts";
const normalize = (v: string) =>
  v.toLocaleLowerCase("uk-UA").replace(/\s+/g, " ").trim();
export function mergeCrashResult(
  raw: Tender,
  pipeline: PipelineRecord,
): Pick<
  CrashRecord,
  | "agent2Result"
  | "agent3Result"
  | "agent4Result"
  | "finalMergedTender"
  | "mergeWarnings"
> {
  const output = (id: string) =>
    pipeline.stages.find((s) => s.agentId === id && s.status === "success");
  const c = output("filter"),
    a = output("detail"),
    s = output("status");
  const agent2Result = c?.result ? filterResultSchema.parse(c.result) : null;
  const agent3Result = a?.result ? analyzerResultSchema.parse(a.result) : null;
  const agent4Result = s?.result ? statusResultSchema.parse(s.result) : null;
  const warnings: string[] = [];
  const provenance: NonNullable<Tender["provenance"]> = { ...raw.provenance };
  const final: Tender = {
    ...structuredClone(raw),
    documents: raw.documents ?? [],
    risks: [],
    aiSummary: "-",
    aiScore: null,
    recommendation: "-",
    analysisPending: pipeline.status === "error",
    stage: pipeline.currentStage,
  };
  const sourceText = [
    raw.title,
    raw.description ?? "",
    raw.subject ?? "",
    ...(raw.technicalRequirements ?? []),
    ...(raw.qualificationRequirements ?? []),
    ...(raw.specialRequirements ?? []),
    ...(raw.objects ?? []).flatMap((o) => [
      o.name,
      ...(o.characteristics ?? []),
    ]),
    ...Object.entries(raw.rawImport?.cells ?? {})
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}: ${v}`),
    ...(raw.documents ?? []).flatMap((d) => [d.text, ...d.facts]),
  ].join("\n");
  const locked = new Set(raw.sourceFields ?? []);
  for (const key of [
    "quantity",
    "unit",
    "unitPrice",
    "address",
    "currency",
    "deliveryPeriod",
  ] as const)
    if (raw[key] !== undefined) locked.add(key);
  for (const key of [
    "technicalRequirements",
    "qualificationRequirements",
    "specialRequirements",
  ] as const)
    if (raw[key]?.length) locked.add(key);
  const sourceFor = (value: string): "import" | "document" =>
    raw.documents?.some((d) => normalize(d.text).includes(normalize(value)))
      ? "document"
      : "import";
  const grounded = (field: string, value: unknown) => {
    if (typeof value === "number") {
      const patterns: Record<string, RegExp> = {
        quantity:
          /(?:кількість\s*[:—-]?\s*)(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:шт\.?|од\.?)/giu,
        unitPrice: /(?:ціна за одиницю\s*[:—-]?\s*)(\d+(?:[.,]\d+)?)/giu,
      };
      const pattern = patterns[field];
      return (
        !!pattern &&
        [...sourceText.matchAll(pattern)].some(
          (m) =>
            (m[1] ?? m[2]) !== undefined &&
            Number((m[1] ?? m[2])!.replace(",", ".")) === value,
        )
      );
    }
    return (
      typeof value === "string" &&
      !!normalize(value) &&
      normalize(sourceText).includes(normalize(value))
    );
  };
  const accept = (field: string, value: unknown) => {
    if (
      value == null ||
      value === "" ||
      value === "-" ||
      (Array.isArray(value) && !value.length)
    )
      return;
    if (locked.has(field)) {
      warnings.push(`${field}: збережено source-of-truth з Excel.`);
      return;
    }
    if (Array.isArray(value)) {
      const verified = value.filter((v) => grounded(field, v));
      if (verified.length !== value.length)
        warnings.push(`${field}: непідтверджені значення не застосовано.`);
      if (verified.length) {
        Object.assign(final, { [field]: verified });
        provenance[field] = { source: "agent3", evidence: verified.join("\n") };
      }
    } else if (grounded(field, value)) {
      Object.assign(final, { [field]: value });
      provenance[field] = {
        source: sourceFor(String(value)),
        evidence: String(value),
      };
    } else
      warnings.push(
        `${field}: немає точного підтвердження у джерелі; не застосовано.`,
      );
  };
  if (agent2Result) {
    final.relevance = agent2Result.relevant ? "accepted" : "rejected";
    if (!locked.has("category")) {
      final.category = agent2Result.category;
      final.topCategory = category(agent2Result.category);
      provenance["category"] = { source: "agent2" };
    }
    if (!locked.has("subject") && grounded("subject", agent2Result.object)) {
      final.subject = agent2Result.object;
      provenance["subject"] = {
        source: "agent2",
        evidence: agent2Result.object,
      };
    }
  }
  // Mock can exercise plumbing, but its generated summaries/decisions are not factual AI conclusions.
  if (agent3Result && a?.provider === "openai") {
    for (const key of [
      "quantity",
      "unit",
      "unitPrice",
      "currency",
      "technicalRequirements",
      "qualificationRequirements",
      "specialRequirements",
      "risks",
      "aiSummary",
    ] as const)
      accept(key, agent3Result[key]);
    accept("address", agent3Result.deliveryAddress);
    if (
      !locked.has("deliveryPeriod") &&
      agent3Result.deliveryDeadline &&
      grounded("deliveryPeriod", agent3Result.deliveryDeadline)
    ) {
      final.deliveryPeriod = { end: agent3Result.deliveryDeadline };
      provenance["deliveryPeriod"] = {
        source: "agent3",
        evidence: agent3Result.deliveryDeadline,
      };
    }
    // Source totals/dates/title, models/items and actual document lists stay immutable.
  }
  if (agent4Result) {
    const terminal = [
      "WON",
      "LOST",
      "DISQUALIFIED",
      "CANCELLED",
      "SUBMITTED",
      "COMPLETED",
      "NOT_SUBMITTED",
    ];
    if (
      s?.provider !== "rule-based" &&
      terminal.includes(agent4Result.status)
    ) {
      final.status = "NEEDS_REVIEW";
      warnings.push(
        "status: AI outcome без підтвердженого lifecycle/source факту не застосовано.",
      );
    } else final.status = agent4Result.status;
    provenance["status"] = { source: "agent4", evidence: agent4Result.reason };
  } else final.status = "NEEDS_REVIEW";
  delete final.analysis;
  final.provenance = provenance;
  return {
    agent2Result,
    agent3Result,
    agent4Result,
    finalMergedTender: canonicalTender(final),
    mergeWarnings: warnings,
  };
}
function category(value: string): Tender["topCategory"] {
  return /запчаст|фільтр|підшипник/i.test(value)
    ? "Запчастини"
    : /техні|машин/i.test(value)
      ? "Техніка"
      : /обладнан/i.test(value)
        ? "Обладнання"
        : /матеріал/i.test(value)
          ? "Матеріали"
          : /палив/i.test(value)
            ? "Паливо"
            : /послуг|робот/i.test(value)
              ? "Сервіс і роботи"
              : "Інше";
}
