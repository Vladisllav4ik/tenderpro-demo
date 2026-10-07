import { z } from "zod";
import type { Tender } from "../demo-data.ts";
import type { AgentId, AgentLog, JsonValue } from "./contracts.ts";
import {
  filterInputFromTender,
  filterInputSchema,
  filterResultSchema,
} from "./filter-test-contract.ts";
import { deadlineDate } from "../tender-period.ts";

const text = z.string().max(30000);
const nullableText = text.nullable();
const amount = z.number().finite().nonnegative().nullable();
const list = z.array(z.string().max(4000)).max(200);
const metadata = z.record(
  z.string().max(100),
  z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()]),
);
export const collectorResultSchema = z
  .object({
    tenderId: z.string().min(1).max(150),
    source: z.string().min(1).max(100),
    sourceTenderId: z.string().min(1).max(150),
    title: text,
    buyer: text,
    amount,
    currency: nullableText,
    cpv: nullableText,
    publicationDate: nullableText,
    submissionDeadline: nullableText,
    sourceUrl: nullableText,
    rawMetadata: metadata,
  })
  .strict();
export type CollectedTender = z.infer<typeof collectorResultSchema>;
export const tenderDocumentInputSchema = z
  .object({
    documentId: z.string().min(1).max(150),
    name: z.string().max(500),
    mimeType: z.string().max(150).nullable(),
    sourceUrl: nullableText,
    extractedText: text,
    metadata,
  })
  .strict();
export type TenderDocumentInput = z.infer<typeof tenderDocumentInputSchema>;
export const analyzerInputSchema = z
  .object({
    base: filterInputSchema,
    classification: filterResultSchema,
    documents: z.array(tenderDocumentInputSchema).max(100),
    metadata,
    knownFields: z
      .object({
        unitPrice: amount,
        specialRequirements: list,
        technicalRequirements: list,
        qualificationRequirements: list,
      })
      .strict(),
    sourceData: z.record(z.unknown()).optional(),
    documentMetadata: z
      .array(
        z
          .object({
            documentId: z.string(),
            name: z.string(),
            mimeType: nullableText,
            sourceUrl: nullableText,
            parseStatus: z.string(),
            downloadStatus: z.string(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export type AnalyzerInput = z.infer<typeof analyzerInputSchema>;
export const analyzerResultSchema = z
  .object({
    object: z.string().min(1).max(2000),
    quantity: amount,
    unit: nullableText,
    unitPrice: amount,
    totalAmount: amount,
    currency: nullableText,
    submissionDeadline: nullableText,
    auctionDateTime: nullableText,
    deliveryDeadline: nullableText,
    deliveryAddress: nullableText,
    specialRequirements: list,
    technicalRequirements: list,
    qualificationRequirements: list,
    requiredDocuments: list,
    risks: list,
    aiSummary: text,
    warranties: list.optional(),
    certificates: list.optional(),
    licenses: list.optional(),
    authorizationRequirements: list.optional(),
    equivalentConditions: list.optional(),
    configuration: list.optional(),
    technicalCharacteristics: list.optional(),
    evidence: z
      .array(
        z
          .object({
            field: z.string().max(100),
            value: z.string().max(4000),
            sourceType: z.enum(["import", "prozorro", "document"]),
            sourceId: z.string().max(300),
            quote: z.string().max(4000),
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(200)
      .optional(),
  })
  .strict();
export type AnalyzerResult = z.infer<typeof analyzerResultSchema>;
export const lifecycleStatuses = [
  "NEW",
  "WAITING",
  "IN_PROGRESS",
  "NOT_PARTICIPATING",
  "NOT_SUBMITTED",
  "SUBMITTED",
  "DISQUALIFIED",
  "WON",
  "LOST",
  "CANCELLED",
  "COMPLETED",
  "NEEDS_REVIEW",
] as const;
export const statusInputSchema = z
  .object({
    id: z.string().min(1).max(150),
    currentStatus: z.string().max(100),
    sourceStatus: z
      .enum([
        "active",
        "cancelled",
        "awarded",
        "disqualified",
        "rejected",
        "closed",
      ])
      .nullable(),
    submissionDeadline: z.string().max(100).nullable(),
    auctionDateTime: nullableText,
    participation: z.enum(["submitted", "not-submitted", "unknown"]),
    result: z.enum(["pending", "won", "lost"]),
    previousStatus: nullableText,
    contextUpdatedAt: z.string().datetime().nullable(),
    directorComment: text,
    commentHistory: list,
    events: list,
  })
  .strict();
export type LifecycleInput = z.infer<typeof statusInputSchema>;
export const statusResultSchema = z
  .object({
    status: z.enum(lifecycleStatuses),
    confidence: z.number().finite().min(0).max(1),
    reason: z.string().min(1).max(2000),
    decisionSource: z.enum(["rule-based", "mock", "openai"]),
    eventType: z.string().min(1).max(150),
    evaluatedAt: z.string().datetime(),
  })
  .strict();
export type LifecycleResult = z.infer<typeof statusResultSchema>;
export const pipelineStates = [
  "RAW",
  "COLLECTED",
  "CLASSIFICATION_PENDING",
  "CLASSIFIED",
  "ANALYSIS_PENDING",
  "ANALYZED",
  "READY",
  "MONITORING",
  "NEEDS_REVIEW",
  "REJECTED",
  "ERROR",
] as const;
export type PipelineState = (typeof pipelineStates)[number];
export const pipelineSettingsSchema = z
  .object({
    autoAcceptThreshold: z.number().finite().min(0).max(1),
    reviewThreshold: z.number().finite().min(0).max(1),
  })
  .strict()
  .refine((v) => v.reviewThreshold <= v.autoAcceptThreshold);
export type PipelineSettings = z.infer<typeof pipelineSettingsSchema>;
// Draft values support the existing deterministic classifier's 0.5 confidence.
export const defaultPipelineSettings: PipelineSettings = {
  autoAcceptThreshold: 0.5,
  reviewThreshold: 0.3,
};
export type StageResult = {
  cached?: boolean;
  agentId: AgentId;
  status: "success" | "error" | "skipped";
  result?: JsonValue;
  reason?: string;
  provider?: string;
};
export type PipelineRecord = {
  pipelineId: string;
  accountId: string;
  tenderId: string;
  startedAt: string;
  finishedAt: string | null;
  currentStage: PipelineState;
  status: "running" | "success" | "review" | "rejected" | "error";
  transitions: { state: PipelineState; at: string }[];
  stages: StageResult[];
  runs: AgentLog[];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  unknownUsage: boolean;
  // No guessed prices: configure a model price catalog later.
  cost: {
    amount: number | null;
    currency: "USD";
    pricingVersion: string | null;
  };
  thresholds: PipelineSettings;
};
export type AgentTestRequest = {
  tender: Tender;
  agentId?: AgentId;
  configVersions: Record<AgentId, number>;
  settings?: PipelineSettings;
};
export function lifecycleInputFromTender(t: Tender): LifecycleInput {
  const deadline = t.submissionPeriod?.end ?? deadlineDate(t.deadline);
  return {
    id: t.id,
    currentStatus: t.status,
    sourceStatus: t.lifecycle?.state ?? null,
    submissionDeadline: deadline ?? null,
    auctionDateTime: t.auctionPeriod?.start ?? null,
    participation:
      t.lifecycle?.participation ??
      (t.stage === "Подано" || t.status === "WAITING_DECISION"
        ? "submitted"
        : "unknown"),
    result: t.lifecycle?.decision ?? "pending",
    previousStatus: t.previousStatus ?? null,
    contextUpdatedAt:
      [t.commentUpdatedAt, t.lifecycle?.updatedAt, t.updatedAt]
        .filter(
          (v): v is string =>
            typeof v === "string" &&
            Number.isFinite(Date.parse(v)) &&
            /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v),
        )
        .sort()
        .at(-1) ?? null,
    directorComment: t.commentText ?? t.comment ?? "",
    commentHistory: (t.history ?? [])
      .filter((h) => h.kind === "comment")
      .map((h) => h.text)
      .slice(-200),
    events: (t.history ?? [])
      .map((h) => `${h.at}: ${h.kind}: ${h.text}`)
      .slice(-200),
  };
}
export function analyzerInputFromTender(
  t: Tender,
  classification: AnalyzerInput["classification"],
): AnalyzerInput {
  const base = filterInputFromTender(t);
  base.documentTexts = [];
  const parsed = (t.documents ?? []).filter(
    (d) => d.parseStatus === undefined || d.parseStatus === "parsed",
  );
  const limit = Math.min(18000, Math.floor(90000 / Math.max(parsed.length, 1)));
  return {
    base,
    classification,
    metadata: {},
    knownFields: {
      unitPrice: t.unitPrice ?? null,
      specialRequirements: t.specialRequirements ?? [],
      technicalRequirements: t.technicalRequirements ?? [],
      qualificationRequirements: t.qualificationRequirements ?? [],
    },
    documents: parsed.map((d, i) => ({
      documentId: d.documentId ?? `${t.id}:${i}`,
      name: d.name,
      mimeType: d.mimeType ?? null,
      sourceUrl: d.url ?? null,
      extractedText: d.text.slice(0, limit),
      metadata: { kind: d.kind, excerptTruncated: d.text.length > limit },
    })),
  };
}
// OpenAI strict output schemas: every field required, unknown scalars nullable.
const strictObject = (properties: Record<string, object>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const string = { type: "string" };
const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"], minimum: 0 };
const strings = { type: "array", items: string };
export const analyzerOutputJSONSchema = strictObject({
  object: string,
  quantity: nullableNumber,
  unit: nullableString,
  unitPrice: nullableNumber,
  totalAmount: nullableNumber,
  currency: nullableString,
  submissionDeadline: nullableString,
  auctionDateTime: nullableString,
  deliveryDeadline: nullableString,
  deliveryAddress: nullableString,
  specialRequirements: strings,
  technicalRequirements: strings,
  qualificationRequirements: strings,
  requiredDocuments: strings,
  risks: strings,
  aiSummary: string,
  warranties: strings,
  certificates: strings,
  licenses: strings,
  authorizationRequirements: strings,
  equivalentConditions: strings,
  configuration: strings,
  technicalCharacteristics: strings,
  evidence: {
    type: "array",
    items: strictObject({
      field: string,
      value: string,
      sourceType: { type: "string", enum: ["import", "prozorro", "document"] },
      sourceId: string,
      quote: string,
      confidence: { type: "number", minimum: 0, maximum: 1 },
    }),
  },
});
export const statusOutputJSONSchema = strictObject({
  status: { type: "string", enum: [...lifecycleStatuses] },
  confidence: { type: "number", minimum: 0, maximum: 1 },
  reason: string,
  decisionSource: { type: "string", enum: ["openai"] },
  eventType: string,
  evaluatedAt: { type: "string", format: "date-time" },
});
