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
  v
    .toLocaleLowerCase("uk-UA")
    .replace(/[’ʼ]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["«“]+|["»”]+$/g, "")
    .trim();
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
  const evidenceFor = (field: string, value: string) =>
    agent3Result?.evidence?.find((e) => {
      if (
        e.field !== field ||
        normalize(e.value) !== normalize(value) ||
        e.confidence < 0.5 ||
        !e.quote.trim()
      )
        return false;
      const source =
        e.sourceType === "answer"
          ? raw.hierarchy?.questions.find(
              (q) =>
                q.id === e.sourceId && (!q.changeClaimed || q.changeVerified),
            )?.answer
          : e.sourceType === "document"
            ? raw.documents?.find(
                (d) =>
                  d.documentId === e.sourceId && d.parseStatus === "parsed",
              )?.text
            : e.sourceType === "prozorro"
              ? JSON.stringify({
                  items: raw.sourceItems,
                  title: raw.officialTitle,
                  description: raw.description,
                })
              : sourceText;
      // Extractive proof, not a plausible paraphrase: both quote and value must occur in the cited source.
      return (
        !!source &&
        normalize(source).includes(normalize(e.quote)) &&
        normalize(e.quote).includes(normalize(value))
      );
    });
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
      const verified = value.filter(
        (v) => grounded(field, v) || evidenceFor(field, v),
      );
      if (verified.length !== value.length)
        warnings.push(`${field}: непідтверджені значення не застосовано.`);
      if (verified.length) {
        Object.assign(final, { [field]: verified });
        const proof = evidenceFor(field, verified[0]);
        provenance[field] = {
          source:
            proof?.sourceType === "answer"
              ? "agent3"
              : (proof?.sourceType ?? "agent3"),
          ...(proof
            ? {
                sourceType:
                  proof.sourceType === "prozorro"
                    ? "prozorro_tender"
                    : proof.sourceType,
              }
            : {}),
          evidence: verified.join("\n"),
          ...(proof
            ? { sourceId: proof.sourceId, confidence: proof.confidence }
            : {}),
        };
        for (const v of verified) {
          const e = evidenceFor(field, v);
          const doc = raw.documents?.find((d) => d.text.includes(v));
          provenance[`${field}:${v}`] = {
            source:
              e?.sourceType === "answer"
                ? "agent3"
                : (e?.sourceType ?? (doc ? "document" : "import")),
            ...(e
              ? {
                  sourceType:
                    e.sourceType === "prozorro"
                      ? "prozorro_tender"
                      : e.sourceType,
                  ...(e.sourceType === "answer"
                    ? { questionId: e.sourceId }
                    : e.sourceType === "document"
                      ? { documentId: e.sourceId }
                      : {}),
                }
              : {}),
            evidence: e?.quote ?? v,
            ...(e
              ? { sourceId: e.sourceId, confidence: e.confidence }
              : doc?.documentId
                ? { sourceId: doc.documentId }
                : {}),
          };
        }
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
    for (const interpretation of agent3Result.questionAnalysis ?? []) {
      const q = final.hierarchy?.questions.find(
        (q) => q.id === interpretation.id,
      );
      const citedQuestion = raw.hierarchy?.questions.find(
        (q) => q.id === interpretation.sourceId,
      );
      const cited =
        interpretation.sourceType === "document"
          ? raw.documents?.find(
              (d) =>
                d.documentId === interpretation.sourceId &&
                d.parseStatus === "parsed",
            )?.text
          : interpretation.sourceType === "answer"
            ? citedQuestion?.answer
            : citedQuestion?.question;
      if (
        q &&
        cited &&
        interpretation.confidence >= 0.5 &&
        normalize(interpretation.quote).length >= 8 &&
        normalize(cited).includes(normalize(interpretation.quote))
      ) {
        q.classification = interpretation.classification;
        q.impact =
          interpretation.sourceType === "question"
            ? null
            : interpretation.impact;
      }
    }
    const extra = (
      [
        "warranties",
        "certificates",
        "licenses",
        "authorizationRequirements",
        "equivalentConditions",
        "configuration",
        "technicalCharacteristics",
      ] as const
    ).flatMap((k) => (agent3Result[k] ?? []).filter((v) => grounded(k, v)));
    // Keep the UI's existing three requirement sections; preserve specialized fields in Agent 3 result/evidence.
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
    if (!locked.has("specialRequirements") && extra.length)
      accept("specialRequirements", [
        ...new Set([...(final.specialRequirements ?? []), ...extra]),
      ]);
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
    if (final.aiSummary === "-") {
      // An extractive digest of already verified quotes is safe; do not accept an ungrounded LLM paraphrase.
      const excerpts = [
        ...(final.technicalRequirements ?? []).slice(0, 2),
        ...(final.qualificationRequirements ?? []).slice(0, 1),
        ...(final.specialRequirements ?? []).slice(0, 1),
      ].filter((value) =>
        raw.documents?.some(
          (d) =>
            d.parseStatus === "parsed" &&
            normalize(d.text).includes(normalize(value)),
        ),
      );
      if (excerpts.length) {
        final.aiSummary = [raw.officialTitle ?? raw.title, ...excerpts].join(
          "\n",
        );
        provenance["aiSummary"] = {
          source: "document",
          evidence: excerpts.join("\n"),
        };
      }
    }
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
