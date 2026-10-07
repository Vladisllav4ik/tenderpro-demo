import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import {
  createImportTemplateWorkbook,
  parseImportWorkbook,
  importHeaders,
} from "../src/lib/excel-import.ts";
import { LocalCrashRepository } from "../src/lib/agents/crash-repository.server.ts";
import { LocalAgentRepositories } from "../src/lib/agents/local-repositories.server.ts";
import { LocalUsageJournal } from "../src/lib/agents/usage-journal.server.ts";
import { TenderOrchestrator } from "../src/lib/agents/orchestrator.server.ts";
import { CrashService } from "../src/lib/agents/crash-service.server.ts";
import { agentRepository } from "../src/lib/agents/config.server.ts";
import { worksheetValue } from "../src/lib/worksheet-model.ts";
import { tenderFlow } from "../src/lib/tender-model.ts";
const now = new Date("2026-10-07T12:00:00Z");
export async function tenWorkbook() {
  const book = await createImportTemplateWorkbook();
  const sheet = book.getWorksheet("Імпорт");
  const set = (row, name, value) =>
    (sheet.getCell(row, importHeaders.indexOf(name) + 1).value = value);
  for (let i = 1; i <= 10; i++) {
    const row = i + 1;
    for (const [key, value] of Object.entries({
      "Назва закупівлі": `Закупівля обладнання ${i}`,
      ID: `UA-2026-10-07-${String(800000 + i)}-a`,
      "Дата завершення": "20.10.2026",
      "Загальна сума": 100000 + i,
      Замовник: `Замовник ${i}`,
    }))
      set(row, key, value);
    if (i <= 5) {
      set(row, "Кількість", i);
      set(row, "Од. виміру", "шт.");
    }
    if (i === 1) {
      for (const [key, value] of Object.entries({
        Категорія: "Обладнання",
        Адреса: "Київ, вул. Джерельна 1",
        "Особливі вимоги": "Гарантія 12 міс",
        "Технічні вимоги": "Напруга 24 В",
        "Ціна за одиницю": 77,
        Валюта: "UAH",
      }))
        set(row, key, value);
    }
  }
  return book;
}
const configs = (real = false) =>
  agentRepository
    .list()
    .map((c) => ({
      ...c,
      provider: real && ["filter", "detail"].includes(c.id) ? "openai" : "mock",
      ...(c.id === "status" ? { mode: "rule-based" } : {}),
      limits: { maxTokens: 1000, timeout: 2, retries: 0, batchSize: 10 },
    }));
const envelope = (result) =>
  new Response(
    JSON.stringify({
      id: "resp_test",
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(result) }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    }),
  );
async function fixture(work) {
  const directory = await mkdtemp(join(tmpdir(), "tenderpro-crash-"));
  try {
    const repo = new LocalCrashRepository(directory),
      pipelines = new LocalAgentRepositories(directory),
      journal = new LocalUsageJournal(directory);
    await work({ directory, repo, pipelines, journal });
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  }
}
test("10 real-format Excel rows retain raw cells, missing facts and source ownership", async () => {
  const book = await tenWorkbook();
  const result = await parseImportWorkbook(
    new Uint8Array(await book.xlsx.writeBuffer()),
    new Set(),
    "source.xlsx",
  );
  assert.equal(result.tenders.length, 10);
  assert.equal(result.issues.length, 0);
  assert.equal(result.tenders[0].rawImport.fileName, "source.xlsx");
  assert.equal(result.tenders[0].rawImport.cells["Загальна сума"], 100001);
  assert.equal(result.tenders[5].quantity, undefined);
  assert.equal(result.tenders[5].publishedAt, undefined);
  assert.equal(result.tenders[5].submissionPeriod.start, undefined);
  assert.equal(result.tenders[5].unitPrice, undefined);
  assert.equal(result.tenders[5].address, undefined);
  assert.deepEqual(result.tenders[5].documents, []);
  assert.equal(result.tenders[5].aiSummary, "-");
});
test("10 imports automatically run exactly Agents 2/3/4, never Collector, and persist separate stages/final", async () =>
  fixture(async ({ repo, pipelines, journal, directory }) => {
    const raw = (
      await parseImportWorkbook(
        new Uint8Array(await (await tenWorkbook()).xlsx.writeBuffer()),
      )
    ).tenders;
    const logs = [];
    const orchestrator = new TenderOrchestrator({
      pipelines,
      now: () => now,
      record: async (l) => {
        logs.push(l);
        await journal.append(l);
      },
      responses: {
        request: () => {
          throw new Error("No real API");
        },
      },
    });
    const service = new CrashService(repo, orchestrator);
    const added = await service.import(raw, "user");
    await service.run(added, configs(), {
      autoAcceptThreshold: 0.5,
      reviewThreshold: 0.3,
    });
    const records = await repo.list();
    assert.equal(records.length, 10);
    assert.equal(logs.length, 30);
    assert.equal(
      logs.some((l) => l.agentId === "collector"),
      false,
    );
    for (const r of records) {
      assert.ok(r.agent2Result);
      assert.ok(r.agent3Result);
      assert.ok(r.agent4Result);
      assert.equal(r.pipeline.currentStage, "MONITORING");
      assert.equal(r.finalMergedTender.aiSummary, "-");
      assert.equal(r.finalMergedTender.title, r.rawImportedData.title);
      assert.deepEqual(r.finalMergedTender.documents, []);
      assert.equal(r.finalMergedTender.budget, r.rawImportedData.budget);
      assert.equal(r.finalMergedTender.provenance.budget.source, "import");
    }
    assert.equal(
      (await new LocalCrashRepository(directory).list("user")).length,
      10,
    );
    assert.equal((await repo.list("other")).length, 0);
    assert.deepEqual(tenderFlow(records[8].finalMergedTender).documents, []);
    assert.equal(
      worksheetValue(records[8].finalMergedTender, "quantity", 0, now),
      "-",
    );
    await service.run(await repo.list(), configs(), {
      autoAcceptThreshold: 0.5,
      reviewThreshold: 0.3,
    });
    assert.equal(logs.length, 30);
    await service.run(
      await repo.list(),
      configs(),
      { autoAcceptThreshold: 0.5, reviewThreshold: 0.3 },
      true,
    );
    assert.equal(logs.length, 60);
    assert.equal((await service.import(raw, "user")).length, 0);
    await pipelines.saveConfigurations(configs());
    assert.equal(await repo.clear(), 10);
    assert.equal((await repo.list()).length, 0);
    assert.equal((await pipelines.configurations()).length, 4);
  }));
test("OpenAI adapter outputs cannot overwrite Excel values or invent missing facts (fake HTTP)", async () =>
  fixture(async ({ repo, pipelines, journal }) => {
    const raw = (
      await parseImportWorkbook(
        new Uint8Array(await (await tenWorkbook()).xlsx.writeBuffer()),
      )
    ).tenders;
    let calls = 0;
    const orchestrator = new TenderOrchestrator({
      pipelines,
      now: () => now,
      record: (l) => journal.append(l),
      responses: {
        apiKey: () => "fake-crash-unit-key",
        request: async (url, init) => {
          calls++;
          const body = JSON.parse(init.body);
          const input = JSON.parse(body.input[0].content[0].text);
          if (body.text.format.name === "tender_filter_test")
            return envelope({
              relevant: true,
              confidence: 0.99,
              category: "Техніка",
              object: "Вигаданий автокран XCMG 77 т",
              reason: "Test",
            });
          return envelope({
            object: "Вигадана модель",
            quantity: 99,
            unit: "вигадана",
            unitPrice: 9999,
            totalAmount: 1,
            currency: "USD",
            submissionDeadline: "2099-01-01",
            auctionDateTime: null,
            deliveryDeadline: "2099-12-31",
            deliveryAddress: "Вигадана адреса",
            specialRequirements: ["Гарантія 99 міс"],
            technicalRequirements: ["Вигаданий двигун"],
            qualificationRequirements: ["Вигаданий сертифікат"],
            requiredDocuments: ["Вигаданий.pdf"],
            risks: ["Вигаданий ризик"],
            aiSummary: "Вигаданий висновок",
          });
        },
      },
    });
    const service = new CrashService(repo, orchestrator);
    await service.run(await service.import(raw, "user"), configs(true), {
      autoAcceptThreshold: 0.5,
      reviewThreshold: 0.3,
    });
    assert.equal(calls, 20);
    const records = await repo.list();
    for (const r of records) {
      const f = r.finalMergedTender;
      assert.equal(f.title, r.rawImportedData.title);
      assert.equal(f.budget, r.rawImportedData.budget);
      assert.equal(f.quantity, r.rawImportedData.quantity);
      assert.equal(f.unitPrice, r.rawImportedData.unitPrice);
      assert.equal(f.address, r.rawImportedData.address);
      assert.deepEqual(
        f.specialRequirements,
        r.rawImportedData.specialRequirements,
      );
      assert.deepEqual(
        f.technicalRequirements,
        r.rawImportedData.technicalRequirements,
      );
      assert.deepEqual(
        f.qualificationRequirements,
        r.rawImportedData.qualificationRequirements,
      );
      assert.equal(f.deliveryPeriod, undefined);
      assert.deepEqual(f.documents, []);
      assert.equal(f.aiSummary, "-");
      assert.equal(
        f.submissionPeriod.end,
        r.rawImportedData.submissionPeriod.end,
      );
      assert.equal(JSON.stringify(f).includes("Вигадан"), false);
      assert.ok(r.mergeWarnings.length);
      assert.equal(r.agent3Result.quantity, 99);
    }
  }));
test("retry resumes successful stages; explicit rerun recomputes them", async () =>
  fixture(async ({ repo, pipelines, journal }) => {
    const raw = (
      await parseImportWorkbook(
        new Uint8Array(await (await tenWorkbook()).xlsx.writeBuffer()),
      )
    ).tenders.slice(0, 1);
    let filterCalls = 0,
      detailCalls = 0,
      fail = true;
    const runner = new TenderOrchestrator({
      pipelines,
      now: () => now,
      record: (l) => journal.append(l),
      responses: {
        apiKey: () => "fake-key",
        request: async (url, init) => {
          const body = JSON.parse(init.body);
          if (body.text.format.name === "tender_filter_test") {
            filterCalls++;
            return envelope({
              relevant: true,
              confidence: 0.99,
              category: "Обладнання",
              object: raw[0].title,
              reason: "Test",
            });
          }
          detailCalls++;
          if (fail)
            return new Response(
              JSON.stringify({ error: { code: "rate_limit" } }),
              { status: 429 },
            );
          return envelope({
            object: raw[0].title,
            quantity: null,
            unit: null,
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
            aiSummary: "-",
          });
        },
      },
    });
    const service = new CrashService(repo, runner);
    await service.run(await service.import(raw, "admin"), configs(true), {
      autoAcceptThreshold: 0.5,
      reviewThreshold: 0.3,
    });
    assert.equal((await repo.list())[0].pipeline.status, "error");
    fail = false;
    await service.run(await repo.list(), configs(true), {
      autoAcceptThreshold: 0.5,
      reviewThreshold: 0.3,
    });
    assert.equal(filterCalls, 1);
    assert.equal(detailCalls, 2);
    assert.equal(
      (await repo.list())[0].pipeline.stages.find((s) => s.agentId === "filter")
        .cached,
      true,
    );
  }));
test("clearing an in-flight record prevents its late completion from resurrecting it", async () =>
  fixture(async ({ repo, pipelines }) => {
    const raw = (
      await parseImportWorkbook(
        new Uint8Array(await (await tenWorkbook()).xlsx.writeBuffer()),
      )
    ).tenders.slice(0, 1);
    const service = new CrashService(
      repo,
      new TenderOrchestrator({ pipelines, record: async () => {} }),
    );
    const added = await service.import(raw, "admin");
    const claim = await repo.claim(added[0].recordId, false);
    assert.ok(claim);
    await repo.clear();
    assert.equal(
      await repo.save({ ...claim, processing: false }, claim.revision),
      false,
    );
    assert.deepEqual(await repo.list(), []);
  }));
