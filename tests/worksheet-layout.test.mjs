import test from "node:test";
import assert from "node:assert/strict";
import { tenders } from "./fixtures/tenders.ts";
import {
  defaultLayout,
  layoutColumns,
  validLayout,
  compactOrder,
  detailedOrder,
  tableTender,
  worksheetValue,
  commentFill,
} from "../src/lib/worksheet-model.ts";
import { periodRange, exactTimestamp } from "../src/lib/tender-period.ts";
const now = new Date("2026-10-06T12:00:00Z");
test("compact and detailed modes apply their own exact logical order", () => {
  assert.deepEqual(
    layoutColumns(defaultLayout("compact"), "compact", true).map((c) => c.key),
    compactOrder,
  );
  assert.deepEqual(
    layoutColumns(defaultLayout("detailed"), "detailed", true).map(
      (c) => c.key,
    ),
    detailedOrder,
  );
  assert.equal(compactOrder.includes("link"), false);
});
test("mode layouts roundtrip independently with reorder, widths, hidden columns, pinning and sort", () => {
  const compact = defaultLayout("compact"),
    detailed = defaultLayout("detailed");
  compact.order.splice(4, 0, compact.order.splice(6, 1)[0]);
  compact.widths.title = 310;
  compact.visibility = compact.visibility.filter((k) => k !== "customer");
  compact.pinned.push("objects");
  compact.sort = { key: "title", direction: 1 };
  const restored = JSON.parse(JSON.stringify({ compact, detailed }));
  assert.ok(validLayout(restored.compact));
  assert.ok(validLayout(restored.detailed));
  assert.deepEqual(restored.detailed, defaultLayout("detailed"));
  const keys = layoutColumns(restored.compact, "compact", true).map(
    (c) => c.key,
  );
  assert.deepEqual(keys.slice(0, 3), ["number", "comment", "objects"]);
  assert.equal(keys.at(-1), "status");
  assert.equal(keys.includes("customer"), false);
  assert.equal(validLayout({ ...compact, widths: { title: -2 } }), false);
  assert.equal(validLayout({ ...compact, order: ["wrong"] }), false);
});
test("20+ objects remain separate data with honest quantity and price handling", () => {
  const objects = Array.from({ length: 22 }, (_, i) => ({
    name: "Позиція " + (i + 1),
    quantity: 2,
    unit: "шт.",
    catalogue: "CAT-" + i,
  }));
  const t = tableTender({ ...tenders[0], objects });
  assert.equal(t.objects.length, 22);
  assert.equal(t.quantity, 44);
  assert.equal(t.unit, "шт.");
  assert.equal(t.unitPrice, undefined);
  assert.equal(worksheetValue(t, "objects", 0, now).split("\n").length, 22);
});
test("requirements retain distinct technical/special/qualification sources", () => {
  const flow = {
    parts: [],
    technical: [
      ["Модель", "XCMG QY25K5"],
      ["Кількість", "2 од."],
    ],
    requirements: ["Сервісний центр", "Гарантія 12 міс"],
    documents: [
      {
        name: "Кваліфікаційні вимоги.pdf",
        facts: ["Досвід поставки"],
        sources: [],
        text: "",
        kind: "text",
      },
    ],
    delivery: "90 днів від підписання",
  };
  const t = tableTender(tenders[3], flow);
  assert.equal(t.quantity, 2);
  assert.match(worksheetValue(t, "technicalRequirements", 0, now), /XCMG/);
  assert.deepEqual(t.specialRequirements, [
    "Сервісний центр",
    "Гарантія 12 міс",
  ]);
  assert.deepEqual(t.qualificationRequirements, ["Досвід поставки"]);
  assert.equal(worksheetValue(t, "address", 0, now), "-");
});
test("delivery accepts date, range, datetime and normalized text", () => {
  assert.equal(periodRange({ end: "2026-11-30" }), "До 30.11.2026");
  assert.equal(
    periodRange({ start: "2026-11-01", end: "2026-11-30" }),
    "01.11.2026 → 30.11.2026",
  );
  assert.equal(
    periodRange({ text: "  90  днів від підписання  " }),
    "90 днів від підписання",
  );
  assert.match(periodRange({ start: "2026-11-01T12:00:00+02:00" }), /12:00/);
  assert.equal(exactTimestamp("2026-02-31T10:00:00Z"), null);
});
test("manual palette supports an empty note and is independent of status", () => {
  assert.equal(commentFill("purple"), "EBDDFA");
  assert.equal(commentFill("none"), null);
  assert.equal(
    worksheetValue(
      {
        ...tenders[0],
        commentText: "",
        commentColor: "green",
        status: "DISQUALIFIED",
      },
      "comment",
      0,
      now,
    ),
    "",
  );
});

test("invalid exact dates never throw or produce NaN remaining labels", () => {
  for (const value of [
    "2026-99-01T12:00:00Z",
    "2026-02-31T12:00:00Z",
    "2026-00-00T12:00:00Z",
  ])
    assert.equal(exactTimestamp(value), null);
});
