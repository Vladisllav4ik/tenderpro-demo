import test from "node:test";
import assert from "node:assert/strict";
import { detailFlow } from "../src/lib/tender-detail.ts";
import { canonicalTender } from "../src/lib/tender-model.ts";
import { tenders } from "./fixtures/tenders.ts";
import { tenders as runtime } from "../src/lib/demo-data.ts";
test("runtime has no seeded tender records", () =>
  assert.deepEqual(runtime, []));
test("old showcase IDs and equipment names never generate specs, warranty, documents or AI conclusions", () => {
  for (const old of tenders) {
    const { analysis, ...raw } = old;
    const t = { ...raw, importSource: "excel", objects: [], subject: "-" };
    const flow = detailFlow(t);
    assert.deepEqual(flow.documents, []);
    assert.deepEqual(flow.technical, []);
    assert.deepEqual(flow.parts, []);
    assert.deepEqual(flow.risks, []);
    assert.equal(flow.summary, "-");
    const final = canonicalTender(t);
    assert.equal(final.quantity, undefined);
    assert.equal(final.address, undefined);
    assert.equal(final.aiSummary, "-");
  }
});
test("detail flow uses only explicit source fields", () => {
  const { analysis, ...raw } = tenders[3];
  const t = {
    ...raw,
    importSource: "excel",
    technicalRequirements: ["Source spec"],
    qualificationRequirements: ["Source qualification"],
    specialRequirements: ["Warranty in source"],
  };
  assert.deepEqual(detailFlow(t).requirements, [
    "Source spec",
    "Source qualification",
    "Warranty in source",
  ]);
});
