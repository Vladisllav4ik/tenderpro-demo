import type { Tender } from "./demo-data";

export type DetailDocument = {
  documentId?: string;
  url?: string;
  mimeType?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  downloadStatus?: "pending" | "downloaded" | "failed";
  parseStatus?: "pending" | "parsed" | "failed";
  error?: string | null;
  name: string;
  kind: string;
  facts: readonly string[];
  sources: readonly string[];
  text: string;
};
export type PartSpec = {
  code: string;
  brand: string;
  name: string;
  qty: number;
  match: string;
  status: string;
};
export type DetailFlow = {
  parts: readonly PartSpec[];
  technical: string[][];
  documents: readonly DetailDocument[];
  summary: string;
  checks: string;
  requirements: string[];
  risks: string[];
  plan: string[];
  delivery: string;
};

// Source-only detail flow. No model/category fixtures or synthetic documents.
export function detailFlow(t: Tender): DetailFlow {
  return {
    parts: [],
    technical: (t.technicalRequirements ?? []).map((x, i) => [
      `Вимога ${i + 1}`,
      x,
    ]),
    documents: t.documents ?? [],
    summary: t.aiSummary ?? "-",
    checks: "-",
    requirements: [
      ...(t.technicalRequirements ?? []),
      ...(t.qualificationRequirements ?? []),
      ...(t.specialRequirements ?? []),
    ],
    risks: t.risks ?? [],
    plan: [],
    delivery: t.deliveryPeriod?.text ?? t.deliveryPeriod?.end ?? "-",
  };
}
