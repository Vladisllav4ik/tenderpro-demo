import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import XLSX from "xlsx";
import {
  presentationTender,
  getExpectedValue,
  vatLabel,
  workspaceZakupivliURL,
  sourceProzorroURL,
  unitAbbreviation,
  subjectWithUnits,
  chronologicalCompare,
} from "../src/lib/tender-presentation.ts";
import {
  defaultLayout,
  migrateLayout,
  validLayout,
  worksheetSortValue,
} from "../src/lib/worksheet-model.ts";
import { createWorksheetWorkbook } from "../src/lib/worksheet-export.ts";
import {
  renderDocumentPreview,
  cleanDocumentHTML,
} from "../src/lib/document-preview.server.ts";
const tender = (id = "UA-2026-10-05-010567-a") => ({
  id,
  title: "Тест",
  budget: 123,
  currency: "UAH",
  documents: [],
  objects: [],
});
test("Expected value/VAT uses exact source booleans, preserves import amount and records provenance", () => {
  const t = tender();
  t.provenance = { budget: { source: "import" } };
  for (const value of [true, false, null, undefined, "false"]) {
    const r = presentationTender(t, {
      id: "source",
      value: { amount: 999, valueAddedTaxIncluded: value },
    });
    assert.equal(r.expectedValue, 123);
    assert.equal(r.vatIncluded, typeof value === "boolean" ? value : null);
    if (typeof value === "boolean")
      assert.equal(r.provenance.vatIncluded.source, "prozorro");
  }
  assert.equal(vatLabel(true), "з ПДВ");
  assert.equal(vatLabel(false), "без ПДВ");
  assert.equal(vatLabel(null), "ПДВ: -");
  assert.equal(getExpectedValue({ ...t, expectedValue: 456 }), 456);
  assert.equal(
    presentationTender({
      ...t,
      vatIncluded: true,
      provenance: { vatIncluded: { source: "agent3" } },
    }).vatIncluded,
    null,
  );
});
test("ID opens verified lower-case Zakupivli tender route and preserves separate Prozorro source", () => {
  const t = tender();
  assert.equal(
    workspaceZakupivliURL(t),
    "https://zakupivli.pro/gov/tenders/ua-2026-10-05-010567-a",
  );
  assert.equal(
    sourceProzorroURL(t),
    "https://prozorro.gov.ua/tender/UA-2026-10-05-010567-a",
  );
  assert.equal(
    workspaceZakupivliURL({
      ...t,
      workspaceUrlZakupivli: "javascript:alert(1)",
    }),
    workspaceZakupivliURL(t),
  );
});
test("Only defined unit names are abbreviated; unknown source units remain unchanged", () => {
  for (const [unit, short] of Object.entries({
    штука: "шт.",
    одиниця: "шт.",
    комплект: "компл.",
    послуга: "посл.",
    метр: "м",
    кілометр: "км",
    кілограм: "кг",
    тонна: "т",
    літр: "л",
    година: "год.",
    день: "дн.",
  }))
    assert.equal(unitAbbreviation(unit), short);
  assert.equal(unitAbbreviation("людино-зміна"), "людино-зміна");
  assert.match(
    subjectWithUnits({
      ...tender(),
      objects: [{ name: "ТО автомобілів", quantity: 370, unit: "послуга" }],
    }),
    /370 посл\./,
  );
});
test("Chronological default, timestamp/createdAt/ID ties, append, manual sort and reset", () => {
  const a = {
      ...tender("a"),
      publishedAt: "2026-10-05T09:00:00Z",
      createdAt: "2026-10-05T10:00:00Z",
    },
    b = {
      ...tender("b"),
      publishedAt: "2026-10-05T09:00:00Z",
      createdAt: "2026-10-05T11:00:00Z",
    },
    c = { ...tender("c"), publishedAt: "2026-10-06", budget: 2 };
  assert.deepEqual(
    [c, b, a].sort(chronologicalCompare).map((t) => t.id),
    ["a", "b", "c"],
  );
  assert.equal([...[a, b], c].sort(chronologicalCompare).at(-1).id, "c");
  const layout = defaultLayout("compact");
  assert.equal(layout.sort.key, "chronological");
  assert.ok(validLayout(layout));
  const manual = { ...layout, sort: { key: "budget", direction: -1 } };
  assert.deepEqual(migrateLayout(manual).sort, manual.sort);
  assert.deepEqual(migrateLayout({ ...manual, version: 2 }).sort, manual.sort);
  assert.ok(
    worksheetSortValue(a, "budget", new Date()) >
      worksheetSortValue(c, "budget", new Date()),
  );
  assert.equal(defaultLayout("compact").sort.key, "chronological");
  assert.equal(
    migrateLayout({
      ...layout,
      version: 2,
      sort: { key: "score", direction: -1 },
    }).sort.key,
    "chronological",
  );
});
test("Excel export has expected value, separate VAT and workspace ID hyperlink", async () => {
  const rows = [true, false, null].map((vatIncluded) => ({
    ...tender(),
    expectedValue: 456,
    vatIncluded,
  }));
  const book = await createWorksheetWorkbook(rows, [
    { key: "budget", label: "Загальна сума", width: 150 },
    { key: "id", label: "ID", width: 150 },
  ]);
  const sheet = book.worksheets[0];
  assert.deepEqual(sheet.getRow(1).values.slice(1), [
    "Очікувана вартість",
    "ПДВ",
    "ID",
  ]);
  assert.equal(sheet.getCell("A2").value, 456);
  assert.deepEqual(
    [2, 3, 4].map((r) => sheet.getCell(r, 2).value),
    ["з ПДВ", "без ПДВ", "-"],
  );
  assert.match(sheet.getCell("C2").hyperlink, /zakupivli.pro/);
});
test("DOCX preview preserves headings, bold/italic, paragraphs and tables independently of extracted text", async () => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/styles.xml",
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style></w:styles>',
  );
  zip.file(
    "word/_rels/document.xml.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyle" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Умови</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>Гарантія</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>12 місяців</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
  );
  const preview = await renderDocumentPreview(
    await zip.generateAsync({ type: "nodebuffer" }),
    "terms.docx",
    null,
  );
  assert.equal(preview.previewType, "html");
  for (const tag of ["h1", "strong", "em", "table", "p"])
    assert.match(preview.html, new RegExp(`<${tag}[ >]`));
  assert.equal(preview.text, undefined);
});
test("Spreadsheet preview preserves sheet names/cell grid; HTML sanitizer blocks active content", async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ["Назва", "Кількість"],
      ["Насос", 4],
    ]),
    "Специфікація",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([["Інструкція"]]),
    "Довідка",
  );
  for (const bookType of ["xls", "xlsx"]) {
    const p = await renderDocumentPreview(
      XLSX.write(book, { type: "buffer", bookType }),
      `spec.${bookType}`,
      null,
    );
    assert.equal(p.previewType, "spreadsheet");
    assert.equal(p.sheets[0].rows[1][0], "Насос");
    assert.equal(p.sheets.length, 2);
  }
  const clean = cleanDocumentHTML(
    '<script>alert(1)</script><p onclick="alert(1)"><strong>Умови</strong></p><ul><li>Поставка</li></ul><img src=x onerror=alert(1)>',
  );
  assert.doesNotMatch(clean, /script|onclick|onerror|<img/);
  assert.match(clean, /<li>Поставка/);
});
test("PDF/image preview keeps original bytes; TXT is plain text; signature has metadata fallback", async () => {
  const pdf = Buffer.from("%PDF-1.4\nfixture");
  const p = await renderDocumentPreview(pdf, "file.pdf", "application/pdf");
  assert.equal(p.previewType, "pdf");
  assert.deepEqual(Buffer.from(p.base64, "base64"), pdf);
  assert.equal(p.text, undefined);
  assert.equal(
    (await renderDocumentPreview(Buffer.from("image"), "image.png", null))
      .previewType,
    "image",
  );
  assert.equal(
    (await renderDocumentPreview(Buffer.from("Умови"), "file.txt", null)).text,
    "Умови",
  );
  assert.equal(
    (await renderDocumentPreview(Buffer.from("signature"), "sign.p7s", null))
      .previewType,
    "unsupported",
  );
});
