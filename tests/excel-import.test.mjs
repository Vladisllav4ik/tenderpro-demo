import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createImportTemplateWorkbook,
  parseImportWorkbook,
  importHeaders,
  kyivDateTime,
} from "../src/lib/excel-import.ts";
import { newTender, periodInfo } from "../src/lib/tender-workflow.ts";
import { tableTender, worksheetPreview } from "../src/lib/worksheet-model.ts";
const now = new Date("2026-10-07T06:00:00Z");
async function filled(rows = 1) {
  const book = await createImportTemplateWorkbook();
  const sheet = book.getWorksheet("Імпорт");
  for (let i = 0; i < rows; i++)
    sheet.getRow(i + 2).values = [
      `QA тендер ${i + 1}`,
      `QA предмет ${i + 1}`,
      `UA-2026-10-07-${String(i + 1).padStart(6, "0")}-a`,
      "07.10.2026",
      "09:00",
      "14.10.2026",
      "18:00",
      100000,
      "QA замовник",
      "Техніка",
      "",
      2,
      "од.",
      50000,
      "07.10.2026",
      "",
      "90 днів від підписання",
      "Модель QA;Потужність 100 кВт",
      "2 аналогічні договори",
      "Гарантія 12 міс",
      "з причепом;фронтальний ківш",
      "purple",
    ];
  return book;
}
test("blank template roundtrip has canonical headers and imports no invented records", async () => {
  const book = await createImportTemplateWorkbook();
  assert.deepEqual(book.getWorksheet("Імпорт").getRow(1).values.slice(1), [
    ...importHeaders,
  ]);
  const parsed = await parseImportWorkbook(await book.xlsx.writeBuffer());
  assert.equal(parsed.total, 0);
  assert.equal(parsed.tenders.length, 0);
});
test("filled template roundtrip parses Kyiv date/time, numbers, empty colors and requirements", async () => {
  const book = await filled();
  const { tenders, issues } = await parseImportWorkbook(
    await book.xlsx.writeBuffer(),
  );
  assert.deepEqual(issues, []);
  assert.equal(tenders.length, 1);
  const t = newTender(tenders[0], now);
  assert.equal(t.status, "NEW");
  assert.equal(t.commentColor, "purple");
  assert.equal(t.commentText, "");
  assert.equal(t.budget, 100000);
  assert.equal(t.submissionPeriod.end, "2026-10-14T15:00:00.000Z");
  assert.match(periodInfo(t, now).endLabel, /18:00/);
  assert.deepEqual(t.technicalRequirements, [
    "Модель QA",
    "Потужність 100 кВт",
  ]);
  const enriched = tableTender(t, {
    technical: [["Неправильне поле", "Вигадано"]],
    parts: [],
    requirements: ["Вигадана вимога"],
    documents: [],
    delivery: "Вигадано",
  });
  assert.equal(enriched.address, undefined);
  assert.deepEqual(enriched.objects[0].characteristics, [
    "з причепом",
    "фронтальний ківш",
  ]);
  assert.equal(enriched.objects[0].quantity, 2);
});
test("duplicates do not overwrite; invalid rows report row numbers and stay separate", async () => {
  const book = await filled(3);
  const sheet = book.getWorksheet("Імпорт");
  sheet.getCell(3, 7).value = "25:00";
  sheet.getCell(4, 8).value = -100;
  const parsed = await parseImportWorkbook(
    await book.xlsx.writeBuffer(),
    new Set(["UA-2026-10-07-000001-a"]),
  );
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.tenders.length, 0);
  assert.deepEqual(
    parsed.issues.map((i) => i.row),
    [3, 4],
  );
});
test("compatible date cells and numeric time preserve precise hours without eval", async () => {
  const book = await filled();
  const sheet = book.getWorksheet("Імпорт");
  sheet.getCell(2, 4).value = new Date("2026-10-07T00:00:00Z");
  sheet.getCell(2, 5).value = 0.375;
  sheet.getCell(2, 7).value = 0.75;
  const parsed = await parseImportWorkbook(await book.xlsx.writeBuffer());
  assert.deepEqual(parsed.issues, []);
  assert.equal(
    parsed.tenders[0].submissionPeriod.start,
    "2026-10-07T06:00:00.000Z",
  );
  assert.equal(
    parsed.tenders[0].submissionPeriod.end,
    "2026-10-14T15:00:00.000Z",
  );
});
test("Kyiv conversion handles winter/summer and rejects nonexistent DST clock times", () => {
  assert.equal(kyivDateTime("2026-10-07", "18:00"), "2026-10-07T15:00:00.000Z");
  assert.equal(kyivDateTime("2026-12-01", "18:00"), "2026-12-01T16:00:00.000Z");
  assert.equal(kyivDateTime("2026-03-29", "03:30"), null);
  assert.equal(
    kyivDateTime("2026-10-07", "18:00:45"),
    "2026-10-07T15:00:45.000Z",
  );
});
test("35 rows and a 205-item subject list stay intact for unpaginated UI/import verification", async () => {
  const book = await filled(35);
  book.getWorksheet("Імпорт").getCell(2, 2).value = Array.from(
    { length: 205 },
    (_, i) => `Позиція ${i + 1}`,
  ).join("\n");
  const buffer = await book.xlsx.writeBuffer();
  const parsed = await parseImportWorkbook(buffer);
  assert.equal(parsed.tenders.length, 35);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.tenders[0].objects.length, 205);
  assert.equal(parsed.tenders[0].objects[0].quantity, undefined);
  assert.equal(parsed.tenders[0].quantity, 2);
  await mkdir(".test-output", { recursive: true });
  await writeFile(".test-output/ux-import-35.xlsx", new Uint8Array(buffer));
});

test("imported row previews do not invent demo documents, risk tags or AI conclusions", () => {
  const t = {
    id: "UA-2026-10-07-000001-a",
    title: "XCMG",
    customer: "Замовник",
    category: "Техніка",
    topCategory: "Техніка",
    budget: 1,
    deadline: "14.10.2026",
    region: "-",
    priority: "C",
    score: 0,
    status: "NEW",
    manager: "—",
    stage: "Аналіз",
    recommendation: "-",
    importSource: "excel",
    analysisPending: true,
  };
  const preview = worksheetPreview(t, {
    parts: [],
    technical: [],
    documents: [{ name: "Вигаданий файл" }],
    summary: "Вигаданий AI",
    risks: ["Вигаданий ризик"],
    plan: [],
    requirements: [],
    delivery: "Вигаданий строк",
    checks: "Вигадано",
  });
  assert.deepEqual(preview.documents, []);
  assert.deepEqual(preview.risks, []);
  assert.match(preview.summary, /ще не виконано/);
  assert.equal(preview.delivery, "-");
});
