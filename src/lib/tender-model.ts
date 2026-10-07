import type { Tender } from "./demo-data.ts";
import { tenders as seed } from "./demo-data.ts";
import { detailFlow, type DetailFlow } from "./tender-detail.ts";
import { specs, documents } from "./demo-fixtures.ts";
import { tableTender } from "./worksheet-model.ts";
import { shortSubject } from "./tender-subject.ts";
const emptyFlow = (): DetailFlow => ({
  parts: [],
  technical: [],
  documents: [],
  summary: "-",
  checks: "-",
  requirements: [],
  risks: [],
  plan: [],
  delivery: "-",
});
const fixtureIds = new Set(seed.map((t) => t.id));
export type CanonicalTender = Tender &
  Required<
    Pick<
      Tender,
      | "subject"
      | "cpv"
      | "totalAmount"
      | "documents"
      | "aiSummary"
      | "risks"
      | "aiScore"
      | "analysis"
      | "statusHistory"
      | "createdAt"
      | "updatedAt"
    >
  >;
// Legacy fixtures are materialized once, never selected independently by a UI route.
export function canonicalTender(t: Tender): CanonicalTender {
  const flow =
    t.analysis ??
    (fixtureIds.has(t.id) && t.importSource !== "excel" && !t.analysisPending
      ? detailFlow(t, specs, documents)
      : emptyFlow());
  const data = tableTender(t, flow);
  const analysis = {
    ...flow,
    documents: t.documents ?? flow.documents,
    summary:
      t.aiSummary ??
      (t.analysisPending
        ? `AI аналіз ще не виконано.${t.importSource === "excel" ? " Дані отримано з Excel." : ""}`
        : flow.summary),
    risks: t.risks ?? flow.risks,
  };
  return {
    ...data,
    subject: shortSubject(
      t.subject || data.objects?.map((o) => o.name).join("; ") || t.title,
      data.objects,
    ),
    cpv: t.cpv ?? null,
    totalAmount: data.budget,
    aiScore: t.aiScore === null || t.analysisPending ? null : data.score,
    documents: analysis.documents,
    aiSummary: analysis.summary,
    risks: analysis.risks,
    analysis,
    statusHistory: data.history ?? [],
    createdAt: t.createdAt ?? t.publishedAt ?? null,
    updatedAt: t.updatedAt ?? t.statusChangedAt ?? t.commentUpdatedAt ?? null,
  };
}
export function tenderFlow(t: Tender): DetailFlow {
  const flow = t.analysis ?? emptyFlow();
  return {
    ...flow,
    documents: t.documents ?? [],
    summary: t.aiSummary ?? "-",
    risks: t.risks ?? [],
    requirements: [
      ...(t.technicalRequirements ?? []),
      ...(t.qualificationRequirements ?? []),
      ...(t.specialRequirements ?? []),
    ],
    technical: (t.technicalRequirements ?? []).map((text, i) => [
      `Вимога ${i + 1}`,
      text,
    ]),
  };
}
