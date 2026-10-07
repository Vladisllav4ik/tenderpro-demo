import { z } from "zod";
import type { Tender } from "../demo-data.ts";
import type { AgentLog } from "./contracts.ts";
import type { AgentConfig } from "./contracts.ts";
export const filterResultSchema = z
  .object({
    relevant: z.boolean(),
    confidence: z.number().finite().min(0).max(1),
    category: z.string().trim().min(1).max(80),
    object: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export type FilterTestResult = z.infer<typeof filterResultSchema>;
export const filterOutputJSONSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevant: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    category: { type: "string" },
    object: { type: "string" },
    reason: { type: "string" },
  },
  required: ["relevant", "confidence", "category", "object", "reason"],
};
const nullableText = (max: number) => z.string().max(max).nullable();
const period = z
  .object({
    start: nullableText(100),
    end: nullableText(100),
    text: nullableText(1000),
  })
  .strict()
  .nullable();
export const filterInputSchema = z
  .object({
    id: z.string().min(1).max(150),
    title: z.string().min(1).max(2000),
    cpv: nullableText(100),
    customer: z.string().min(1).max(2000),
    totalAmount: z.number().finite().nonnegative(),
    description: z.string().max(30000),
    subject: z.string().max(2000),
    quantity: z.number().finite().nonnegative().nullable(),
    unit: nullableText(100),
    positions: z
      .array(
        z
          .object({
            name: z.string().min(1).max(2000),
            quantity: z.number().finite().nonnegative().nullable(),
            unit: nullableText(100),
            brand: nullableText(200),
            catalogue: nullableText(200),
            characteristics: z.array(z.string().max(2000)).max(100),
          })
          .strict(),
      )
      .max(1000),
    documentTexts: z
      .array(
        z
          .object({
            name: z.string().max(500),
            text: z.string().max(30000),
            facts: z.array(z.string().max(2000)).max(100),
          })
          .strict(),
      )
      .max(100),
    submissionPeriod: period,
    auctionPeriod: period,
    deliveryPeriod: period,
    address: nullableText(2000),
  })
  .strict();
export type FilterTestInput = z.infer<typeof filterInputSchema>;
export const filterTestRequestSchema = z
  .object({
    input: filterInputSchema,
    provider: z.enum(["mock", "openai"]),
    configVersion: z.number().int().positive(),
  })
  .strict();
export type FilterTestRequest = z.infer<typeof filterTestRequestSchema>;
// Demo login exposes ADMIN selection; billable tests stay on the local dev server.
export const allowsPaidDemoTest = (environment: string | undefined) =>
  environment === "development";
export function matchesTestConfiguration(
  request: FilterTestRequest,
  config: AgentConfig,
) {
  return (
    request.configVersion === config.version &&
    request.provider === (config.provider ?? "mock")
  );
}
export function filterInputFromTender(t: Tender): FilterTestInput {
  const dates = (p?: { start?: string; end?: string; text?: string }) =>
    p
      ? { start: p.start ?? null, end: p.end ?? null, text: p.text ?? null }
      : null;
  // Explicit allowlist: no comments, account state, old AI results or credentials.
  return {
    id: t.id,
    title: t.title,
    cpv: t.cpv ?? null,
    customer: t.customer,
    totalAmount: t.totalAmount ?? t.budget,
    description: [
      t.description ?? "",
      ...(t.importSource === "excel"
        ? Object.entries(t.rawImport?.cells ?? {})
            .filter(([, v]) => v !== null)
            .map(([k, v]) => `${k}: ${v}`)
        : []),
    ].join("\n"),
    subject: t.subject ?? "",
    quantity: t.quantity ?? null,
    unit: t.unit ?? null,
    positions: (t.objects ?? []).map((o) => ({
      name: o.name,
      quantity: o.quantity ?? null,
      unit: o.unit ?? null,
      brand: o.brand ?? null,
      catalogue: o.catalogue ?? null,
      characteristics: o.characteristics ?? [],
    })),
    documentTexts: (t.documents ?? []).map((d) => ({
      name: d.name,
      text: d.text.slice(0,30000),
      facts: [...d.facts],
    })),
    submissionPeriod: dates(t.submissionPeriod),
    auctionPeriod: dates(t.auctionPeriod),
    deliveryPeriod: dates(t.deliveryPeriod),
    address: t.address ?? null,
  };
}
export type FilterTestReply = {
  provider: "mock" | "openai";
  model: string;
  promptVersion: string;
  tenderId: string;
  requestMade: boolean;
  log: AgentLog | null;
} & (
  | { ok: true; result: FilterTestResult }
  | { ok: false; error: string; errorCode: string }
);
