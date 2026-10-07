import test from "node:test";
import assert from "node:assert/strict";
import { tenders } from "./fixtures/tenders.ts";
import { canonicalTender, tenderFlow } from "../src/lib/tender-model.ts";
import {
  worksheetValue,
  matchesRelevance,
} from "../src/lib/worksheet-model.ts";
import { agentRepository } from "../src/lib/agents/config.server.ts";
import { executePipeline } from "../src/lib/agents/pipeline.ts";
import {
  FilterAgentService,
  StatusAgentService,
} from "../src/lib/agents/mock-services.ts";
import { mergeAgentResult } from "../src/lib/agents/merge.ts";
import { recalculateTender } from "../src/lib/tender-workflow.ts";
import { shortSubject } from "../src/lib/tender-subject.ts";
import {
  LocalPreferencesRepository,
  accountKey,
} from "../src/lib/preferences-repository.ts";

test("legacy preferences migrate only to first USER and retain existing personalized values", () => {
  const data = new Map([
    ["tenderpro.table.zoom", "150"],
    ["tenderpro.table.compactLayout", '{"widths":{"title":400}}'],
    ["tenderpro-demo", '{"tenders":[]}'],
    [accountKey("user", "table.zoom"), "175"],
  ]);
  const storage = {
    get length() {
      return data.size;
    },
    key(i) {
      return [...data.keys()][i] ?? null;
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
  const repo = new LocalPreferencesRepository(storage);
  repo.migrate("user2");
  repo.migrate("admin");
  assert.equal(repo.read("user2", "table.zoom", 100), 100);
  assert.equal(repo.read("admin", "table.zoom", 100), 100);
  repo.migrate("user");
  assert.equal(repo.read("user", "table.zoom", 100), 175);
  assert.deepEqual(repo.read("user", "table.compactLayout", {}), {
    widths: { title: 400 },
  });
  assert.deepEqual(repo.read("user", "tenders", {}), { tenders: [] });
  repo.write("user2", "table.zoom", 125);
  assert.equal(repo.read("user", "table.zoom", 100), 175);
  repo.migrate("user");
  assert.equal(repo.read("user2", "table.zoom", 100), 125);
});

test("one canonical Tender supplies table/card/preview documents, requirements and summary", () => {
  for (const original of tenders) {
    const t = canonicalTender(original),
      flow = tenderFlow(t);
    assert.equal(t.totalAmount, t.budget);
    assert.equal(flow.summary, t.aiSummary);
    assert.equal(flow.documents, t.documents);
    assert.equal(flow.risks, t.risks);
    assert.deepEqual(flow.requirements, [
      ...t.technicalRequirements,
      ...t.qualificationRequirements,
      ...t.specialRequirements,
    ]);
    assert.equal(
      worksheetValue(t, "technicalRequirements", 0, new Date()),
      t.technicalRequirements.join("\n") || "-",
    );
    assert.deepEqual(canonicalTender(t), t);
  }
});

test("new connector records cannot inherit demo specifications or documents", () => {
  const t = canonicalTender({
    ...tenders[1],
    analysis: undefined,
    id: "UA-2026-10-07-000991-a",
    title: "Автокран невідомої моделі",
    analysisPending: true,
  });
  assert.deepEqual(t.documents, []);
  assert.deepEqual(t.technicalRequirements, []);
  assert.equal(t.cpv, null);
  assert.equal(t.quantity, undefined);
});

test("mock pipeline skips detail for unrelated tenders, respects disabled agents and logs actual counts", async () => {
  const relevant = canonicalTender({
    ...tenders[1],
    commentColor: "purple",
    commentText: "Підготувати документи",
  });
  const unrelated = canonicalTender({
    ...tenders[0],
    id: "UA-2026-10-07-000111-a",
    title: "Медичні послуги",
    objects: [],
    subject: "Медичні послуги",
    documents: [],
    analysisPending: true,
    importSource: "excel",
  });
  const logs = [];
  const result = await executePipeline(
    [relevant, unrelated],
    agentRepository.list(),
    "user",
    (log) => logs.push(log),
  );
  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 1);
  assert.equal(logs.find((l) => l.agentId === "detail").processed, 1);
  assert.equal(logs.find((l) => l.agentId === "status").processed, 2);
  assert.equal(result.tenders[0].commentColor, "purple");
  assert.equal(result.tenders[0].commentText, "Підготувати документи");
  assert.equal(result.tenders[1].analysisPending, true);
  assert.equal(result.tenders[1].relevance, "rejected");
  assert.equal(matchesRelevance(result.tenders[1], "active"), false);
  assert.equal(matchesRelevance(result.tenders[1], "all"), true);
  assert.equal(matchesRelevance(result.tenders[1], "rejected"), true);
  assert.equal(
    result.tenders[1].history?.some((e) => e.kind === "agent-detail") ?? false,
    false,
  );
  const disabled = agentRepository
    .list()
    .map((c) => ({ ...c, enabled: false }));
  const untouched = await executePipeline([relevant], disabled, "user");
  assert.deepEqual(untouched.tenders[0], relevant);
});

test("detail never runs for unchecked records when the filter is disabled", async () => {
  const configs = agentRepository
    .list()
    .map((c) => ({ ...c, enabled: c.id !== "filter" }));
  const input = canonicalTender({
    ...tenders[1],
    importSource: "excel",
    analysisPending: true,
  });
  const logs = [];
  const result = await executePipeline([input], configs, "user", (log) =>
    logs.push(log),
  );
  assert.equal(result.tenders[0].analysisPending, true);
  assert.equal(result.accepted, 0);
  assert.equal(logs.find((l) => l.agentId === "detail").processed, 0);
});

test("unknown imports stay unknown after mock analysis and title uses supplied description", async () => {
  const input = canonicalTender({
    ...tenders[0],
    id: "UA-2026-10-07-000112-a",
    title: "Лот 1",
    description: "Предмет закупівлі: автокран XCMG",
    objects: [],
    importSource: "excel",
    analysisPending: true,
    quantity: undefined,
    unitPrice: undefined,
    technicalRequirements: [],
    documents: [],
  });
  const filtered = await new FilterAgentService().execute(input);
  assert.equal(filtered.tender.title, "автокран XCMG");
  const result = await executePipeline([input], agentRepository.list(), "user");
  const output = canonicalTender(result.tenders[0]);
  assert.equal(output.cpv, null);
  assert.equal(output.quantity, undefined);
  assert.equal(output.unitPrice, undefined);
  assert.deepEqual(output.documents, []);
  assert.deepEqual(output.technicalRequirements, []);
  assert.equal(output.aiScore, null);
  assert.equal(worksheetValue(output, "score", 0, new Date()), "-");
  assert.match(output.aiSummary, /Mock/);
});

test("late agent response preserves live comment, color, lifecycle, delay and prior history", async () => {
  const input = canonicalTender({
    ...tenders[1],
    commentText: "старий",
    commentColor: "yellow",
  });
  const result = await executePipeline([input], agentRepository.list(), "user");
  const current = {
    ...input,
    commentText: "новий",
    comment: "новий",
    commentColor: "purple",
    commentUpdatedAt: new Date().toISOString(),
    statusRecalcAt: new Date(Date.now() + 180000).toISOString(),
    lifecycle: { state: "cancelled", reason: "Скасовано джерелом" },
  };
  const merged = mergeAgentResult(current, result.tenders[0]);
  assert.equal(merged.commentText, "новий");
  assert.equal(merged.commentColor, "purple");
  assert.equal(merged.status, current.status);
  assert.equal(merged.statusRecalcAt, current.statusRecalcAt);
  assert.equal(
    recalculateTender(merged, new Date(Date.now() + 181000)).status,
    "CANCELLED",
  );
  assert.equal(merged.lifecycle, current.lifecycle);
  assert.deepEqual(merged.statusHistory, merged.history);
  assert.equal(
    merged.history.filter((e) => e.kind === "agent-processing").length,
    1,
  );
});

test("large source item lists keep every object while summaries remain short", async () => {
  const objects = Array.from({ length: 205 }, (_, i) => ({
    name: `Позиція ${i + 1}`,
  }));
  const subject = shortSubject(objects.map((o) => o.name).join("; "), objects);
  assert.match(subject, /203 позицій/);
  const input = canonicalTender({
    ...tenders[0],
    importSource: "excel",
    analysisPending: true,
    objects,
  });
  const result = await executePipeline([input], agentRepository.list(), "user");
  assert.equal(result.tenders[0].objects.length, 205);
  assert.ok(result.tenders[0].aiSummary.length < 400);
});

test("status agent keeps the manual color and cannot infer a win from an expired deadline", async () => {
  const output = await new StatusAgentService().execute({
    ...tenders[0],
    status: "IN_PROGRESS",
    deadline: "01.01.2020",
    commentColor: "blue",
    commentText: "Перевірити перемогу",
  });
  assert.notEqual(output.recommendedStatus, "WON");
  assert.equal(output.tender.commentColor, "blue");
  assert.equal(typeof output.reason, "string");
  assert.equal(typeof output.confidence, "number");
});

test("config repository validates limits, clones values and increments prompt version only on changes", async () => {
  const original = agentRepository.list()[0];
  const saved = agentRepository.save({
    ...original,
    systemPrompt: original.systemPrompt + " test",
  });
  assert.equal(saved.promptVersion, "v2");
  assert.equal(saved.version, 2);
  const next = agentRepository.save({ ...saved, enabled: false });
  assert.equal(next.promptVersion, "v2");
  assert.equal(next.version, 3);
  saved.limits.batchSize = 999;
  assert.equal(agentRepository.list()[0].limits.batchSize, 100);
  assert.throws(
    () =>
      agentRepository.save({ ...next, limits: { ...next.limits, retries: 6 } }),
    /ліміти/,
  );
  const configs = agentRepository.list().map((c) => ({
    ...c,
    enabled: true,
    limits: { ...c.limits, batchSize: 1 },
  }));
  await assert.rejects(
    executePipeline(tenders.slice(0, 2), configs, "user"),
    /Ліміт/,
  );
});
