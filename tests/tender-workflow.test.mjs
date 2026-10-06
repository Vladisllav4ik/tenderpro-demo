import test from "node:test";
import assert from "node:assert/strict";
import { tenders } from "../src/lib/demo-data.ts";
import {
  normalizeTender,
  newTender,
  viewTender,
  recalculateTender,
  STATUS_RECALC_DELAY_MS,
  saveComment,
  classifyComment,
  expireTender,
  periodInfo,
  kyivToday,
} from "../src/lib/tender-workflow.ts";

const now = new Date("2026-10-06T12:00:00Z");
const fresh = () =>
  newTender(
    { ...tenders[1], id: "UA-2026-10-01-001-a", deadline: "20.10.2026" },
    now,
  );
test("migration preserves original data and normalizes old statuses without marking every row viewed", () => {
  const migrated = tenders.map((t) => normalizeTender(t, now));
  assert.equal(migrated[0].status, "NEW");
  assert.equal(migrated[1].status, "WAITING");
  assert.equal(migrated[2].status, "IN_PROGRESS");
  assert.equal(migrated[10].status, "REJECTED");
  assert.ok(migrated.every((t) => !t.firstViewedAt));
  assert.equal(migrated[1].budget, tenders[1].budget);
  assert.equal(migrated[1].publishedAt, "2026-10-02");
  assert.equal(tenders[0].status, "Новий");
});
test("new input resets copied workflow state regardless of source", () => {
  const t = newTender(
    {
      ...fresh(),
      status: "COMPLETED_SUCCESS",
      firstViewedAt: "old",
      completedAt: "old",
      manualStatusOverride: true,
      comment: "old",
    },
    now,
  );
  assert.equal(t.status, "NEW");
  assert.equal(t.comment, "old");
  assert.equal(t.firstViewedAt, undefined);
  assert.equal(t.completedAt, undefined);
  assert.equal(t.manualStatusOverride, false);
});
test("viewing one NEW row updates only that row and keeps the original first-view timestamp", () => {
  const a = fresh(),
    b = fresh();
  const viewed = viewTender(a, now);
  assert.equal(viewed.status, "WAITING");
  assert.equal(viewed.firstViewedAt, now.toISOString());
  assert.equal(b.status, "NEW");
  assert.equal(viewTender(viewed, new Date("2026-10-07T10:00:00Z")), viewed);
});
test("all requested working and rejecting comments classify deterministically", () => {
  for (const text of [
    "подали запит на КП",
    "чекаємо пропозицію",
    "запросили ціну",
    "подали документи",
    "прораховуємо",
    "готую документи",
    "чекаємо відповідь",
    "відправили постачальнику",
  ])
    assert.equal(classifyComment(text), "IN_PROGRESS", text);
  for (const text of [
    "не встигли",
    "не відповідає",
    "не наш профіль",
    "не підходимо",
    "дорого",
    "не цікаво",
    "не беремо",
    "немає товару",
    "строки не підходять",
  ])
    assert.equal(classifyComment(text), "REJECTED", text);
  assert.equal(classifyComment("  ГОТУЮ   ДОКУМЕНТИ "), "IN_PROGRESS");
});
test("ambiguous and negated working comments keep the status", () => {
  for (const text of [
    "уточнити гарантію",
    "дорого, але запросили ціну",
    "не готую документи",
    "недорого",
    "не дорого",
    "",
  ])
    assert.equal(classifyComment(text), null, text);
});
test("saved comments persist their time, first view and automatic status", () => {
  const t = saveComment(fresh(), "запросили ціну", now);
  assert.equal(t.status, "WAITING");
  assert.equal(
    recalculateTender(t, new Date(now.getTime() + STATUS_RECALC_DELAY_MS))
      .status,
    "IN_PROGRESS",
  );
  assert.equal(t.comment, "запросили ціну");
  assert.equal(t.firstViewedAt, now.toISOString());
  assert.equal(t.commentUpdatedAt, now.toISOString());
});
test("legacy manual override cannot block automatic recalculation", () => {
  const t = saveComment(
    normalizeTender({
      ...fresh(),
      status: "REJECTED",
      manualStatusOverride: true,
    }),
    "готую документи",
    now,
    0,
  );
  assert.equal(recalculateTender(t, now).status, "IN_PROGRESS");
});
test("delay survives reload, edits restart it, and repeated sync does not duplicate events", () => {
  const t = saveComment(fresh(), "готую документи", now, 180000);
  assert.equal(recalculateTender(t, new Date(now.getTime() + 179999)), t);
  const restored = JSON.parse(JSON.stringify(t));
  const synced = recalculateTender(restored, new Date(now.getTime() + 180000));
  assert.equal(synced.status, "IN_PROGRESS");
  assert.equal(synced.statusRecalcAt, undefined);
  assert.equal(recalculateTender(synced, now), synced);
  assert.equal(synced.history.filter((e) => e.kind === "status").length, 2);
  const edited = saveComment(
    t,
    "не беремо",
    new Date(now.getTime() + 100000),
    180000,
  );
  assert.equal(
    recalculateTender(edited, new Date(now.getTime() + 180000)).status,
    "WAITING",
  );
  assert.equal(
    recalculateTender(edited, new Date(now.getTime() + 280000)).status,
    "REJECTED",
  );
});
test("a late first view or comment cannot turn an expired NEW tender into a successful completion", () => {
  const expired = { ...fresh(), deadline: "05.10.2026" };
  const viewed = viewTender(expired, now);
  const commented = saveComment(expired, "готую документи", now);
  assert.equal(viewed.previousStatus, "NEW");
  assert.equal(viewed.status, "COMPLETED_FAILED");
  assert.equal(commented.status, "COMPLETED_FAILED");
  assert.equal(commented.comment, "готую документи");
});
test("expiration preserves previous status and records the correct completion type", () => {
  for (const status of ["NEW", "WAITING", "REJECTED", "IN_PROGRESS"]) {
    const t = expireTender({ ...fresh(), deadline: "05.10.2026", status }, now);
    assert.equal(
      t.status,
      status === "IN_PROGRESS" ? "COMPLETED_SUCCESS" : "COMPLETED_FAILED",
    );
    assert.equal(t.previousStatus, status);
    assert.equal(t.completedAt, now.toISOString());
    assert.equal(
      t.completionType,
      status === "IN_PROGRESS" ? "success" : "failed",
    );
    assert.equal(expireTender(t, new Date("2026-10-08T00:00:00Z")), t);
    assert.equal(saveComment(t, "готую документи", now).status, t.status);
  }
});
test("date-only deadline is available throughout the final Kyiv calendar day", () => {
  const t = { ...fresh(), deadline: "06.10.2026" };
  assert.equal(expireTender(t, new Date("2026-10-06T20:59:59Z")), t);
  assert.equal(
    expireTender(t, new Date("2026-10-06T21:00:00Z")).status,
    "COMPLETED_FAILED",
  );
  assert.equal(kyivToday(new Date("2026-10-06T21:00:00Z")), "2026-10-07");
});
test("expired outcomes cannot be changed by delayed comment processing", () => {
  const failed = expireTender({ ...fresh(), deadline: "05.10.2026" }, now);
  const saved = saveComment(failed, "готую документи", now, 0);
  assert.equal(recalculateTender(saved, now).status, "COMPLETED_FAILED");
  assert.equal(saved.previousStatus, "NEW");
});
test("period handles normal, urgent, expired and invalid deadlines", () => {
  assert.equal(periodInfo(fresh(), now).days, 14);
  assert.equal(
    periodInfo({ ...fresh(), deadline: "08.10.2026" }, now).tone,
    "red",
  );
  assert.equal(
    periodInfo({ ...fresh(), deadline: "05.10.2026" }, now).label,
    "Строк завершено",
  );
  assert.equal(
    periodInfo({ ...fresh(), deadline: "31.02.2026" }, now).days,
    null,
  );
});

test("period thresholds include seven amber and three red days with muted expiry", () => {
  for (const [deadline, tone] of [
    ["13.10.2026", "orange"],
    ["09.10.2026", "red"],
    ["14.10.2026", "normal"],
    ["05.10.2026", "expired"],
  ])
    assert.equal(periodInfo({ ...fresh(), deadline }, now).tone, tone);
});
