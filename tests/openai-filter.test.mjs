import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { executeFilterTest } from "../src/lib/agents/filter-test.server.ts";
import {
  filterInputFromTender,
  filterInputSchema,
  matchesTestConfiguration,
  filterTestRequestSchema,
  allowsPaidDemoTest,
} from "../src/lib/agents/filter-test-contract.ts";
import { LocalUsageJournal } from "../src/lib/agents/usage-journal.server.ts";
import { agentRepository } from "../src/lib/agents/config.server.ts";
import { canonicalTender } from "../src/lib/tender-model.ts";
import { tenders } from "./fixtures/tenders.ts";
import { executePipeline } from "../src/lib/agents/pipeline.ts";
const secret = "private-unit-test-credential";
const config = () => ({
  ...agentRepository.list().find((c) => c.id === "filter"),
  provider: "openai",
  model: "gpt-test-model",
  systemPrompt: "Test configurable prompt",
  limits: { maxTokens: 321, timeout: 5, retries: 0, batchSize: 100 },
});
const input = () =>
  filterInputFromTender(
    canonicalTender(tenders.find((t) => t.id === "UA-2026-09-29-003902-a")),
  );
const result = {
  relevant: true,
  confidence: 0.94,
  category: "Будівельна техніка",
  object: "Автокран XCMG 25 т — 2 шт",
  reason: "Відповідає профілю техніки",
};
const envelope = (overrides = {}) => ({
  id: "resp_test",
  status: "completed",
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(result) }],
    },
  ],
  usage: {
    input_tokens: 123,
    output_tokens: 45,
    total_tokens: 168,
    input_tokens_details: { cached_tokens: 10 },
    output_tokens_details: { reasoning_tokens: 0 },
  },
  ...overrides,
});
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "req_test" },
  });
async function run(request, options = {}) {
  const logs = [];
  const reply = await executeFilterTest(
    options.input ?? input(),
    options.config ?? config(),
    "admin",
    async (l) => logs.push(l),
    {
      apiKey: () => secret,
      request,
      sleep: async () => {},
      ...options.dependencies,
    },
  );
  assert.equal(JSON.stringify({ reply, logs }).includes(secret), false);
  return { reply, logs };
}
test("Responses request uses stored model/prompt/limits, strict schema, safe basic input and read-only preview", async () => {
  const tender = {
    ...canonicalTender(tenders[1]),
    commentText: "PRIVATE COMMENT",
    commentColor: "purple",
  };
  const before = JSON.stringify(tender);
  const data = filterInputFromTender(tender);
  assert.equal(JSON.stringify(data).includes("PRIVATE COMMENT"), false);
  const { reply, logs } = await run(
    async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(init.headers.Authorization, `Bearer ${secret}`);
      assert.equal(init.redirect, "error");
      const body = JSON.parse(init.body);
      assert.equal(body.model, "gpt-test-model");
      assert.equal(body.instructions, "Test configurable prompt");
      assert.equal(body.max_output_tokens, 321);
      assert.equal(body.store, false);
      assert.equal(body.text.format.type, "json_schema");
      assert.equal(body.text.format.strict, true);
      assert.deepEqual(body.text.format.schema.required, Object.keys(result));
      assert.equal(body.text.format.schema.additionalProperties, false);
      assert.deepEqual(JSON.parse(body.input[0].content[0].text), data);
      return response(envelope());
    },
    { input: data },
  );
  assert.equal(reply.ok, true);
  assert.deepEqual(reply.result, result);
  assert.equal(reply.provider, "openai");
  assert.equal(reply.requestMade, true);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].mock, false);
  assert.equal(logs[0].status, "success");
  assert.equal(logs[0].tenderId, tender.id);
  assert.equal(logs[0].totalTokens, 168);
  assert.equal(logs[0].inputTokens, 123);
  assert.equal(logs[0].outputTokens, 45);
  assert.equal(logs[0].cachedInputTokens, 10);
  assert.equal(logs[0].requestId, "req_test");
  assert.equal(logs[0].responseId, "resp_test");
  assert.ok(logs[0].durationMs >= 0);
  assert.equal(JSON.stringify(tender), before);
});
test("mock/legacy provider makes no external calls, disabled/missing key/input errors do not dispatch", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    throw new Error(secret);
  };
  const mock = await run(request, {
    config: { ...config(), provider: "mock" },
  });
  assert.equal(mock.reply.ok, true);
  assert.equal(mock.reply.provider, "mock");
  assert.equal(mock.reply.requestMade, false);
  const legacy = { ...config() };
  delete legacy.provider;
  assert.equal((await run(request, { config: legacy })).reply.provider, "mock");
  assert.equal(
    (await run(request, { config: { ...config(), enabled: false } })).reply
      .errorCode,
    "disabled",
  );
  assert.equal(
    (await run(request, { dependencies: { apiKey: () => undefined } })).reply
      .errorCode,
    "key_missing",
  );
  assert.equal((await run(request, { input: [] })).reply.errorCode, "input");
  assert.equal(
    (await run(request, { input: { ...input(), extra: "not allowed" } })).reply
      .errorCode,
    "input",
  );
  assert.equal(calls, 0);
});
test("invalid structured output, refusal and incomplete results are errors with usage retained and no retry", async () => {
  const cases = [
    [JSON.stringify({ ...result, confidence: 1.1 }), "invalid_output"],
    [JSON.stringify({ ...result, relevant: "true" }), "invalid_output"],
    [JSON.stringify({ ...result, other: 1 }), "invalid_output"],
    ["freeform text", "invalid_output"],
    [JSON.stringify({ ...result, object: secret }), "invalid_output"],
    [JSON.stringify({ ...result, reason: "" }), "invalid_output"],
  ];
  for (const [text, code] of cases) {
    let calls = 0;
    const { reply, logs } = await run(
      async () => {
        calls++;
        return response(
          envelope({
            output: [
              { type: "message", content: [{ type: "output_text", text }] },
            ],
          }),
        );
      },
      { config: { ...config(), limits: { ...config().limits, retries: 3 } } },
    );
    assert.equal(reply.ok, false);
    assert.equal(reply.errorCode, code);
    assert.equal(calls, 1);
    assert.equal(logs[0].status, "error");
    assert.equal(logs[0].totalTokens, 168);
  }
  assert.equal(
    (await run(async () => response(envelope({ status: "incomplete" })))).reply
      .errorCode,
    "incomplete",
  );
  assert.equal(
    (
      await run(async () =>
        response(
          envelope({
            output: [
              {
                type: "message",
                content: [{ type: "refusal", refusal: secret }],
              },
            ],
          }),
        ),
      )
    ).reply.errorCode,
    "refusal",
  );
});
test("quota/auth/model/rate/server/network errors are mapped without raw provider text or stacks", async () => {
  for (const [status, code, expected] of [
    [429, "insufficient_quota", "balance"],
    [401, "invalid_api_key", "auth"],
    [403, "access_denied", "auth"],
    [404, "model_not_found", "model"],
    [429, "rate_limit_exceeded", "rate_limit"],
    [500, "server_error", "api"],
    [400, "invalid_request", "api"],
  ]) {
    const { reply, logs } = await run(async () =>
      response({ error: { code, message: `secret=${secret}` } }, status),
    );
    assert.equal(reply.errorCode, expected);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, "error");
    assert.equal(logs[0].totalTokens, null);
    assert.equal("stack" in reply, false);
  }
  assert.equal(
    (
      await run(async () => {
        throw new Error(`Authorization ${secret}`);
      })
    ).reply.errorCode,
    "network",
  );
});
test("configured timeout aborts transport; retries log each actual attempt with a shared runId", async () => {
  const timed = await run(
    async (_url, init) =>
      new Promise((_resolve, reject) =>
        init.signal.addEventListener("abort", () => reject(new Error(secret))),
      ),
    { config: { ...config(), limits: { ...config().limits, timeout: 0.01 } } },
  );
  assert.equal(timed.reply.errorCode, "timeout");
  assert.equal(timed.logs.length, 1);
  let calls = 0;
  const recovered = await run(
    async () =>
      ++calls === 1
        ? response(
            { error: { code: "rate_limit_exceeded", message: secret } },
            429,
          )
        : response(envelope()),
    { config: { ...config(), limits: { ...config().limits, retries: 1 } } },
  );
  assert.equal(recovered.reply.ok, true);
  assert.equal(calls, 2);
  assert.deepEqual(
    recovered.logs.map((l) => l.status),
    ["error", "success"],
  );
  assert.equal(recovered.logs[0].runId, recovered.logs[1].runId);
  assert.notEqual(recovered.logs[0].id, recovered.logs[1].id);
  calls = 0;
  const quota = await run(
    async () => {
      calls++;
      return response(
        { error: { code: "insufficient_quota", message: secret } },
        429,
      );
    },
    { config: { ...config(), limits: { ...config().limits, retries: 5 } } },
  );
  assert.equal(quota.reply.errorCode, "balance");
  assert.equal(calls, 1);
});
test("journal survives adapter restart, serializes writes and stores only technical records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tenderpro-usage-"));
  try {
    const journal = new LocalUsageJournal(directory);
    const { logs } = await run(async () => response(envelope()));
    await Promise.all([
      journal.append(logs[0]),
      journal.append({ ...logs[0], id: "second-record" }),
    ]);
    const restored = await new LocalUsageJournal(directory).list();
    assert.equal(restored.length, 2);
    assert.equal(restored[0].totalTokens, 168);
    const text = await readFile(join(directory, "agent-usage.jsonl"), "utf8");
    assert.equal(text.includes(secret), false);
    assert.equal(text.includes("Authorization"), false);
    assert.equal(text.includes("systemPrompt"), false);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  }
});
test("bulk pipeline remains deterministic mock even when Agent 2 is configured as OpenAI", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Must not run");
  };
  try {
    const configs = agentRepository
      .list()
      .map((c) =>
        c.id === "filter"
          ? { ...c, provider: "openai", model: "gpt-test-model" }
          : c,
      );
    const result = await executePipeline(
      tenders.slice(0, 2).map(canonicalTender),
      configs,
      "admin",
    );
    assert.equal(result.mock, true);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("single-test contract rejects batches and stale provider/version before billing can start", () => {
  assert.equal(allowsPaidDemoTest("development"), true);
  assert.equal(allowsPaidDemoTest("production"), false);
  assert.equal(allowsPaidDemoTest(undefined), false);
  const cfg = config();
  const request = {
    input: input(),
    provider: "mock",
    configVersion: cfg.version,
  };
  assert.equal(filterTestRequestSchema.safeParse(request).success, true);
  assert.equal(matchesTestConfiguration(request, cfg), false);
  assert.equal(
    matchesTestConfiguration({ ...request, provider: "openai" }, cfg),
    true,
  );
  assert.equal(
    matchesTestConfiguration(
      { ...request, provider: "openai", configVersion: cfg.version - 1 },
      cfg,
    ),
    false,
  );
  assert.equal(
    filterTestRequestSchema.safeParse({ ...request, input: [input(), input()] })
      .success,
    false,
  );
});
test("configuration forbids secrets in model/prompt and OpenAI for other agents", () => {
  const current = agentRepository.list().find((c) => c.id === "filter");
  assert.throws(() =>
    agentRepository.save({ ...current, model: "sk-" + "x".repeat(24) }),
  );
  assert.throws(() =>
    agentRepository.save({ ...current, systemPrompt: "sk-" + "x".repeat(24) }),
  );
  assert.throws(() =>
    agentRepository.save({
      ...agentRepository.list()[0],
      provider: "openai",
      model: "gpt-test-model",
    }),
  );
  assert.equal(
    filterInputSchema.safeParse({ ...input(), totalAmount: NaN }).success,
    false,
  );
});
