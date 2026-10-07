import type { Tender } from "../demo-data.ts";
import type { AgentConfig, AgentLog, AgentService } from "./contracts.ts";
import {
  collectorResultSchema,
  analyzerInputSchema,
  analyzerResultSchema,
  analyzerOutputJSONSchema,
  statusInputSchema,
  statusResultSchema,
  statusOutputJSONSchema,
  type CollectedTender,
  type AnalyzerInput,
  type AnalyzerResult,
  type LifecycleInput,
  type LifecycleResult,
} from "./system-contracts.ts";
import {
  executeStructured,
  type ResponseDependencies,
} from "./responses.server.ts";
import { exactTimestamp } from "../tender-period.ts";
import { z } from "zod";

export interface CollectorConnector {
  collect(tender: Tender, signal: AbortSignal): Promise<CollectedTender>;
}
export class MockCollectorConnector implements CollectorConnector {
  async collect(t: Tender) {
    return collectorResultSchema.parse({
      tenderId: t.id,
      source: "mock",
      sourceTenderId: t.id,
      title: t.title,
      buyer: t.customer,
      amount: t.totalAmount ?? t.budget,
      currency: null,
      cpv: t.cpv ?? null,
      publicationDate: t.publishedAt ?? null,
      submissionDeadline: t.submissionPeriod?.end ?? t.deadline ?? null,
      sourceUrl: t.sourceUrl ?? null,
      rawMetadata: { fixture: true },
    });
  }
}
export class CollectorService implements AgentService<Tender, CollectedTender> {
  private connector: CollectorConnector;
  private config: AgentConfig;
  constructor(config: AgentConfig, connector?: CollectorConnector) {
    this.config = config;
    if (config.source === "data-source" && !connector)
      throw new Error("Data-source connector ще не підключено.");
    this.connector = connector ?? new MockCollectorConnector();
  }
  async execute(t: Tender) {
    if (!this.config.enabled) throw new Error("Collector вимкнено.");
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const output = await Promise.race([
          this.connector.collect(t, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("Collector: час очікування вичерпано."));
            }, this.config.limits.timeout * 1000);
          }),
        ]);
        const parsed = collectorResultSchema.parse(output);
        if (parsed.tenderId !== t.id)
          throw new Error("Collector повернув інший tenderId.");
        return parsed;
      } catch {
        if (attempt >= this.config.limits.retries)
          throw new Error(
            "Collector: джерело недоступне або дані не відповідають схемі.",
          );
      } finally {
        clearTimeout(timer);
      }
    }
  }
}
export class AnalyzerService {
  async execute(
    raw: unknown,
    config: AgentConfig,
    accountId: string,
    record: (log: AgentLog) => Promise<void>,
    dependencies: ResponseDependencies = {},
  ) {
    const input = analyzerInputSchema.parse(raw);
    if (!config.enabled) throw new Error("Analyzer вимкнено.");
    if (!input.classification.relevant)
      throw new Error("Analyzer потребує прийнятого результату Classifier.");
    if (config.provider === "openai")
      return executeStructured(
        { id: input.base.id, ...input },
        config,
        accountId,
        record,
        analyzerResultSchema,
        analyzerOutputJSONSchema,
        "tender_analyzer",
        dependencies,
      );
    return {
      ok: true as const,
      result: mockAnalysis(input),
      provider: "mock" as const,
      requestMade: false,
    };
  }
}
function mockAnalysis(input: AnalyzerInput): AnalyzerResult {
  const b = input.base;
  return analyzerResultSchema.parse({
    object: input.classification.object,
    quantity: b.quantity,
    unit: b.unit,
    unitPrice: input.knownFields.unitPrice,
    totalAmount: b.totalAmount,
    currency:
      typeof input.metadata["currency"] === "string"
        ? input.metadata["currency"]
        : null,
    submissionDeadline: b.submissionPeriod?.end ?? null,
    auctionDateTime: b.auctionPeriod?.start ?? null,
    deliveryDeadline: b.deliveryPeriod?.end ?? null,
    deliveryAddress: b.address,
    specialRequirements: input.knownFields.specialRequirements,
    technicalRequirements: [
      ...input.knownFields.technicalRequirements,
      ...b.positions.flatMap((p) => p.characteristics),
    ].slice(0, 200),
    qualificationRequirements: input.knownFields.qualificationRequirements,
    requiredDocuments: [],
    risks: [],
    aiSummary:
      "Mock preview: структуровано доступні поля; невідоме залишено null або порожнім.",
  });
}
export function evaluateLifecycleRules(
  input: LifecycleInput,
  now = new Date(),
): LifecycleResult | null {
  const result = (
    status: LifecycleResult["status"],
    reason: string,
    eventType: string,
  ): LifecycleResult => ({
    status,
    confidence: 1,
    reason,
    eventType,
    decisionSource: "rule-based",
    evaluatedAt: now.toISOString(),
  });
  if (input.sourceStatus === "cancelled")
    return result(
      "CANCELLED",
      "Джерело повідомляє про скасування.",
      "source.cancelled",
    );
  if (input.sourceStatus === "disqualified")
    return result(
      "DISQUALIFIED",
      "Надано явний факт дискваліфікації.",
      "source.disqualified",
    );
  if (
    input.result === "won" &&
    ["awarded", "closed"].includes(input.sourceStatus ?? "")
  )
    return result(
      "WON",
      "Процедуру завершено і нашу перемогу підтверджено.",
      "result.won",
    );
  if (input.result === "lost")
    return result(
      "LOST",
      "Надано підтверджений результат: не перемогли.",
      "result.lost",
    );
  const stamp = exactTimestamp(input.submissionDeadline ?? undefined);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Kyiv",
  }).format(now);
  const date = input.submissionDeadline;
  const expired =
    stamp !== null
      ? stamp <= now.getTime()
      : !!date &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isFinite(Date.parse(date)) &&
        new Date(date).toISOString().slice(0, 10) === date &&
        date < today;
  // Missing participation is not evidence of a missed submission.
  if (expired && input.participation === "not-submitted")
    return result(
      "NOT_SUBMITTED",
      "Строк минув; явно підтверджено, що заявку не подано.",
      "deadline.missed",
    );
  if (input.participation === "submitted" && !input.directorComment.trim())
    return result(
      "SUBMITTED",
      "Подання підтверджено; очікуємо рішення.",
      "participation.submitted",
    );
  return null;
}
export class LifecycleService {
  async execute(
    raw: unknown,
    config: AgentConfig,
    accountId: string,
    record: (log: AgentLog) => Promise<void>,
    dependencies: ResponseDependencies = {},
    now = new Date(),
  ) {
    const input = statusInputSchema.parse(raw);
    if (!config.enabled) throw new Error("Lifecycle вимкнено.");
    const ruled = evaluateLifecycleRules(input, now);
    if (ruled)
      return {
        ok: true as const,
        result: ruled,
        provider: "rule-based" as const,
        requestMade: false,
      };
    const mode = config.mode ?? "rule-based";
    if (mode === "openai" || mode === "hybrid") {
      // Validation failures are logged as failures by the shared transport.
      const schema = statusResultSchema.extend({
        decisionSource: z.literal("openai"),
        evaluatedAt: z.literal(now.toISOString()),
      });
      return executeStructured(
        { ...input, evaluatedAt: now.toISOString() },
        config,
        accountId,
        record,
        schema,
        statusOutputJSONSchema,
        "tender_lifecycle",
        dependencies,
      );
    }
    const source = mode === "mock" ? "mock" : "rule-based";
    return {
      ok: true as const,
      provider: source,
      requestMade: false,
      result: statusResultSchema.parse({
        status: "NEEDS_REVIEW",
        confidence: 0,
        reason:
          mode === "mock"
            ? "Mock: неоднозначний контекст потребує перегляду."
            : "Однозначне правило відсутнє; потрібен ручний перегляд або AI fallback.",
        decisionSource: source,
        eventType: "context.ambiguous",
        evaluatedAt: now.toISOString(),
      }),
    };
  }
}
