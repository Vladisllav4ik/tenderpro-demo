import type { AgentConfig, AgentLog } from "./contracts.ts";
import { FilterAgentService } from "./mock-services.ts";
import {
  filterInputSchema,
  filterResultSchema,
  filterOutputJSONSchema,
  type FilterTestInput,
  type FilterTestReply,
} from "./filter-test-contract.ts";
import { getOpenAIKey } from "./openai-env.server.ts";
import { randomUUID } from "node:crypto";
const messages = {
  disabled: "Agent 2 вимкнено. Увімкніть і збережіть конфігурацію.",
  input: "Некоректні або завеликі базові дані тендера.",
  model: "Модель OpenAI некоректна або недоступна для цього проєкту.",
  key_missing: "На сервері відсутній OPENAI_API_KEY.",
  auth: "OpenAI відхилив ключ або доступ до API. Перевірте серверну конфігурацію.",
  balance: "Недостатньо API balance або вичерпано квоту OpenAI.",
  rate_limit: "OpenAI тимчасово обмежив частоту запитів. Спробуйте пізніше.",
  network: "Не вдалося з’єднатися з OpenAI.",
  timeout: "Час очікування OpenAI вичерпано.",
  invalid_output: "OpenAI повернув результат, який не відповідає схемі.",
  incomplete: "OpenAI не завершив відповідь. Перевірте maxTokens.",
  refusal: "Модель відмовилась обробляти цей запит.",
  api: "Помилка OpenAI API. Спробуйте пізніше.",
  storage: "Не вдалося записати технічний журнал.",
} as const;
type FailureCode = keyof typeof messages;
class SafeFailure extends Error {
  code: FailureCode;
  retryable: boolean;
  constructor(code: FailureCode, retryable = false) {
    super(messages[code]);
    this.code = code;
    this.retryable = retryable;
  }
}
type Dependencies = {
  request?: typeof fetch;
  apiKey?: () => string | undefined;
  sleep?: (ms: number) => Promise<void>;
};
const nonnegative = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
function usageFrom(body: any) {
  return {
    inputTokens: nonnegative(body?.usage?.input_tokens),
    outputTokens: nonnegative(body?.usage?.output_tokens),
    totalTokens: nonnegative(body?.usage?.total_tokens),
    cachedInputTokens: nonnegative(
      body?.usage?.input_tokens_details?.cached_tokens,
    ),
    reasoningTokens: nonnegative(
      body?.usage?.output_tokens_details?.reasoning_tokens,
    ),
  };
}
function apiFailure(status: number, body: any): SafeFailure {
  // Never expose provider error.message, request bodies, headers or stack traces.
  const code = body?.error?.code;
  if (
    code === "insufficient_quota" ||
    code === "billing_hard_limit_reached" ||
    code === "billing_not_active" ||
    status === 402
  )
    return new SafeFailure("balance");
  if (status === 401 || status === 403) return new SafeFailure("auth");
  if (status === 404 || code === "model_not_found")
    return new SafeFailure("model");
  if (status === 429) return new SafeFailure("rate_limit", true);
  return new SafeFailure("api", status >= 500);
}
function safeIdentifier(value: unknown, prefix: string, key: string) {
  return typeof value === "string" &&
    value.startsWith(prefix) &&
    /^[A-Za-z0-9_-]{1,150}$/.test(value) &&
    !value.includes(key)
    ? value
    : undefined;
}
function parseOutput(body: any, key: string) {
  if (body?.status === "incomplete") throw new SafeFailure("incomplete");
  if (body?.status !== "completed") throw new SafeFailure("api");
  const chunks: string[] = [];
  for (const item of Array.isArray(body.output) ? body.output : []) {
    if (item?.type !== "message") continue;
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if (content?.type === "refusal") throw new SafeFailure("refusal");
      if (content?.type === "output_text" && typeof content.text === "string")
        chunks.push(content.text);
    }
  }
  try {
    const raw = chunks.join("");
    if (!raw || raw.includes(key) || raw.length > 10000) throw new Error();
    return filterResultSchema.parse(JSON.parse(raw));
  } catch {
    throw new SafeFailure("invalid_output");
  }
}
export async function executeFilterTest(
  raw: unknown,
  config: AgentConfig,
  accountId: string,
  record: (log: AgentLog) => Promise<void>,
  dependencies: Dependencies = {},
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
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(config.model) ||
    config.model === "deterministic-mock" ||
    /^sk-/i.test(config.model)
  )
    return failure("model");
  const key = (dependencies.apiKey ?? getOpenAIKey)();
  if (!key) return failure("key_missing");
  // Defense in depth: secrets must not be included in prompts or tender text either.
  if (
    config.systemPrompt.includes(key) ||
    JSON.stringify(input).includes(key)
  ) {
    meta.tenderId = "";
    return failure("input");
  }
  const request = dependencies.request ?? fetch;
  const sleep =
    dependencies.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt <= config.limits.retries; attempt++) {
    const start = Date.now(),
      at = new Date().toISOString();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      config.limits.timeout * 1000,
    );
    let body: any = null,
      requestId: string | undefined,
      responseId: string | undefined,
      result: ReturnType<typeof filterResultSchema.parse> | undefined,
      error: SafeFailure | undefined;
    try {
      meta.requestMade = true;
      const response = await request("https://api.openai.com/v1/responses", {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: config.model,
          instructions: config.systemPrompt,
          input: [
            {
              role: "user",
              content: [{ type: "input_text", text: JSON.stringify(input) }],
            },
          ],
          max_output_tokens: config.limits.maxTokens,
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: "tender_filter_test",
              strict: true,
              schema: filterOutputJSONSchema,
            },
          },
        }),
      });
      requestId = safeIdentifier(
        response.headers.get("x-request-id"),
        "req_",
        key,
      );
      try {
        body = await response.json();
      } catch {
        throw new SafeFailure(
          controller.signal.aborted ? "timeout" : "invalid_output",
          controller.signal.aborted,
        );
      }
      responseId = safeIdentifier(body?.id, "resp_", key);
      if (!response.ok) throw apiFailure(response.status, body);
      result = parseOutput(body, key);
    } catch (caught) {
      error =
        caught instanceof SafeFailure
          ? caught
          : new SafeFailure(
              controller.signal.aborted ? "timeout" : "network",
              true,
            );
    } finally {
      clearTimeout(timer);
    }
    const usage = usageFrom(body);
    const log: AgentLog = {
      id: randomUUID(),
      runId,
      agentId: "filter",
      accountId,
      at,
      timestamp: at,
      provider: "openai",
      mock: false,
      tenderId: input.id,
      model: config.model,
      durationMs: Date.now() - start,
      ...usage,
      status: error ? "error" : "success",
      processed: result ? 1 : 0,
      errors: error ? 1 : 0,
      estimatedUsage: usage.totalTokens ?? 0,
      message: error
        ? error.message
        : "Responses API: структурований результат одного тендера",
      ...(error ? { errorMessage: error.message } : {}),
      ...(requestId ? { requestId } : {}),
      ...(responseId ? { responseId } : {}),
      attempt: attempt + 1,
      promptVersion: config.promptVersion,
    };
    meta.log = log;
    try {
      await record(log);
    } catch {
      return failure("storage");
    }
    if (result) return { ...meta, ok: true, result };
    if (!error?.retryable || attempt === config.limits.retries)
      return failure(error?.code ?? "api");
    await sleep(Math.min(1000 * 2 ** attempt, 5000));
  }
  return failure("api");
}
