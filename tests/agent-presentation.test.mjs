import test from "node:test";
import assert from "node:assert/strict";
import {
  agentModules,
  agentMetrics,
  agentMode,
  agentDate,
} from "../src/lib/agent-presentation.ts";
test("Four clean agent routes map to the existing backend agent identifiers", () => {
  assert.deepEqual(
    agentModules.map((m) => m.slug),
    ["agent-1", "agent-2", "agent-3", "agent-4"],
  );
  assert.deepEqual(
    agentModules.map((m) => m.id),
    ["collector", "filter", "detail", "status"],
  );
  assert.equal(agentMode({ id: "detail", provider: "openai" }), "OpenAI");
  assert.equal(agentMode({ id: "status", mode: "rule-based" }), "rule-based");
  assert.equal(
    agentMode({ id: "collector", source: "data-source" }),
    "data-source",
  );
  assert.equal(agentDate("invalid"), "—");
});
test("Agent metrics isolate agents, preserve unknown usage and derive documents from the real latest input", () => {
  const logs = [
    {
      agentId: "detail",
      at: "2026-10-07T12:00:00Z",
      processed: 1,
      errors: 0,
      totalTokens: 200,
      inputSnapshot: { documents: [{}, {}] },
    },
    {
      agentId: "filter",
      at: "2026-10-08T12:00:00Z",
      processed: 5,
      errors: 0,
      totalTokens: 900,
    },
    {
      agentId: "detail",
      at: "2026-10-08T12:00:00Z",
      processed: 0,
      errors: 1,
      totalTokens: null,
      inputSnapshot: { documents: [{}] },
    },
  ];
  const copy = structuredClone(logs),
    m = agentMetrics(logs, "detail");
  assert.equal(m.processed, 1);
  assert.equal(m.errors, 1);
  assert.equal(m.tokens, 200);
  assert.equal(m.unknownUsage, true);
  assert.equal(m.lastRun, "2026-10-08T12:00:00Z");
  assert.equal(m.documentsConsumed, 1);
  assert.deepEqual(logs, copy);
  assert.equal(agentMetrics([], "collector").lastRun, undefined);
});
