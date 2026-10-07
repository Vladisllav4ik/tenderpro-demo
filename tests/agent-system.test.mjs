import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { tenders } from "../src/lib/demo-data.ts";
import { canonicalTender } from "../src/lib/tender-model.ts";
import { agentRepository } from "../src/lib/agents/config.server.ts";
import { TenderOrchestrator } from "../src/lib/agents/orchestrator.server.ts";
import {
  CollectorService,
  MockCollectorConnector,
  AnalyzerService,
  LifecycleService,
  evaluateLifecycleRules,
} from "../src/lib/agents/agent-services.server.ts";
import { LocalAgentRepositories } from "../src/lib/agents/local-repositories.server.ts";
import { LocalUsageJournal } from "../src/lib/agents/usage-journal.server.ts";
import { sanitizeSnapshot } from "../src/lib/agents/snapshots.server.ts";
import { executeFilterTest } from "../src/lib/agents/filter-test.server.ts";
import { filterInputFromTender } from "../src/lib/agents/filter-test-contract.ts";
import {
  analyzerInputFromTender,
  analyzerInputSchema,
  analyzerResultSchema,
  analyzerOutputJSONSchema,
  lifecycleInputFromTender,
  statusResultSchema,
  statusOutputJSONSchema,
  tenderDocumentInputSchema,
  pipelineSettingsSchema,
} from "../src/lib/agents/system-contracts.ts";
const now = new Date("2026-10-07T12:00:00.000Z");
const tender = () =>
  canonicalTender(tenders.find((t) => t.id === "UA-2026-09-29-003902-a"));
const configs = () =>
  agentRepository.list().map((c) => ({
    ...c,
    provider: "mock",
    enabled: true,
    ...(c.id === "status" ? { mode: "rule-based" } : {}),
  }));
const cfg = (id) => configs().find((c) => c.id === id);
const classification = {
  relevant: true,
  confidence: 0.94,
  category: "Техніка",
  object: "Автокран XCMG 25 т — 2 шт",
  reason: "Техніка",
};
const analyzerInput = () => analyzerInputFromTender(tender(), classification);
const analysis = {
  object: "Автокран",
  quantity: 2,
  unit: "шт",
  unitPrice: null,
  totalAmount: null,
  currency: null,
  submissionDeadline: null,
  auctionDateTime: null,
  deliveryDeadline: null,
  deliveryAddress: null,
  specialRequirements: [],
  technicalRequirements: [],
  qualificationRequirements: [],
  requiredDocuments: [],
  risks: [],
  aiSummary: "Відомі факти",
};
const lifecycle = () => ({
  ...lifecycleInputFromTender(tender()),
  sourceStatus: "active",
  submissionDeadline: "2026-10-20",
  participation: "not-submitted",
  result: "pending",
  directorComment: "Уточнити рішення",
  events: [],
  commentHistory: [],
});
const secret = "fake-private-api-credential";
const aiConfig = (id) => ({
  ...cfg(id),
  provider: "openai",
  mode: "hybrid",
  model: "gpt-test",
  limits: { maxTokens: 500, timeout: 1, retries: 0, batchSize: 1 },
});
const envelope = (
  value,
  usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
) => ({
  id: "resp_unit",
  status: "completed",
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(value) }],
    },
  ],
  usage,
});
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "x-request-id": "req_unit" },
  });
async function withStore(work) {
  const directory = await mkdtemp(join(tmpdir(), "tenderpro-agents-"));
  try {
    await work(
      new LocalAgentRepositories(directory),
      new LocalUsageJournal(directory),
      directory,
    );
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  }
}
function harness(repository, overrides = {}) {
  const logs = [];
  return {
    logs,
    orchestrator: new TenderOrchestrator({
      pipelines: repository,
      record: async (l) => {
        logs.push(l);
      },
      now: () => now,
      ...overrides,
    }),
  };
}
test("all four draft configurations exist; Agent 2 v2 preserved, new AI models and delay configurable", () => {
  assert.deepEqual(
    configs().map((c) => c.id),
    ["collector", "filter", "detail", "status"],
  );
  assert.equal(cfg("filter").promptVersion, "v2");
  assert.equal(cfg("detail").promptVersion, "v1");
  assert.equal(cfg("status").recheckDelaySeconds, 180);
  assert.throws(() =>
    agentRepository.save({
      ...cfg("status"),
      mode: "hybrid",
      systemPrompt: "",
    }),
  );
  assert.throws(() =>
    agentRepository.save({ ...cfg("status"), recheckDelaySeconds: 179 }),
  );
});
test("collector connector is independently replaceable and has bounded timeout/retries", async () => {
  let calls = 0;
  const c = {
    ...cfg("collector"),
    source: "data-source",
    limits: { ...cfg("collector").limits, retries: 1 },
  };
  const service = new CollectorService(c, {
    collect: async (t) => {
      calls++;
      if (calls === 1) throw new Error("secret stack");
      return {
        ...(await new MockCollectorConnector().collect(t)),
        source: "test-source",
      };
    },
  });
  assert.equal((await service.execute(tender())).source, "test-source");
  assert.equal(calls, 2);
  assert.throws(() => new CollectorService(c), /connector/);
  await assert.rejects(
    () =>
      new CollectorService(
        { ...c, limits: { ...c.limits, retries: 0 } },
        { collect: async () => ({}) },
      ).execute(tender()),
    /схемі/,
  );
});
test("documents interface accepts extracted text and rejects unknown payload fields", () => {
  assert.equal(
    tenderDocumentInputSchema.safeParse({
      documentId: "doc1",
      name: "input.pdf",
      mimeType: "application/pdf",
      sourceUrl: null,
      extractedText: "Facts",
      metadata: { pages: 3 },
    }).success,
    true,
  );
  assert.equal(
    analyzerInputSchema.safeParse({ ...analyzerInput(), unknown: "x" }).success,
    false,
  );
  assert.equal(
    analyzerResultSchema.safeParse({ ...analysis, quantity: -1 }).success,
    false,
  );
  assert.equal(
    analyzerResultSchema.safeParse({ ...analysis, untrusted: "x" }).success,
    false,
  );
  for (const schema of [analyzerOutputJSONSchema, statusOutputJSONSchema]) {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.required, Object.keys(schema.properties));
  }
});
test("mock analyzer keeps missing values null, known requirements separate, and never calls HTTP", async () => {
  const input = analyzerInput();
  input.knownFields = {
    unitPrice: 123,
    specialRequirements: ["Special"],
    technicalRequirements: ["Tech"],
    qualificationRequirements: ["Qual"],
  };
  const before = structuredClone(input);
  const reply = await new AnalyzerService().execute(
    input,
    cfg("detail"),
    "admin",
    async () => {},
    {
      request: () => {
        throw new Error("must not call");
      },
    },
  );
  assert.equal(reply.ok, true);
  assert.equal(reply.result.unitPrice, 123);
  assert.equal(reply.result.currency, null);
  assert.deepEqual(reply.result.requiredDocuments, []);
  assert.deepEqual(reply.result.specialRequirements, ["Special"]);
  assert.deepEqual(reply.result.qualificationRequirements, ["Qual"]);
  assert.deepEqual(input, before);
  await assert.rejects(() =>
    new AnalyzerService().execute(
      { ...input, classification: { ...classification, relevant: false } },
      cfg("detail"),
      "admin",
      async () => {},
    ),
  );
});
test("real Analyzer adapter sends configured Responses request and audits validated result (fake HTTP)", async () => {
  const logs = [];
  let calls = 0;
  const result = await new AnalyzerService().execute(
    analyzerInput(),
    aiConfig("detail"),
    "admin",
    async (l) => logs.push(l),
    {
      apiKey: () => secret,
      request: async (url, init) => {
        calls++;
        assert.equal(url, "https://api.openai.com/v1/responses");
        const body = JSON.parse(init.body);
        assert.equal(body.instructions, aiConfig("detail").systemPrompt);
        assert.equal(body.store, false);
        assert.equal(body.text.format.name, "tender_analyzer");
        assert.equal(
          JSON.parse(body.input[0].content[0].text).documents.length,
          analyzerInput().documents.length,
        );
        return response(envelope(analysis));
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(logs[0].agentId, "detail");
  assert.equal(logs[0].totalTokens, 120);
  assert.deepEqual(logs[0].outputSnapshot, analysis);
  assert.equal(JSON.stringify(logs).includes(secret), false);
});
test("Analyzer invalid structured output produces safe failure with consumed tokens audited", async () => {
  const logs = [];
  const reply = await new AnalyzerService().execute(
    analyzerInput(),
    aiConfig("detail"),
    "admin",
    async (l) => logs.push(l),
    {
      apiKey: () => secret,
      request: async () =>
        response(envelope({ ...analysis, quantity: "invented" })),
    },
  );
  assert.equal(reply.ok, false);
  assert.equal(reply.errorCode, "invalid_output");
  assert.equal(logs[0].status, "error");
  assert.equal(logs[0].totalTokens, 120);
  assert.equal(logs[0].outputSnapshot, null);
});
test("Lifecycle obvious facts win over comments in all modes with zero calls/tokens", async () => {
  for (const mode of ["rule-based", "mock", "openai", "hybrid"])
    for (const [change, expected] of [
      [
        { sourceStatus: "cancelled", directorComment: "Ми перемогли" },
        "CANCELLED",
      ],
      [{ sourceStatus: "disqualified" }, "DISQUALIFIED"],
      [{ sourceStatus: "closed", result: "won" }, "WON"],
      [
        { submissionDeadline: "2026-10-06", participation: "not-submitted" },
        "NOT_SUBMITTED",
      ],
    ]) {
      const result = await new LifecycleService().execute(
        { ...lifecycle(), ...change },
        { ...aiConfig("status"), mode },
        "admin",
        async () => {
          throw new Error("AI log unexpected");
        },
        {
          request: () => {
            throw new Error("no HTTP");
          },
        },
        now,
      );
      assert.equal(result.ok, true);
      assert.equal(result.provider, "rule-based");
      assert.equal(result.result.status, expected);
      assert.equal(result.requestMade, false);
    }
  assert.equal(
    evaluateLifecycleRules(
      { ...lifecycle(), submissionDeadline: "2026-10-07" },
      now,
    ),
    null,
  );
  assert.equal(
    evaluateLifecycleRules(
      {
        ...lifecycle(),
        submissionDeadline: "2026-10-06",
        participation: "unknown",
      },
      now,
    ),
    null,
  );
  assert.equal(
    evaluateLifecycleRules(
      { ...lifecycle(), sourceStatus: "active", result: "won" },
      now,
    ),
    null,
  );
});
test("Lifecycle rules-only and mock return review for ambiguous director comments without paid fallback", async () => {
  for (const mode of ["rule-based", "mock"]) {
    const r = await new LifecycleService().execute(
      lifecycle(),
      { ...cfg("status"), mode },
      "admin",
      async () => {},
      {
        request: () => {
          throw new Error("no HTTP");
        },
      },
      now,
    );
    assert.equal(r.result.status, "NEEDS_REVIEW");
    assert.equal(r.provider, mode);
  }
});
test("hybrid Lifecycle invokes AI exactly once for ambiguity and uses server evaluation time", async () => {
  let calls = 0;
  const logs = [];
  const output = {
    status: "WAITING",
    confidence: 0.7,
    reason: "Уточнення рішення",
    decisionSource: "openai",
    eventType: "comment.review",
    evaluatedAt: now.toISOString(),
  };
  const r = await new LifecycleService().execute(
    lifecycle(),
    aiConfig("status"),
    "admin",
    async (l) => logs.push(l),
    {
      apiKey: () => secret,
      request: async (url, init) => {
        calls++;
        const body = JSON.parse(init.body);
        assert.equal(body.text.format.name, "tender_lifecycle");
        assert.equal(
          JSON.parse(body.input[0].content[0].text).evaluatedAt,
          now.toISOString(),
        );
        return response(envelope(output));
      },
    },
    now,
  );
  assert.equal(r.ok, true);
  assert.equal(calls, 1);
  assert.equal(logs[0].agentId, "status");
  assert.equal(logs[0].totalTokens, 120);
  const bad = await new LifecycleService().execute(
    lifecycle(),
    aiConfig("status"),
    "admin",
    async (l) => {
      assert.equal(l.status, "error");
    },
    {
      apiKey: () => secret,
      request: async () =>
        response(envelope({ ...output, decisionSource: "rule-based" })),
    },
    now,
  );
  assert.equal(bad.ok, false);
  assert.equal(bad.errorCode, "invalid_output");
});
test("mock one-tender orchestrator traverses all stages, audits snapshots and leaves Tender unchanged", async () =>
  withStore(async (store, journal, dir) => {
    const original = tender(),
      before = structuredClone(original);
    const logs = [];
    const runner = new TenderOrchestrator({
      pipelines: store,
      record: async (l) => {
        logs.push(l);
        await journal.append(l);
      },
      now: () => now,
      responses: {
        request: () => {
          throw new Error("no paid call");
        },
      },
    });
    const p = await runner.run(original, configs(), "admin");
    assert.equal(p.currentStage, "MONITORING");
    assert.equal(p.status, "success");
    assert.equal(p.runs.length, 4);
    assert.equal(p.totalTokens, 0);
    assert.deepEqual(original, before);
    assert.deepEqual(
      p.stages.map((s) => s.agentId),
      ["collector", "filter", "detail", "status"],
    );
    assert.deepEqual(
      p.transitions.map((s) => s.state),
      [
        "RAW",
        "COLLECTED",
        "CLASSIFICATION_PENDING",
        "CLASSIFIED",
        "ANALYSIS_PENDING",
        "ANALYZED",
        "READY",
        "MONITORING",
      ],
    );
    for (const l of logs) {
      assert.equal(l.pipelineId, p.pipelineId);
      assert.ok(l.runId);
      assert.ok(l.startedAt);
      assert.ok(l.finishedAt);
      assert.ok(l.inputSnapshot);
      assert.ok(l.outputSnapshot);
      assert.equal(l.error, null);
    }
    assert.equal(
      (await new LocalAgentRepositories(dir).list("admin"))[0].pipelineId,
      p.pipelineId,
    );
    assert.equal((await new LocalUsageJournal(dir).list()).length, 4);
    assert.equal((await store.list("another-account")).length, 0);
  }));
test("confidence thresholds control review, acceptance and rejection without Analyzer bypass", async () =>
  withStore(async (store) => {
    assert.equal(
      pipelineSettingsSchema.safeParse({
        autoAcceptThreshold: 0.2,
        reviewThreshold: 0.8,
      }).success,
      false,
    );
    const { orchestrator } = harness(store);
    const review = await orchestrator.run(tender(), configs(), "admin", {
      autoAcceptThreshold: 0.8,
      reviewThreshold: 0.3,
    });
    assert.equal(review.status, "review");
    assert.equal(review.runs.length, 2);
    assert.equal(
      review.stages.find((s) => s.agentId === "detail").status,
      "skipped",
    );
    const unrelated = {
      ...tender(),
      title: "Медичні продукти харчування",
      subject: "Медичні продукти харчування",
      description: "",
      objects: [],
      documents: [],
    };
    const rejected = await orchestrator.run(unrelated, configs(), "admin", {
      autoAcceptThreshold: 0.8,
      reviewThreshold: 0.3,
    });
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.currentStage, "REJECTED");
    assert.equal(rejected.runs.length, 2);
  }));
test("disabled Classifier prevents Analyzer and disabled Analyzer returns ERROR with skip reasons", async () =>
  withStore(async (store) => {
    for (const id of ["filter", "detail"]) {
      const c = configs().map((c) =>
        c.id === id ? { ...c, enabled: false } : c,
      );
      const { orchestrator } = harness(store);
      const p = await orchestrator.run(tender(), c, "admin");
      assert.equal(p.currentStage, "ERROR");
      assert.equal(p.stages.find((s) => s.agentId === id).status, "error");
      assert.equal(
        p.stages.find((s) => s.agentId === "status").status,
        "skipped",
      );
      if (id === "filter")
        assert.equal(
          p.runs.some((r) => r.agentId === "detail"),
          false,
        );
    }
  }));
test("independent Collector/Classifier/Analyzer/Lifecycle tests run only prerequisites", async () =>
  withStore(async (store) => {
    for (const [id, expected] of [
      ["collector", ["collector"]],
      ["filter", ["filter"]],
      ["detail", ["filter", "detail"]],
      ["status", ["status"]],
    ]) {
      const { orchestrator } = harness(store);
      const p = await orchestrator.run(
        tender(),
        configs(),
        "admin",
        undefined,
        id,
      );
      assert.equal(p.status, "success");
      assert.deepEqual(
        p.runs.map((r) => r.agentId),
        expected,
      );
    }
  }));
test("pipeline totals include retried AI attempts; staging never counts only the final successful response", async () =>
  withStore(async (store) => {
    let calls = 0;
    const c = configs().map((c) =>
      c.id === "detail"
        ? {
            ...aiConfig("detail"),
            limits: { ...aiConfig("detail").limits, retries: 1 },
          }
        : c,
    );
    const { orchestrator } = harness(store, {
      responses: {
        apiKey: () => secret,
        sleep: async () => {},
        request: async () => {
          calls++;
          return calls === 1
            ? response(
                {
                  error: { code: "transient" },
                  usage: { input_tokens: 5, output_tokens: 0, total_tokens: 5 },
                },
                500,
              )
            : response(envelope(analysis));
        },
      },
    });
    const p = await orchestrator.run(tender(), c, "admin");
    assert.equal(calls, 2);
    assert.equal(p.status, "success");
    assert.equal(p.totalTokens, 125);
    assert.equal(p.runs.length, 5);
    assert.equal(
      p.runs.filter((r) => r.agentId === "detail")[0].status,
      "error",
    );
    assert.deepEqual(
      p.runs.filter((r) => r.agentId === "detail")[1].outputSnapshot,
      analysis,
    );
  }));
test("pipeline missing API key is friendly, audited, skips later stages and makes no request", async () =>
  withStore(async (store) => {
    const c = configs().map((c) =>
      c.id === "detail" ? aiConfig("detail") : c,
    );
    const { orchestrator } = harness(store, {
      responses: {
        apiKey: () => undefined,
        request: () => {
          throw new Error("no request");
        },
      },
    });
    const p = await orchestrator.run(tender(), c, "admin");
    assert.equal(p.status, "error");
    assert.match(
      p.stages.find((s) => s.agentId === "detail").reason,
      /OPENAI_API_KEY/,
    );
    assert.equal(p.runs.at(-1).status, "error");
    assert.equal(p.totalTokens, 0);
  }));
test("rechecks coalesce latest comments, enforce delay, persist restart and isolate accounts", async () =>
  withStore(async (store, journal, dir) => {
    const a = await store.schedule("admin", lifecycle(), 180, now);
    const later = new Date(now.getTime() + 60000);
    const b = await store.schedule(
      "admin",
      { ...lifecycle(), directorComment: "Новий коментар" },
      300,
      later,
    );
    assert.equal(b.revision, a.revision + 1);
    assert.equal((await store.pending("admin")).length, 1);
    assert.equal(
      await store.claimDue("admin", new Date(now.getTime() + 180000)),
      null,
    );
    const restarted = new LocalAgentRepositories(dir);
    assert.equal(
      (await restarted.pending("admin"))[0].input.directorComment,
      "Новий коментар",
    );
    assert.equal((await restarted.pending("other")).length, 0);
    const due = new Date(later.getTime() + 300000);
    assert.equal((await restarted.pending()).length, 1);
    const claim = await restarted.claimDue(undefined, due);
    assert.equal(claim.revision, b.revision);
    assert.equal(await restarted.claimDue("admin", due), null);
    assert.equal(await restarted.finish(claim), true);
    assert.equal((await restarted.pending("admin")).length, 0);
    assert.throws(() => store.schedule("admin", lifecycle(), 179, now));
  }));
test("in-flight recheck cannot delete newer revision; release and stale-claim lease recover safely", async () =>
  withStore(async (store) => {
    await store.schedule("admin", lifecycle(), 180, now);
    const due = new Date(now.getTime() + 180000);
    const claim = await store.claimDue("admin", due);
    await store.schedule(
      "admin",
      { ...lifecycle(), directorComment: "Нові факти" },
      180,
      due,
    );
    assert.equal(await store.finish(claim), false);
    await store.release(claim);
    assert.equal(
      (await store.pending("admin"))[0].input.directorComment,
      "Нові факти",
    );
    const secondDue = new Date(due.getTime() + 180000);
    const next = await store.claimDue("admin", secondDue);
    await store.release(next);
    assert.ok(await store.claimDue("admin", secondDue));
    assert.ok(
      await store.claimDue("admin", new Date(secondDue.getTime() + 3600001)),
    );
  }));
test("snapshots redact secret fields, environment values and credential patterns before durable writes", async () =>
  withStore(async (store, journal, dir) => {
    const name = "TENDERPRO_UNIT_SECRET";
    process.env[name] = secret;
    try {
      const original = {
        password: "p",
        token: "t",
        nested: { apiKey: "k", text: `embedded ${secret}` },
        array: ["sk-" + "x".repeat(20)],
      };
      const safe = sanitizeSnapshot(original);
      assert.equal(safe.password, "[REDACTED]");
      assert.equal(safe.token, "[REDACTED]");
      assert.equal(safe.nested.apiKey, "[REDACTED]");
      assert.equal(JSON.stringify(safe).includes(secret), false);
      const input = { ...lifecycle(), directorComment: secret };
      await store.schedule("admin", input, 180, now);
      assert.equal(
        (await readFile(join(dir, "agent-staging.json"), "utf8")).includes(
          secret,
        ),
        false,
      );
      const { orchestrator } = harness(store);
      const p = await orchestrator.run(
        { ...tender(), commentText: secret },
        configs(),
        "admin",
      );
      assert.equal(JSON.stringify(p).includes(secret), false);
      assert.equal(
        JSON.stringify(await store.list("admin")).includes(secret),
        false,
      );
    } finally {
      delete process.env[name];
    }
  }));
test("draft thresholds and editable configurations survive local adapter replacement", async () =>
  withStore(async (store, journal, dir) => {
    await store.saveSettings({
      autoAcceptThreshold: 0.85,
      reviewThreshold: 0.4,
    });
    await store.saveConfigurations(configs());
    const fresh = new LocalAgentRepositories(dir);
    assert.equal((await fresh.settings()).autoAcceptThreshold, 0.85);
    assert.equal((await fresh.configurations()).length, 4);
  }));
test("older network-delayed context cannot replace newer pending comment", async () =>
  withStore(async (store) => {
    const newer = {
      ...lifecycle(),
      directorComment: "Нові факти",
      contextUpdatedAt: "2026-10-07T12:01:00.000Z",
    };
    const job = await store.schedule("admin", newer, 180, now);
    const stale = await store.schedule(
      "admin",
      {
        ...newer,
        directorComment: "Старі факти",
        contextUpdatedAt: "2026-10-07T12:00:00.000Z",
      },
      180,
      new Date(now.getTime() + 1000),
    );
    assert.equal(stale.revision, job.revision);
    assert.equal(stale.input.directorComment, "Нові факти");
    assert.equal((await store.pending("admin")).length, 1);
    assert.equal(
      evaluateLifecycleRules(
        { ...lifecycle(), submissionDeadline: "2026-01-99" },
        now,
      ),
      null,
    );
  }));
test("Collector source facts/currency/metadata reach Analyzer through the orchestrator", async () =>
  withStore(async (store) => {
    const config = configs().map((c) =>
      c.id === "collector" ? { ...c, source: "data-source" } : c,
    );
    const { orchestrator } = harness(store, {
      connector: {
        collect: async (t) => ({
          ...(await new MockCollectorConnector().collect(t)),
          source: "test-source",
          amount: 987,
          currency: "EUR",
          rawMetadata: { sourceRevision: 5 },
        }),
      },
    });
    const p = await orchestrator.run(tender(), config, "admin");
    assert.equal(p.status, "success");
    const output = p.stages.find((s) => s.agentId === "detail").result;
    assert.equal(output.totalAmount, 987);
    assert.equal(output.currency, "EUR");
    assert.equal(
      p.runs.find((r) => r.agentId === "detail").inputSnapshot.metadata
        .sourceRevision,
      5,
    );
  }));
test("standalone mock rejects secret-bearing input; provider output cannot leak other environment secrets", async () => {
  process.env.TENDERPRO_UNIT_SECRET = secret;
  try {
    const reply = await executeFilterTest(
      { ...filterInputFromTender(tender()), title: secret },
      cfg("filter"),
      "admin",
      async () => {},
      {
        request: () => {
          throw new Error("no HTTP");
        },
      },
    );
    assert.equal(reply.ok, false);
    assert.equal(JSON.stringify(reply).includes(secret), false);
    const logs = [];
    const analyzed = await new AnalyzerService().execute(
      analyzerInput(),
      aiConfig("detail"),
      "admin",
      async (l) => logs.push(l),
      {
        apiKey: () => "another-fake-private-credential",
        request: async () =>
          response(envelope({ ...analysis, aiSummary: secret })),
      },
    );
    assert.equal(analyzed.ok, true);
    assert.equal(analyzed.result.aiSummary, "[REDACTED]");
    assert.equal(JSON.stringify(logs).includes(secret), false);
  } finally {
    delete process.env.TENDERPRO_UNIT_SECRET;
  }
});
