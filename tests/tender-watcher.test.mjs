import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTenderHierarchy,
  aggregateHierarchy,
  verifyQuestionChanges,
} from "../src/lib/tender-hierarchy.ts";
import { normalizeProzorro } from "../src/lib/agents/prozorro.server.ts";
import {
  fingerprints,
  mergeDocumentVersions,
  classifyChanges,
  textDelta,
  nextWatch,
} from "../src/lib/agents/watcher-model.server.ts";
import { TenderWatcherService } from "../src/lib/agents/watcher-service.server.ts";
import {
  buildDeltaInput,
  mergeDelta,
} from "../src/lib/agents/delta-analysis.server.ts";
import { worksheetValue } from "../src/lib/worksheet-model.ts";
const now = new Date("2026-10-08T09:00:00Z");
const raw = () => ({
  id: "UA-2026-10-05-010567-a",
  title: "Source title",
  customer: "Source buyer",
  budget: 0,
  deadline: "2026-10-20",
  status: "NEW",
  sourceFields: [],
  technicalRequirements: [],
  qualificationRequirements: [],
  specialRequirements: [],
  documents: [],
});
const data = () => ({
  id: "a".repeat(32),
  tenderID: raw().id,
  title: "Екскаватори",
  status: "active.tendering",
  value: { amount: 300, currency: "UAH" },
  tenderPeriod: { endDate: "2026-10-20T12:00:00+03:00" },
  procuringEntity: { name: "Замовник", identifier: { id: "12345678" } },
  lots: [
    {
      id: "l1",
      title: "Лот 1",
      status: "active",
      value: { amount: 100, currency: "UAH" },
      auctionPeriod: { startDate: "2026-10-21T12:30:03+03:00" },
    },
    {
      id: "l2",
      title: "Лот 2",
      status: "active",
      value: { amount: 200, currency: "UAH" },
      auctionPeriod: { startDate: "2026-10-22T12:30:03+03:00" },
    },
  ],
  items: [
    {
      id: "i1",
      description: "Насос",
      quantity: 2,
      unit: { code: "H87", name: "штука" },
      relatedLot: "l1",
      deliveryDate: { endDate: "2026-11-01" },
      deliveryAddress: { locality: "Київ" },
    },
    {
      id: "i2",
      description: "Кабель",
      quantity: 3,
      unit: { code: "MTR", name: "метр" },
      relatedLot: "l2",
      deliveryDate: { endDate: "2026-12-01" },
      deliveryAddress: { locality: "Львів" },
    },
  ],
  questions: [],
});
const doc = (text = "Напруга 24 В") => ({
  documentId: "doc1",
  name: "Вимоги.txt",
  url: "https://public-docs.prozorro.gov.ua/test",
  mimeType: "text/plain",
  datePublished: "2026-10-05T09:00:00Z",
  dateModified: "2026-10-05T09:00:00Z",
  source: "prozorro",
  downloadStatus: "downloaded",
  parseStatus: "parsed",
  text,
  error: null,
  contentHash: text,
});
const emptyDelta = () => ({
  changes: [],
  questions: [],
  rereadDocumentIds: [],
  affectedFields: [],
  conclusionChanges: [],
});
const prep = (d, docs = []) => ({
  rawProzorroData: d,
  tender: {
    ...normalizeProzorro(raw(), d),
    hierarchy: verifyQuestionChanges(
      parseTenderHierarchy(d, mergeDocumentVersions([], docs)),
    ),
    documents: docs.map((d) => ({
      ...d,
      kind: "source",
      facts: [],
      sources: [d.url],
    })),
  },
  documents: docs,
  flags: {
    baseDataReady: true,
    documentsFetched: true,
    documentsParsed: docs.some((d) => d.parseStatus === "parsed"),
    documentsAvailable: docs.length > 0,
    agent2Completed: true,
  },
  errors: [],
  fetchedAt: now.toISOString(),
  prozorroFetched: true,
  baseFieldsCount: 1,
});
function setup(old, fresh, oldDocs = [], newDocs = oldDocs, overrides = {}) {
  let record = {
    recordId: "record",
    revision: 0,
    accountId: "admin",
    rawImportedData: raw(),
    finalMergedTender: prep(old, oldDocs).tender,
    preparation: prep(old, oldDocs),
    mergeWarnings: [],
    processing: false,
  };
  let delta = 0,
    lifecycle = 0,
    lastInput;
  const repo = {
    list: async () => [structuredClone(record)],
    claim: async () => {
      record.processing = true;
      record.revision++;
      return structuredClone(record);
    },
    save: async (r, revision) => {
      if (revision !== record.revision) return false;
      record = structuredClone(r);
      return true;
    },
  };
  const branches = {
    prepare: async () => prep(fresh, newDocs),
    delta: async (input) => {
      delta++;
      lastInput = input;
      return { result: emptyDelta(), tokens: 12, calls: 1 };
    },
    lifecycle: async () => {
      lifecycle++;
      return {
        result: {
          status: "CANCELLED",
          confidence: 1,
          reason: "source",
          decisionSource: "rule-based",
          eventType: "source.cancelled",
          evaluatedAt: now.toISOString(),
        },
        tokens: 0,
        calls: 0,
      };
    },
    ...overrides,
  };
  return {
    watcher: new TenderWatcherService(repo, branches),
    get: () => record,
    counts: () => ({ delta, lifecycle }),
    input: () => lastInput,
  };
}
test("hierarchy retains lots/items/source relations, customer code and no invented submission", () => {
  const t = normalizeProzorro(raw(), data()),
    h = t.hierarchy;
  assert.equal(h.customerCode, "12345678");
  assert.equal(h.lots.length, 2);
  assert.deepEqual(h.lots[0].itemIds, ["i1"]);
  assert.equal(h.lots[0].submission, null);
  assert.equal(h.items[1].unitCode, "MTR");
});
test("single lot auction fallback, tender auction priority and no date invention", () => {
  const d = data();
  d.lots = d.lots.slice(0, 1);
  let t = normalizeProzorro(raw(), d);
  assert.equal(t.auctionPeriod.start, d.lots[0].auctionPeriod.startDate);
  assert.equal(t.provenance.auctionPeriod.sourceType, "prozorro_lot");
  d.auctionPeriod = { startDate: "2026-10-19T10:00:00Z" };
  assert.equal(
    normalizeProzorro(raw(), d).auctionPeriod.start,
    d.auctionPeriod.startDate,
  );
  delete d.auctionPeriod;
  delete d.lots[0].auctionPeriod;
  assert.equal(normalizeProzorro(raw(), d).auctionPeriod, undefined);
});
test("multi lot table aggregation never adds mixed units and exposes differing fields", () => {
  const t = normalizeProzorro(raw(), data());
  const a = aggregateHierarchy(t);
  assert.equal(a.multipleAuctions, true);
  assert.equal(a.multipleUnits, true);
  assert.equal(a.quantity, null);
  assert.equal(a.multipleDelivery, true);
  assert.equal(a.multipleAddresses, true);
  assert.equal(worksheetValue(t, "auctionPeriod", 0, now), "2 аукціони");
  assert.equal(worksheetValue(t, "quantity", 0, now), "Кілька позицій");
  assert.equal(worksheetValue(t, "deliveryPeriod", 0, now), "Кілька строків");
  assert.equal(worksheetValue(t, "address", 0, now), "Кілька адрес");
  assert.equal(t.budget, 300);
});
test("equal lot auctions and units collapse; sum only homogeneous source lot values", () => {
  const d = data();
  delete d.value;
  d.lots[1].auctionPeriod = d.lots[0].auctionPeriod;
  d.items[1].unit = d.items[0].unit;
  let t = normalizeProzorro(raw(), d);
  assert.equal(t.auctionPeriod.start, d.lots[0].auctionPeriod.startDate);
  assert.equal(aggregateHierarchy(t).quantity, 5);
  assert.equal(t.expectedValue, 300);
  d.lots[1].value.currency = "EUR";
  assert.equal(aggregateHierarchy(normalizeProzorro(raw(), d)).lotSum, null);
  d.lots[1].value.currency = "UAH";
  d.lots[1].status = "cancelled";
  assert.equal(aggregateHierarchy(normalizeProzorro(raw(), d)).lotSum, null);
});
test("Q&A preserves participant claim, buyer answer, dateAnswered, lot and unknown impact", () => {
  const d = data();
  d.questions = [
    {
      id: "q",
      title: "Вимога",
      description: "Умови дискримінаційні",
      date: "2026-10-06T09:00:00Z",
      answer: "Зміни ТД опубліковано",
      dateAnswered: "2026-10-06T12:00:00Z",
      questionOf: "lot",
      relatedItem: "l1",
    },
  ];
  const q = parseTenderHierarchy(d).questions[0];
  assert.equal(q.question, "Умови дискримінаційні");
  assert.equal(q.answer, "Зміни ТД опубліковано");
  assert.equal(q.lotId, "l1");
  assert.equal(q.answerDate, d.questions[0].dateAnswered);
  assert.equal(q.impact, null);
  assert.equal(q.changeClaimed, true);
  assert.equal(
    verifyQuestionChanges(parseTenderHierarchy(d)).questions[0].changeVerified,
    false,
  );
});
test("document revision requires actual before/after version evidence, not buyer promise", () => {
  const d = data();
  d.questions = [
    {
      id: "q",
      description: "Змініть вимоги",
      date: "2026-10-06T09:00:00Z",
      answer: "Зміни ТД опубліковано",
      dateAnswered: "2026-10-06T12:00:00Z",
    },
  ];
  const first = doc(),
    updated = { ...doc("Напруга 12 В"), dateModified: "2026-10-06T11:00:00Z" };
  const versions = mergeDocumentVersions(mergeDocumentVersions([], [first]), [
    updated,
  ]);
  assert.equal(versions.length, 2);
  assert.notEqual(versions[0].versionId, versions[1].versionId);
  assert.equal(
    verifyQuestionChanges(parseTenderHierarchy(d, versions)).questions[0]
      .changeVerified,
    true,
  );
  assert.equal(
    verifyQuestionChanges(parseTenderHierarchy(d, versions.slice(0, 1)))
      .questions[0].changeVerified,
    false,
  );
  assert.deepEqual(textDelta(first.text, updated.text).after, "Напруга 12 В");
});
test("fingerprints ignore object key/array record order and separate questions from answers", () => {
  const a = data(),
    b = {
      ...data(),
      lots: [...data().lots].reverse(),
      items: [...data().items].reverse(),
    };
  assert.deepEqual(fingerprints(a, []), fingerprints(b, []));
  a.questions = [{ id: "q", description: "Уточніть", answer: "Так" }];
  b.questions = [{ answer: "Ні", description: "Уточніть", id: "q" }];
  assert.equal(
    fingerprints(a, []).questionsHash,
    fingerprints(b, []).questionsHash,
  );
  assert.notEqual(
    fingerprints(a, []).answersHash,
    fingerprints(b, []).answersHash,
  );
});
test("no changes means zero Agent 3 and Agent 4 calls, zero AI tokens", async () => {
  const s = setup(data(), data(), [doc()]);
  const result = await s.watcher.check("record", now);
  assert.deepEqual(s.counts(), { delta: 0, lifecycle: 0 });
  assert.equal(result.watcher.aiCalls, 0);
  assert.equal(result.watcher.tokensUsed, 0);
  assert.equal(result.watcher.changeDetected, false);
  assert.equal(result.processing, false);
});
test("structured auction/deadline/address/value changes update table without GPT", async () => {
  const before = data(),
    after = data();
  after.lots[0].auctionPeriod.startDate = "2026-10-24T09:00:00Z";
  after.value.amount = 500;
  after.tenderPeriod.endDate = "2026-10-25T12:00:00Z";
  after.items[0].deliveryAddress.locality = "Одеса";
  const s = setup(before, after);
  const result = await s.watcher.check("record", now);
  assert.equal(result.finalMergedTender.budget, 500);
  assert.equal(result.finalMergedTender.hierarchy.items[0].address, "Одеса");
  assert.deepEqual(s.counts(), { delta: 0, lifecycle: 0 });
  assert.equal(result.watcher.aiCalls, 0);
});
test("new answer invokes only delta Agent 3 with changed Q&A and old requirements; second check zero calls", async () => {
  const before = data(),
    after = data();
  after.questions = [
    {
      id: "q",
      description: "Еквівалент?",
      answer: "Допускається еквівалент",
      dateAnswered: "2026-10-08T08:00:00Z",
    },
  ];
  const s = setup(before, after, [doc()]);
  await s.watcher.check("record", now);
  assert.deepEqual(s.counts(), { delta: 1, lifecycle: 0 });
  assert.equal(s.input().questions.length, 1);
  assert.equal(s.input().documents.length, 0);
  const second = await s.watcher.check("record", now);
  assert.deepEqual(s.counts(), { delta: 1, lifecycle: 0 });
  assert.equal(second.watcher.aiCalls, 0);
});
test("document content delta supplies changed fragments and keeps old version", async () => {
  const old = doc("Напруга 24 В"),
    fresh = { ...doc("Напруга 12 В"), dateModified: "2026-10-08T08:00:00Z" };
  const s = setup(data(), data(), [old], [fresh]);
  const r = await s.watcher.check("record", now);
  assert.deepEqual(s.counts(), { delta: 1, lifecycle: 0 });
  assert.equal(s.input().documents[0].before, "Напруга 24 В");
  assert.equal(s.input().documents[0].after, "Напруга 12 В");
  assert.equal(r.finalMergedTender.hierarchy.documentVersions.length, 2);
});
test("metadata changes with same content do not spend AI tokens", () => {
  const old = doc(),
    fresh = { ...old, dateModified: "2026-10-08T08:00:00Z" };
  const plan = classifyChanges(data(), data(), [old], [fresh]);
  assert.equal(plan.changed, true);
  assert.equal(plan.semantic, false);
});
test("source cancellation selects Agent 4 branch only and disables watcher", async () => {
  const after = data();
  after.status = "cancelled";
  const s = setup(data(), after);
  const r = await s.watcher.check("record", now);
  assert.deepEqual(s.counts(), { delta: 0, lifecycle: 1 });
  assert.equal(r.finalMergedTender.status, "CANCELLED");
  assert.equal(r.watcher.nextCheckAt, null);
  assert.equal(r.watcher.aiCalls, 0);
});
test("cadence is 3h active, 1h near deadline, 12h after and off terminal", () => {
  const d = data();
  assert.equal(nextWatch(d, now), "2026-10-08T12:00:00.000Z");
  d.tenderPeriod.endDate = "2026-10-09T08:00:00Z";
  assert.equal(nextWatch(d, now), "2026-10-08T10:00:00.000Z");
  d.tenderPeriod.endDate = "2026-10-07T08:00:00Z";
  assert.equal(nextWatch(d, now), "2026-10-08T21:00:00.000Z");
  d.status = "complete";
  assert.equal(nextWatch(d, now), null);
});
test("delta rejects invented facts, participant claim impact and rewriting import", () => {
  const t = normalizeProzorro(raw(), data());
  t.hierarchy.questions = [
    {
      id: "q",
      question: "Дискримінаційні умови",
      answer: "Допускається еквівалент",
    },
  ];
  t.sourceFields = ["technicalRequirements"];
  t.technicalRequirements = ["Excel exact"];
  const result = {
    ...emptyDelta(),
    changes: [
      {
        field: "technicalRequirements",
        operation: "add",
        value: "Напруга 24 В",
        sourceType: "document",
        sourceId: "doc1",
        quote: "Напруга 24 В",
        confidence: 1,
      },
      {
        field: "qualificationRequirements",
        operation: "add",
        value: "Гарантія 99 років",
        sourceType: "document",
        sourceId: "doc1",
        quote: "Гарантія 99 років",
        confidence: 1,
      },
    ],
    questions: [
      {
        id: "q",
        classification: "legal",
        impact: "high",
        sourceType: "question",
        sourceId: "q",
        quote: "Дискримінаційні умови",
        confidence: 1,
      },
    ],
  };
  const merged = mergeDelta(t, result, [doc()]);
  assert.deepEqual(merged.tender.technicalRequirements, ["Excel exact"]);
  assert.deepEqual(merged.tender.qualificationRequirements, []);
  assert.equal(merged.tender.hierarchy.questions[0].impact, null);
  assert.equal(merged.warnings.length, 2);
});
test("failed delta keeps already updated source fields and technical error", async () => {
  const after = data();
  after.value.amount = 400;
  after.questions = [{ id: "q", description: "Запитання" }];
  const s = setup(data(), after, [], [], {
    delta: async () => {
      throw new Error("Analysis unavailable");
    },
  });
  const r = await s.watcher.check("record", now);
  assert.equal(r.finalMergedTender.budget, 400);
  assert.equal(r.processing, false);
  assert.equal(r.watcher.error, "Analysis unavailable");
});

test("reordering unchanged source makes zero branches", async () => {
  const before = data(),
    after = data();
  after.items.reverse();
  after.lots.reverse();
  const s = setup(before, after);
  const r = await s.watcher.check("record", now);
  assert.equal(r.watcher.changeDetected, false);
  assert.deepEqual(s.counts(), { delta: 0, lifecycle: 0 });
});
test("Agent 4 completes despite failed semantic branch", async () => {
  const after = data();
  after.status = "cancelled";
  after.questions = [{ id: "q", description: "Запитання" }];
  const s = setup(data(), after, [], [], {
    delta: async () => {
      throw new Error("delta failed");
    },
  });
  const r = await s.watcher.check("record", now);
  assert.equal(r.finalMergedTender.status, "CANCELLED");
  assert.equal(s.counts().lifecycle, 1);
  assert.equal(r.watcher.error, "delta failed");
});
test("source checksum/content hash changes are detected even with same URL and modification date", () => {
  const a = { ...doc(), sourceHash: "sha256:old" },
    b = { ...doc("Напруга 12 В"), sourceHash: "sha256:new" };
  const plan = classifyChanges(data(), data(), [a], [b]);
  assert.equal(plan.changed, true);
  assert.equal(plan.semantic, true);
  const versions = mergeDocumentVersions(mergeDocumentVersions([], [a]), [b]);
  assert.equal(versions.length, 2);
});
