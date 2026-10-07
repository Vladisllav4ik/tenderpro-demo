import type { Tender } from "../demo-data.ts";
import { canonicalTender } from "../tender-model.ts";
import { recordEvent, recalculateTender } from "../tender-workflow.ts";
// A response must not overwrite edits or lifecycle changes made during the request.
export function mergeAgentResult(current: Tender, response: Tender): Tender {
  const merged = {
    ...current,
    title: response.title,
    subject: response.subject ?? current.subject ?? current.title,
    category: response.category,
    topCategory: response.topCategory,
    ...(response.relevance ? { relevance: response.relevance } : {}),
    ...(response.relevanceReason
      ? { relevanceReason: response.relevanceReason }
      : {}),
    objects: response.objects ?? current.objects ?? [],
    technicalRequirements: response.technicalRequirements ?? [],
    qualificationRequirements: response.qualificationRequirements ?? [],
    specialRequirements: response.specialRequirements ?? [],
    documents: response.documents ?? current.documents ?? [],
    aiSummary: response.aiSummary ?? "-",
    risks: response.risks ?? [],
    aiScore: response.aiScore ?? null,
    ...(response.analysis ? { analysis: response.analysis } : {}),
    analysisPending:
      response.analysisPending ?? current.analysisPending ?? false,
    updatedAt: new Date().toISOString(),
  };
  return canonicalTender(
    recalculateTender(
      recordEvent(merged, "agent-processing", "Виконано mock-обробку агентами"),
    ),
  );
}
