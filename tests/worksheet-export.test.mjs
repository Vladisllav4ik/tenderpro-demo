import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { tenders } from "./fixtures/tenders.ts";
import {
  defaultLayout,
  layoutColumns,
  worksheetFilename,
} from "../src/lib/worksheet-model.ts";
import { createWorksheetWorkbook } from "../src/lib/worksheet-export.ts";
const now = new Date("2026-10-06T12:00:00Z");
const sample = [
  {
    ...tenders[1],
    publishedAt: "2026-10-01",
    status: "WON",
    commentText: "",
    commentColor: "purple",
    quantity: 4,
    unit: "шт.",
    unitPrice: 8100000,
    objects: [{ name: "Самоскид DONGFENG", quantity: 4, unit: "шт." }],
  },
  {
    ...tenders[3],
    publishedAt: "2026-10-06",
    status: "LOST",
    commentText: "Довгий коментар\nДругий рядок",
    deadline: "05.10.2026",
    commentColor: "green",
  },
];
for (const mode of ["compact", "detailed"])
  test(`XLSX ${mode} roundtrip mirrors active order, formatting, colors and ID links`, async () => {
    const layout = defaultLayout(mode);
    const columns = layoutColumns(layout, mode, true).map((c) => ({
      ...c,
      pinned: layout.pinned.includes(c.key),
    }));
    const book = await createWorksheetWorkbook(sample, columns, 100, now);
    const buffer = await book.xlsx.writeBuffer();
    assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), "PK");
    const roundtrip = new ExcelJS.Workbook();
    await roundtrip.xlsx.load(buffer);
    const sheet = roundtrip.worksheets[0];
    const cell = (key, row = 2) =>
      sheet.getCell(row, columns.findIndex((c) => c.key === key) + 1);
    assert.deepEqual(
      sheet.getRow(1).values.slice(1),
      columns.map((c) => c.label),
    );
    assert.equal(sheet.rowCount, 3);
    assert.equal(cell("comment").value, "");
    assert.equal(cell("comment").fill.fgColor.argb, "FFEBDDFA");
    assert.equal(cell("comment", 3).fill.fgColor.argb, "FFDCF0DF");
    assert.equal(cell("comment").alignment.wrapText, true);
    assert.equal(cell("comment").border.right.color.argb, "FF8B919A");
    assert.equal(cell("status").value, "Перемога");
    assert.equal(cell("status", 3).value, "Не перемогли");
    assert.equal(cell("status", 3).fill.fgColor.argb, "FFF8E4CD");
    assert.equal(cell("id").text, sample[0].id);
    assert.match(cell("id").hyperlink, /prozorro.gov.ua\/tender\//);
    assert.equal(cell("budget").value, 32400000);
    assert.match(cell("budget").numFmt, /₴/);
    assert.equal(sheet.views[0].xSplit, 2);
    assert.equal(sheet.getRow(2).height, 48);
    if (mode === "detailed") {
      assert.equal(cell("quantity").value, 4);
      assert.equal(cell("unitPrice").value, 8100000);
    }
  });
test("custom detailed order, freeze, widths, AI-off and filtered view survive export", async () => {
  const layout = defaultLayout("detailed");
  layout.pinned.push("title");
  layout.widths.title = 310;
  layout.visibility = layout.visibility.filter((k) => k !== "address");
  const columns = layoutColumns(layout, "detailed", false).map((c) => ({
    ...c,
    width: (layout.widths[c.key] ?? c.width) * 2,
    pinned: layout.pinned.includes(c.key),
  }));
  const book = await createWorksheetWorkbook(
      sample.slice(0, 1),
      columns,
      200,
      now,
    ),
    sheet = book.worksheets[0];
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.views[0].xSplit, 3);
  assert.equal(sheet.getColumn(3).width, (620 - 5) / 7);
  assert.equal(sheet.getCell("B2").font.size, 22);
  assert.ok(!sheet.getRow(1).values.includes("AI"));
  assert.ok(!sheet.getRow(1).values.includes("Адреса"));
  assert.equal(sheet.getRow(2).height, 96);
  assert.equal(
    worksheetFilename(sample, now),
    "TenderPro_2026-10-01_2026-10-06.xlsx",
  );
});
