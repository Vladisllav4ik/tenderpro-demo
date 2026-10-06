import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { tenders } from "../src/lib/demo-data.ts";
import { newTender } from "../src/lib/tender-workflow.ts";
import { sheetColumns, worksheetFilename } from "../src/lib/worksheet-model.ts";
import { createWorksheetWorkbook } from "../src/lib/worksheet-export.ts";
const now = new Date("2026-10-06T12:00:00Z");
const sample = [
  {
    ...newTender(tenders[1], now),
    publishedAt: "2026-10-01",
    status: "COMPLETED_SUCCESS",
    comment: "Чекаємо відповідь\nГарантія та сервіс",
  },
  {
    ...newTender(tenders[3], now),
    publishedAt: "2026-10-06",
    status: "COMPLETED_FAILED",
    deadline: "05.10.2026",
  },
];
test("XLSX current-view export preserves column order, notes, styles and frozen working columns", async () => {
  const columns = sheetColumns.filter(
    (c) => !["budget", "region", "stage"].includes(c.key),
  );
  const book = await createWorksheetWorkbook(sample, columns, 100, now);
  const buffer = await book.xlsx.writeBuffer();
  assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), "PK");
  const roundtrip = new ExcelJS.Workbook();
  await roundtrip.xlsx.load(buffer);
  const sheet = roundtrip.worksheets[0];
  assert.deepEqual(
    sheet.getRow(1).values.slice(1),
    columns.map((c) => c.label),
  );
  assert.equal(sheet.rowCount, 3);
  assert.equal(sheet.getCell("B2").value, sample[0].comment);
  assert.equal(sheet.getCell("B2").alignment.wrapText, true);
  assert.equal(sheet.getCell("B2").border.right.style, "thin");
  assert.equal(sheet.getRow(2).height, 48);
  assert.equal(sheet.getColumn(2).width, (210 - 5) / 7);
  assert.equal(sheet.getCell("J2").value, "Завершено");
  assert.equal(sheet.getCell("J3").value, "Завершено");
  assert.equal(sheet.getCell("J2").fill.fgColor.argb, "FFD1F6E5");
  assert.equal(sheet.getCell("J3").fill.fgColor.argb, "FFFFE0E1");
  assert.match(sheet.getCell("F2").hyperlink, /prozorro.gov.ua\/tender\//);
  assert.equal(sheet.views[0].xSplit, 2);
  assert.equal(sheet.views[0].ySplit, 1);
  assert.equal(sheet.getCell("E3").font.color.argb, "FF8B7278");
  assert.equal(
    worksheetFilename(sample, now),
    "TenderPro_2026-10-01_2026-10-06.xlsx",
  );
});
test("AI-off exports only the filtered view and excludes AI from workbook", async () => {
  const columns = sheetColumns
    .filter((c) => !["budget", "region", "stage"].includes(c.key))
    .filter((c) => c.key !== "score");
  const book = await createWorksheetWorkbook(
    sample.slice(0, 1),
    columns,
    200,
    now,
  );
  assert.equal(book.worksheets[0].rowCount, 2);
  assert.ok(!book.worksheets[0].getRow(1).values.includes("AI"));
  assert.equal(book.worksheets[0].getRow(2).height, 96);
  assert.equal(book.worksheets[0].getCell("B2").font.size, 22);
});
