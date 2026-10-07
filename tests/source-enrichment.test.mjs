import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import XLSX from "xlsx";
import {
  ProzorroSource,
  normalizeProzorro,
} from "../src/lib/agents/prozorro.server.ts";
import { TenderDocumentService } from "../src/lib/agents/document-service.server.ts";
import { Agent2PreparationService } from "../src/lib/agents/preparation.server.ts";
import { sanitizeSnapshot } from "../src/lib/agents/snapshots.server.ts";
import { analyzerInputFromTender } from "../src/lib/agents/system-contracts.ts";
import { TenderOrchestrator } from "../src/lib/agents/orchestrator.server.ts";
import { agentRepository } from "../src/lib/agents/config.server.ts";
test("PDF text worker is explicitly available for the server bundle", async () => {
  const stream = "BT /F1 12 Tf 20 100 Td (Voltage 24 V) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  assert.match(
    await new TenderDocumentService().extractText(
      Buffer.from(pdf),
      "requirements.pdf",
      "application/pdf",
    ),
    /Voltage 24 V/,
  );
});
const raw = () => ({
  id: "UA-2026-10-05-010567-a",
  title: "Обладнання",
  customer: "Excel buyer",
  budget: 123,
  currency: "UAH",
  status: "new",
  category: "Обладнання",
  deadline: "2026-10-20",
  aiScore: null,
  aiSummary: "-",
  documents: [],
  objects: [],
  technicalRequirements: [],
  qualificationRequirements: [],
  specialRequirements: [],
  risks: [],
  sourceFields: ["customer", "budget", "submissionPeriod"],
  submissionPeriod: { end: "2026-10-20" },
});
const source = () => ({
  id: "a".repeat(32),
  tenderID: raw().id,
  title: "Джерельна назва",
  status: "active.tendering",
  value: { amount: 999, currency: "UAH" },
  procuringEntity: { name: "API buyer" },
  tenderPeriod: {
    startDate: "2026-10-05T12:00:00+03:00",
    endDate: "2026-10-20T16:00:00+03:00",
  },
  items: [
    {
      description: "Насос",
      quantity: 2,
      unit: { name: "шт." },
      classification: { scheme: "CPV", id: "42120000-6" },
    },
  ],
});
test("Prozorro resolves and validates public ID before fetching full source", async () => {
  const urls = [];
  const api = new ProzorroSource(async (url) => {
    urls.push(url);
    return Response.json(
      url.endsWith("/summary")
        ? { id: "a".repeat(32), tenderID: raw().id }
        : { data: source() },
    );
  });
  assert.equal((await api.fetchTender(raw().id)).items[0].quantity, 2);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /public-api.prozorro.gov.ua/);
  await assert.rejects(
    new ProzorroSource(async () =>
      Response.json({ id: "a".repeat(32), tenderID: "wrong" }),
    ).fetchTender(raw().id),
    /не підтвердив/,
  );
});
test("Excel values stay exact; source supplies timestamps and never divides budget into unit price", () => {
  const t = normalizeProzorro(raw(), source());
  assert.equal(t.customer, "Excel buyer");
  assert.equal(t.budget, 123);
  assert.equal(t.quantity, 2);
  assert.equal(t.unitPrice, undefined);
  const ukrainian = source();
  ukrainian.items[0].classification.scheme = "ДК021";
  assert.equal(normalizeProzorro(raw(), ukrainian).cpv, "42120000-6");
  assert.equal(t.submissionPeriod.end, "2026-10-20T16:00:00+03:00");
  assert.equal(t.submissionPeriod.start, "2026-10-05T12:00:00+03:00");
  assert.equal(t.provenance["submissionPeriod.end"].source, "prozorro");
  const s = source();
  s.items.push({ description: "Кабель", quantity: 10, unit: { name: "м" } });
  assert.equal(normalizeProzorro(raw(), s).quantity, undefined);
  const r = raw();
  r.submissionPeriod.end = "2026-10-19";
  assert.equal(
    normalizeProzorro(r, source()).submissionPeriod.end,
    "2026-10-19",
  );
});
test("No source documents is distinct from failed document listing", async () => {
  const api = { fetchTender: async () => source() };
  const empty = await new Agent2PreparationService(api, {
    fetchTenderDocuments: async () => [],
    register: () => [],
    processAll: async () => [],
  }).prepare(raw());
  assert.equal(empty.flags.agent2Completed, true);
  assert.equal(empty.flags.documentsAvailable, false);
  assert.equal(empty.flags.documentsFetched, true);
  const failed = await new Agent2PreparationService(api, {
    fetchTenderDocuments: async () => {
      throw Error("offline");
    },
  }).prepare(raw());
  assert.equal(failed.flags.documentsAvailable, null);
  assert.equal(failed.flags.agent2Completed, false);
});
test("Document download/cache isolates unsupported signatures and blocks unsafe hosts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tp-docs-"));
  let calls = 0;
  try {
    const svc = new TenderDocumentService(async () => {
      calls++;
      return new Response("Текст джерела");
    }, dir);
    const docs = svc.register([
      {
        id: "text",
        title: "Умови.txt",
        url: "https://public-docs.prozorro.gov.ua/text",
        format: "text/plain",
      },
      {
        id: "sig",
        title: "sign.p7s",
        url: "https://public-docs.prozorro.gov.ua/sign",
      },
    ]);
    await svc.processAll(docs);
    assert.equal(docs[0].parseStatus, "parsed");
    assert.equal(docs[1].downloadStatus, "downloaded");
    assert.equal(docs[1].parseStatus, "failed");
    await svc.process(docs[0]);
    assert.equal(calls, 2);
    const unsafe = svc.register([
      { id: "unsafe", title: "file.txt", url: "http://127.0.0.1/private" },
    ])[0];
    await svc.process(unsafe);
    assert.equal(unsafe.downloadStatus, "failed");
    assert.equal(calls, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Backend extracts Ukrainian XLS/XLSX, DOCX and nested ZIP text", async () => {
  const svc = new TenderDocumentService();
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ["Вимоги", "Кількість"],
      ["Напруга 24 В", 10],
    ]),
    "Імпорт",
  );
  for (const bookType of ["xls", "xlsx"])
    assert.match(
      await svc.extractText(
        XLSX.write(book, { type: "buffer", bookType }),
        `data.${bookType}`,
        null,
      ),
      /Напруга 24 В/,
    );
  const doc = new JSZip();
  doc.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  doc.file(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  doc.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Гарантія 12 місяців</w:t></w:r></w:p></w:body></w:document>',
  );
  const bytes = await doc.generateAsync({ type: "nodebuffer" });
  assert.match(
    await svc.extractText(bytes, "terms.docx", null),
    /Гарантія 12 місяців/,
  );
  const zip = new JSZip();
  zip.file("terms.docx", bytes);
  zip.file("sign.p7s", "signature");
  assert.match(
    await svc.extractText(
      await zip.generateAsync({ type: "nodebuffer" }),
      "terms.zip",
      null,
    ),
    /Гарантія 12 місяців/,
  );
});
test("Audit sanitizer preserves authorization requirements but redacts credentials", () => {
  const safe = sanitizeSnapshot({
    authorizationRequirements: ["Лист виробника"],
    Authorization: "Bearer sensitive",
    apiKey: "secret",
  });
  assert.deepEqual(safe.authorizationRequirements, ["Лист виробника"]);
  assert.equal(safe.Authorization, "[REDACTED]");
  assert.equal(safe.apiKey, "[REDACTED]");
});
test("Agent3 receives only parsed text with real document IDs; source gate prevents requests", async () => {
  const r = raw();
  r.documents = [
    {
      documentId: "real",
      name: "terms.txt",
      text: "Напруга 24 В",
      facts: [],
      sources: [],
      kind: "source",
      parseStatus: "parsed",
    },
    {
      documentId: "broken",
      name: "sign.p7s",
      text: "",
      facts: [],
      sources: [],
      kind: "source",
      parseStatus: "failed",
    },
  ];
  const c = {
    relevant: true,
    confidence: 1,
    category: "Обладнання",
    object: "Обладнання",
    reason: "Source",
  };
  const input = analyzerInputFromTender(r, c);
  assert.equal(input.documents.length, 1);
  assert.equal(input.documents[0].documentId, "real");
  assert.match(JSON.stringify(input.documents), /Напруга 24 В/);
  let calls = 0;
  const runner = new TenderOrchestrator({
    pipelines: { save: async () => {} },
    record: async () => {
      calls++;
    },
    responses: {
      request: async () => {
        calls++;
        throw Error("must not run");
      },
    },
  });
  const preparation = {
    flags: {
      baseDataReady: false,
      agent2Completed: false,
      documentsFetched: false,
      documentsParsed: false,
      documentsAvailable: null,
    },
  };
  const p = await runner.run(
    r,
    agentRepository.list(),
    "test",
    undefined,
    undefined,
    undefined,
    { excelImport: true, preparation },
  );
  assert.equal(p.status, "error");
  assert.equal(calls, 0);
});
