import {
  executeStructured,
  type ResponseDependencies,
} from "./responses.server.ts";
import type { AgentConfig, AgentLog } from "./contracts.ts";
import { FilterAgentService } from "./mock-services.ts";
import {
  filterInputSchema,
  filterResultSchema,
  filterOutputJSONSchema,
  type FilterTestInput,
  type FilterTestReply,
} from "./filter-test-contract.ts";
import { sanitizeSnapshot } from "./snapshots.server.ts";
import { randomUUID } from "node:crypto";
const messages = {
  disabled: "Agent 2 вимкнено. Увімкніть і збережіть конфігурацію.",
  input: "Некоректні або завеликі базові дані тендера.",
  storage: "Не вдалося записати технічний журнал.",
};
type FailureCode = keyof typeof messages;
export async function executeFilterTest(
  raw: unknown,
  config: AgentConfig,
  accountId: string,
  record: (log: AgentLog) => Promise<void>,
  dependencies: ResponseDependencies = {},
): Promise<FilterTestReply> {
  const provider = config.provider ?? "mock";
  const meta = {
    provider,
    model: config.model,
    promptVersion: config.promptVersion,
    tenderId: "",
    requestMade: false,
    log: null as AgentLog | null,
  };
  const failure = (code: FailureCode): FilterTestReply => ({
    ...meta,
    ok: false,
    errorCode: code,
    error: messages[code],
  });
  if (!config.enabled) return failure("disabled");
  const parsed = filterInputSchema.safeParse(raw);
  if (!parsed.success || JSON.stringify(parsed.data).length > 150000)
    return failure("input");
  const input = parsed.data;
  if (JSON.stringify(sanitizeSnapshot(input)) !== JSON.stringify(input))
    return failure("input");
  const runId = randomUUID();
  meta.tenderId = input.id;
  if (provider === "mock") {
    const start = Date.now();
    const tender = {
      id: input.id,
      title: input.title,
      customer: input.customer,
      budget: input.totalAmount,
      cpv: input.cpv,
      description: input.description,
      subject: input.subject,
      objects: input.positions.map((p) => ({
        name: p.name,
        ...(p.quantity !== null ? { quantity: p.quantity } : {}),
        ...(p.unit !== null ? { unit: p.unit } : {}),
        characteristics: p.characteristics,
      })),
      documents: input.documentTexts.map((d) => ({
        ...d,
        kind: "text",
        sources: [],
      })),
      topCategory: "Інше" as const,
      category: "Інше",
      deadline: "",
      region: "",
      priority: "C" as const,
      score: 0,
      status: "NEW",
      manager: "",
      stage: "",
      recommendation: "",
    };
    const output = await new FilterAgentService().execute(tender);
    const result = filterResultSchema.parse({
      relevant: output.accepted,
      confidence: output.accepted ? 0.5 : 0.9,
      category: output.tender.category,
      object: (output.tender.subject || output.tender.title).slice(0, 500),
      reason: output.reason,
    });
    const at = new Date().toISOString();
    const log: AgentLog = {
      id: randomUUID(),
      runId,
      agentId: "filter",
      accountId,
      at,
      timestamp: at,
      provider: "mock",
      mock: true,
      tenderId: input.id,
      model: "deterministic-mock",
      durationMs: Date.now() - start,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      status: "success",
      processed: 1,
      errors: 0,
      estimatedUsage: 0,
      message: "Тест одного тендера: mock, зовнішній API не викликався",
      promptVersion: config.promptVersion,
      pipelineId: null,
      agentName: config.name,
      startedAt: new Date(start).toISOString(),
      finishedAt: at,
      inputSnapshot: sanitizeSnapshot(input),
      outputSnapshot: sanitizeSnapshot(result),
      error: null,
      requestId: null,
      responseId: null,
    };
    meta.model = "deterministic-mock";
    meta.log = log;
    try {
      await record(log);
    } catch {
      return failure("storage");
    }
    return { ...meta, ok: true, result };
  }
  return executeStructured(
    input,
    config,
    accountId,
    record,
    filterResultSchema,
    filterOutputJSONSchema,
    "tender_filter_test",
    dependencies,
  );
}
