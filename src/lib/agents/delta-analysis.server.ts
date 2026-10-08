import { z } from "zod";
import type { Tender } from "../demo-data.ts";
import type { SourceDocument } from "./source-contracts.ts";
import type { AgentConfig, AgentLog } from "./contracts.ts";
import type { ChangePlan } from "./watcher-model.server.ts";
import { textDelta } from "./watcher-model.server.ts";
import { executeStructured } from "./responses.server.ts";
const fields = [
  "technicalRequirements",
  "qualificationRequirements",
  "specialRequirements",
  "risks",
] as const;
const categories = [
  "technical",
  "qualification",
  "legal",
  "delivery",
  "equivalent",
  "deadline",
  "other",
] as const;
const evidence = z
  .object({
    sourceType: z.enum(["document", "answer"]),
    sourceId: z.string(),
    quote: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export const deltaResultSchema = z
  .object({
    changes: z
      .array(
        evidence
          .extend({
            field: z.enum(fields),
            operation: z.enum(["add", "remove"]),
            value: z.string(),
          })
          .strict(),
      )
      .max(200),
    questions: z
      .array(
        z
          .object({
            id: z.string(),
            classification: z.enum(categories).nullable(),
            impact: z.enum(["low", "medium", "high"]).nullable(),
            sourceType: z.enum(["question", "answer", "document"]),
            sourceId: z.string(),
            quote: z.string(),
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(100),
    rereadDocumentIds: z.array(z.string()).max(100),
    affectedFields: z.array(z.string()).max(50),
    conclusionChanges: z
      .array(evidence.extend({ text: z.string() }).strict())
      .max(100),
  })
  .strict();
export type DeltaResult = z.infer<typeof deltaResultSchema>;
export function relevantDocumentText(
  text: string,
  queries: string[],
  max = 18000,
) {
  const words = [
    ...new Set(
      queries
        .join(" ")
        .toLocaleLowerCase("uk-UA")
        .match(/[\p{L}\p{N}]{6,}/gu) ?? [],
    ),
  ];
  const paragraphs = text.split(/\n|(?<=[.!?])\s+/u);
  const selected = paragraphs
    .map((value, index) => ({
      value,
      index,
      score:
        words.filter((w) => value.toLocaleLowerCase("uk-UA").includes(w))
          .length +
        (/еквівалент|локаліза|нато|технічн|кваліфікац|змін/iu.test(value)
          ? 1
          : 0),
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
  const indexes = new Set<number>();
  let length = 0;
  for (const p of selected) {
    if (length + p.value.length > max) continue;
    for (
      let i = Math.max(0, p.index - 1);
      i <= Math.min(paragraphs.length - 1, p.index + 1);
      i++
    )
      if (!indexes.has(i) && length + paragraphs[i]!.length <= max) {
        indexes.add(i);
        length += paragraphs[i]!.length;
      }
  }
  return indexes.size
    ? [...indexes]
        .sort((a, b) => a - b)
        .map((i) => paragraphs[i])
        .join("\n[…]\n")
    : text.slice(0, max);
}
const string = { type: "string" },
  confidence = { type: "number", minimum: 0, maximum: 1 };
const evidenceProperties = {
  sourceType: { type: "string", enum: ["document", "answer"] },
  sourceId: string,
  quote: string,
  confidence,
};
const obj = (properties: object) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const jsonSchema = obj({
  changes: {
    type: "array",
    items: obj({
      ...evidenceProperties,
      field: { type: "string", enum: fields },
      operation: { type: "string", enum: ["add", "remove"] },
      value: string,
    }),
  },
  questions: {
    type: "array",
    items: obj({
      id: string,
      classification: { type: ["string", "null"], enum: [...categories, null] },
      impact: {
        type: ["string", "null"],
        enum: ["low", "medium", "high", null],
      },
      sourceType: { type: "string", enum: ["question", "answer", "document"] },
      sourceId: string,
      quote: string,
      confidence,
    }),
  },
  rereadDocumentIds: { type: "array", items: string },
  affectedFields: { type: "array", items: string },
  conclusionChanges: {
    type: "array",
    items: obj({ ...evidenceProperties, text: string }),
  },
});
export function buildDeltaInput(
  t: Tender,
  plan: ChangePlan,
  oldDocs: SourceDocument[],
  docs: SourceDocument[],
) {
  const qs =
    t.hierarchy?.questions.filter(
      (q) => plan.questions.includes(q.id) || plan.answers.includes(q.id),
    ) ?? [];
  const documents = docs
    .filter((d) => plan.documents.includes(d.documentId))
    .map((d) => ({
      documentId: d.documentId,
      lotId: d.lotId ?? null,
      sourceUrl: d.url,
      parseStatus: d.parseStatus,
      ...textDelta(
        oldDocs.find((p) => p.documentId === d.documentId)?.text ?? "",
        d.text,
      ),
    }));
  const scope = [
    ...documents.map((d) => `document:${d.documentId}`),
    ...qs.map((q) => `question:${q.id}`),
    ...plan.removedDocuments.map((id) => `removed-document:${id}`),
  ];
  return {
    id: t.id,
    source: {
      title: t.officialTitle ?? t.title,
      description: t.description ?? null,
      items: t.hierarchy?.items ?? [],
      lots: t.hierarchy?.lots ?? [],
      revisions: t.hierarchy?.revisions ?? [],
    },
    oldRelevantRequirements: {
      technicalRequirements: t.technicalRequirements ?? [],
      qualificationRequirements: t.qualificationRequirements ?? [],
      specialRequirements: t.specialRequirements ?? [],
    },
    documentReferences: docs
      .filter(
        (d) =>
          !d.lotId ||
          !qs.length ||
          qs.some((q) => !q.lotId || q.lotId === d.lotId),
      )
      .map((d) => ({
        documentId: d.documentId,
        name: d.name,
        sourceUrl: d.url,
        lotId: d.lotId ?? null,
        dateModified: d.dateModified,
        parseStatus: d.parseStatus,
      })),
    documents,
    questions: qs,
    removedDocuments: plan.removedDocuments,
    reasons: plan.reasons,
    scope,
  };
}
export async function executeDelta(
  input: ReturnType<typeof buildDeltaInput>,
  config: AgentConfig,
  accountId: string,
  sink: (l: AgentLog) => Promise<void>,
) {
  if (!config.enabled || config.provider !== "openai")
    throw new Error("Для delta analysis потрібен увімкнений реальний Agent 3.");
  return executeStructured(
    input,
    {
      ...config,
      systemPrompt:
        config.systemPrompt +
        "\nDELTA ONLY. Use only supplied changed fragments and Q&A. A participant question is a claim, never a confirmed fact. Buyer promises of document changes are not revised requirements. Do not invent impact: null without cited evidence. Return only source-exact requirement changes with sourceId and exact quote. Existing requirements are context, not new evidence. remove requires explicit superseding source evidence. Do not rewrite structured/imported values. Unknown = null/empty array. Recommend document reread only by supplied actual document id. conclusionChanges must be extractive source quotes.",
    },
    accountId,
    sink,
    deltaResultSchema,
    jsonSchema,
    "tender_delta",
  );
}
const normalized = (v: string) =>
  v
    .toLocaleLowerCase("uk-UA")
    .replace(/[’ʼ`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
export function mergeDelta(
  t: Tender,
  result: DeltaResult,
  docs: SourceDocument[],
): { tender: Tender; warnings: string[] } {
  const tender = structuredClone(t),
    warnings: string[] = [];
  const source = (type: string, id: string) =>
    type === "document"
      ? docs.find((d) => d.documentId === id)?.text
      : tender.hierarchy?.questions.find((q) => q.id === id)?.[
          type === "answer" ? "answer" : "question"
        ];
  const verified = (
    v: {
      sourceType: string;
      sourceId: string;
      quote: string;
      confidence: number;
    },
    value?: string,
  ) => {
    const text = source(v.sourceType, v.sourceId);
    return (
      !!text &&
      v.confidence >= 0.5 &&
      normalized(v.quote).length >= 8 &&
      normalized(text).includes(normalized(v.quote)) &&
      (!value || normalized(v.quote).includes(normalized(value)))
    );
  };
  for (const c of result.changes) {
    if (
      !verified(c, c.value) ||
      (c.sourceType === "answer" &&
        tender.hierarchy?.questions.find((q) => q.id === c.sourceId)
          ?.changeClaimed &&
        !tender.hierarchy.questions.find((q) => q.id === c.sourceId)
          ?.changeVerified) ||
      (t.sourceFields ?? []).includes(c.field) ||
      (c.operation === "remove" &&
        !/(скасован|виключ|замін|не вимага|нова редакц)/iu.test(c.quote))
    ) {
      warnings.push(`Delta ${c.field}: немає достатнього evidence.`);
      continue;
    }
    const values = tender[c.field] ?? [];
    tender[c.field] =
      c.operation === "add"
        ? [...new Set([...values, c.value])]
        : values.filter((v) => normalized(v) !== normalized(c.value));
    tender.provenance ??= {};
    tender.provenance[`${c.field}:${c.value}`] = {
      source: c.sourceType === "document" ? "document" : "agent3",
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      ...(c.sourceType === "document"
        ? { documentId: c.sourceId }
        : { questionId: c.sourceId }),
      evidence: c.quote,
      confidence: c.confidence,
    };
  }
  for (const c of result.questions) {
    const q = tender.hierarchy?.questions.find((q) => q.id === c.id);
    if (!q || !verified(c)) continue;
    q.classification = c.classification;
    // Question wording alone does not establish actual impact.
    q.impact = c.sourceType === "question" ? null : c.impact;
  }
  const quotes = result.conclusionChanges
    .filter((c) => verified(c, c.text))
    .map((c) => c.text);
  if (quotes.length)
    tender.aiSummary = [
      tender.aiSummary && tender.aiSummary !== "-" ? tender.aiSummary : "",
      ...quotes.map((q) => `Уточнення джерела: ${q}`),
    ]
      .filter(Boolean)
      .join("\n");
  return { tender, warnings };
}
