import test from "node:test";
import assert from "node:assert/strict";
import { tenders } from "./fixtures/tenders.ts";
import {
  defaultRange,
  resolveRange,
  inPublicationRange,
  validRange,
} from "../src/lib/table-range.ts";
import {
  defaultLayout,
  migrateLayout,
  layoutColumns,
  tableTender,
  worksheetValue,
} from "../src/lib/worksheet-model.ts";
const now = new Date("2026-10-07T12:00:00Z");
test("7-day default, 14-day, month and history windows filter publication dates inclusively", () => {
  const range = resolveRange(defaultRange, tenders, now);
  assert.deepEqual(range, { from: "2026-10-01", to: "2026-10-07" });
  assert.equal(tenders.filter((t) => inPublicationRange(t, range)).length, 4);
  assert.deepEqual(
    resolveRange({ ...defaultRange, preset: "14" }, tenders, now),
    { from: "2026-09-24", to: "2026-10-07" },
  );
  assert.deepEqual(
    resolveRange({ ...defaultRange, preset: "month" }, tenders, now),
    { from: "2026-09-08", to: "2026-10-07" },
  );
  assert.equal(
    tenders.filter((t) =>
      inPublicationRange(
        t,
        resolveRange({ ...defaultRange, preset: "history" }, tenders, now),
      ),
    ).length,
    17,
  );
});
test("custom ranges persist, include endpoints and reject reversed/invalid dates", () => {
  const range = { preset: "custom", from: "2026-08-25", to: "2026-08-25" };
  assert.ok(validRange(JSON.parse(JSON.stringify(range))));
  assert.equal(
    tenders.filter((t) =>
      inPublicationRange(t, resolveRange(range, tenders, now)),
    ).length,
    1,
  );
  assert.equal(validRange({ ...range, to: "2026-08-24" }), false);
  assert.equal(validRange({ ...range, to: "2026-02-31" }), false);
});
test("v1 layouts migrate requirements/order while preserving widths, visibility and sort", () => {
  const saved = {
    ...defaultLayout("detailed"),
    version: 1,
    order: [
      "number",
      "comment",
      "title",
      "objects",
      "quantity",
      "unit",
      "unitPrice",
      "budget",
      "id",
      "period",
      "auctionPeriod",
      "deliveryPeriod",
      "customer",
      "address",
      "topCategory",
      "specialRequirements",
      "technicalRequirements",
      "qualificationRequirements",
      "score",
      "status",
    ],
    widths: { title: 330 },
    pinned: ["number", "comment", "title"],
  };
  const migrated = migrateLayout(saved);
  assert.deepEqual(migrated.widths, { title: 330 });
  assert.deepEqual(migrated.visibility, saved.visibility);
  assert.deepEqual(migrated.sort, saved.sort);
  assert.equal(migrated.version, 2);
  const keys = layoutColumns(
    { ...migrated, pinned: ["number", "comment"] },
    "detailed",
    true,
  ).map((c) => c.key);
  assert.deepEqual(keys.slice(-6), [
    "technicalRequirements",
    "qualificationRequirements",
    "specialRequirements",
    "topCategory",
    "score",
    "status",
  ]);
});
test("requirements have no cross-column duplicates and unknown detail fields show a dash", () => {
  const t = tableTender({
    ...tenders[3],
    technicalRequirements: ["Модель XCMG", "Гарантія: 12 міс"],
    qualificationRequirements: ["Модель XCMG", "2 договори"],
    specialRequirements: [
      "Гарантія 12 міс",
      "2 договори",
      "Локалізація",
      "Уточнити параметри",
    ],
  });
  assert.deepEqual(t.qualificationRequirements, ["2 договори"]);
  assert.deepEqual(t.specialRequirements, ["Локалізація"]);
  for (const key of ["address", "unitPrice", "auctionPeriod"])
    assert.equal(worksheetValue(t, key, 0, now), "-");
});
