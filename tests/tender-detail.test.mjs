import assert from "node:assert/strict";
import test from "node:test";
import { tenders } from "../src/lib/demo-data.ts";
import { detailFlow } from "../src/lib/tender-detail.ts";

const find = (id) => tenders.find((t) => t.id === id);

test("all equipment flows exclude filter catalogues and filter-specific document content", () => {
  for (const tender of tenders.filter((t) => t.topCategory === "Техніка")) {
    const flow = detailFlow(
      tender,
      [{ code: "LF9009" }],
      [{ text: "FS19532" }],
    );
    assert.equal(flow.parts.length, 0);
    assert.doesNotMatch(JSON.stringify(flow), /LF9009|FS19532|Fleetguard/);
    assert.equal(flow.documents.length, 6);
  }
});

test("crane specifications, delivery, warranty and risks match the handoff", () => {
  const flow = detailFlow(find("UA-2026-09-29-003902-a"), [], []);
  const specs = Object.fromEntries(flow.technical);
  assert.equal(specs["Модель"], "XCMG QY25K5 або еквівалент");
  assert.equal(specs["Кількість"], "2 од.");
  assert.equal(specs["Вантажопідйомність"], "25 т");
  assert.equal(specs["Колісна формула"], "6×4");
  assert.equal(specs["Гарантія"], "12 міс");
  assert.equal(flow.delivery, "До 90 днів");
  assert.equal(flow.risks.length, 5);
});

test("dump truck showcase keeps score 94 and marks unspecified requirements for confirmation", () => {
  const tender = find("UA-2026-10-02-004811-a");
  const flow = detailFlow(tender, [], []);
  assert.equal(tender.score, 94);
  assert.equal(Object.fromEntries(flow.technical)["Кількість"], "4 од.");
  assert.match(flow.summary, /основній діяльності компанії/);
  assert.equal(
    Object.fromEntries(flow.technical)["КПП"],
    "Уточнити за технічним завданням",
  );
});

test("filter catalogue stays scoped to the parts showcase, including imported copies", () => {
  const tender = find("UA-2026-08-25-006722-a");
  const parts = [
    {
      code: "LF9009",
      brand: "Fleetguard",
      name: "Фільтр",
      qty: 120,
      match: "Точний",
      status: "Підтверджено",
    },
  ];
  const documents = [
    {
      name: "Специфікація.xlsx",
      kind: "sheet",
      facts: [],
      sources: [],
      text: "",
    },
  ];
  assert.equal(detailFlow(tender, parts, documents).parts, parts);
  assert.equal(
    detailFlow({ ...tender, id: tender.id + "-IMP" }, parts, documents)
      .documents,
    documents,
  );
  assert.equal(
    detailFlow({ ...tender, topCategory: "Техніка" }, parts, documents).parts
      .length,
    0,
  );
  assert.equal(
    detailFlow(find("UA-2026-09-01-001485-a"), parts, documents).parts.length,
    0,
  );
});
