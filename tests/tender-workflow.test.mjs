import test from "node:test";
import assert from "node:assert/strict";
import { tenders } from "../src/lib/demo-data.ts";
import {
  normalizeTender,
  newTender,
  viewTender,
  saveComment,
  classifyComment,
  recalculateTender,
  syncLifecycle,
  expireTender,
  periodInfo,
  statusTone,
  statusLabel,
  STATUS_RECALC_DELAY_MS,
} from "../src/lib/tender-workflow.ts";
const now = new Date("2026-10-06T12:00:00Z");
const fresh = () =>
  newTender(
    { ...tenders[1], id: "UA-2026-10-01-001-a", deadline: "20.10.2026" },
    now,
  );
test("migration preserves procurement data and moves legacy completions without claiming a win", () => {
  const t = normalizeTender(
    { ...tenders[1], status: "COMPLETED_SUCCESS", comment: "Текст" },
    now,
  );
  assert.equal(t.status, "CLOSED_NO_PARTICIPATION");
  assert.equal(t.commentText, "Текст");
  assert.equal(t.commentColor, "none");
  assert.equal(t.firstViewedAt, undefined);
  assert.equal(t.budget, tenders[1].budget);
  assert.equal(tenders[0].status, "Новий");
});
test("new records reset copied workflow, lifecycle, color and history", () => {
  const t = newTender(
    {
      ...fresh(),
      status: "WON",
      lifecycle: { decision: "won" },
      firstViewedAt: "old",
      commentColor: "green",
      completedAt: "old",
    },
    now,
  );
  assert.equal(t.status, "NEW");
  assert.equal(t.lifecycle, undefined);
  assert.equal(t.commentColor, "none");
  assert.equal(t.firstViewedAt, undefined);
  assert.deepEqual(
    t.history.map((e) => e.kind),
    ["imported"],
  );
});
test("only actual first view transitions NEW and repeated viewing is idempotent", () => {
  const t = fresh(),
    viewed = viewTender(t, now);
  assert.equal(t.status, "NEW");
  assert.equal(viewed.status, "WAITING");
  assert.equal(viewed.firstViewedAt, now.toISOString());
  assert.equal(viewTender(viewed, now), viewed);
});
test("work and neutral negative comments classify with conservative context", () => {
  for (const note of [
    "подали запит на КП",
    "чекаємо пропозицію",
    "запросили ціну",
    "подали документи",
    "прораховуємо",
    "готую документи",
    "чекаємо відповідь",
    "відправили постачальнику",
  ])
    assert.equal(classifyComment(note), "IN_PROGRESS", note);
  for (const note of [
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
    assert.equal(classifyComment(note), "REJECTED", note);
  for (const note of [
    "не готую документи",
    "дорого, але запросили ціну",
    "не дорого",
    "недорого",
    "можливо дискваліфіковано",
    "ризик: відхилено",
    "не дискваліфіковано",
    "перемога?",
    "",
  ])
    assert.equal(classifyComment(note), null, note);
});
test("administrative outcomes have distinct semantics and colors", () => {
  for (const [note, status, tone] of [
    ["дискваліфіковано", "DISQUALIFIED", "red"],
    ["відхилено", "STRONG_REJECTED", "red"],
    ["критична невідповідність", "CRITICAL_MISMATCH", "red"],
    ["не подали", "NOT_SUBMITTED", "orange"],
    ["не перемогли", "LOST", "orange"],
    ["скасовано замовником", "CANCELLED", "gray"],
    ["закрито без участі", "CLOSED_NO_PARTICIPATION", "orange"],
  ]) {
    assert.equal(classifyComment(note), status);
    assert.equal(statusTone(status), tone);
  }
  assert.equal(statusTone("REJECTED"), "orange");
  assert.equal(statusTone("WON"), "green");
  assert.equal(statusLabel("WAITING_DECISION"), "Очікує рішення");
});
test("comment autosave and delayed status are independent from manual colors", () => {
  for (const color of [
    "none",
    "yellow",
    "green",
    "red",
    "blue",
    "purple",
    "gray",
  ]) {
    const t = saveComment(
      { ...fresh(), commentColor: color },
      "готую документи",
      now,
    );
    assert.equal(t.commentText, "готую документи");
    assert.equal(t.status, "WAITING");
    assert.equal(t.commentColor, color);
    assert.equal(recalculateTender(t, new Date(now.getTime() + 179999)), t);
    const applied = recalculateTender(
      JSON.parse(JSON.stringify(t)),
      new Date(now.getTime() + STATUS_RECALC_DELAY_MS),
    );
    assert.equal(applied.status, "IN_PROGRESS");
    assert.equal(applied.commentColor, color);
    assert.equal(applied.statusRecalcAt, undefined);
  }
});
test("edits restart the delay and reload/sync do not duplicate transitions", () => {
  const first = saveComment(fresh(), "готую документи", now);
  const second = saveComment(
    first,
    "не беремо",
    new Date(now.getTime() + 100000),
  );
  assert.equal(
    recalculateTender(second, new Date(now.getTime() + 180000)).status,
    "WAITING",
  );
  const applied = recalculateTender(second, new Date(now.getTime() + 280000));
  assert.equal(applied.status, "REJECTED");
  assert.equal(recalculateTender(applied, now), applied);
});
test("awaiting decision depends on participation rather than a single phrase", () => {
  assert.equal(
    recalculateTender(saveComment(fresh(), "очікує рішення", now, 0), now)
      .status,
    "WAITING",
  );
  assert.equal(
    recalculateTender(
      saveComment({ ...fresh(), stage: "Подано" }, "очікує рішення", now, 0),
      now,
    ).status,
    "WAITING_DECISION",
  );
  assert.equal(
    recalculateTender(
      saveComment(fresh(), "подали пропозицію, очікує рішення", now, 0),
      now,
    ).status,
    "WAITING_DECISION",
  );
});
test("passing submission deadline cannot fabricate a win", () => {
  for (const status of ["NEW", "WAITING", "IN_PROGRESS", "REJECTED"]) {
    const t = expireTender({ ...fresh(), status, deadline: "05.10.2026" }, now);
    assert.notEqual(t.status, "WON");
    assert.equal(
      t.status,
      status === "IN_PROGRESS" ? "NOT_SUBMITTED" : "CLOSED_NO_PARTICIPATION",
    );
    assert.equal(expireTender(t, now), t);
  }
  const submitted = expireTender(
    {
      ...fresh(),
      deadline: "05.10.2026",
      lifecycle: { participation: "submitted" },
    },
    now,
  );
  assert.equal(submitted.status, "WAITING_DECISION");
});
test("source lifecycle transitions persist history and confirmed award overrides an old local result", () => {
  let t = viewTender(fresh(), now);
  t = recalculateTender(saveComment(t, "готую документи", now, 0), now);
  t = recalculateTender(
    syncLifecycle(
      t,
      { participation: "submitted", decision: "pending" },
      now,
      0,
    ),
    now,
  );
  assert.equal(t.status, "WAITING_DECISION");
  t = recalculateTender(
    syncLifecycle(t, { state: "disqualified" }, now, 0),
    now,
  );
  assert.equal(t.status, "DISQUALIFIED");
  t = recalculateTender(
    syncLifecycle(t, { state: "awarded", decision: "won" }, now, 0),
    now,
  );
  assert.equal(t.status, "WON");
  assert.deepEqual(
    t.history.filter((e) => e.kind === "status").map((e) => e.to),
    ["WAITING", "IN_PROGRESS", "WAITING_DECISION", "DISQUALIFIED", "WON"],
  );
  const current = t;
  assert.equal(recalculateTender(t, now), current);
});
test("lifecycle context delay survives reload; cancelled state stays separate", () => {
  const t = syncLifecycle(fresh(), { state: "cancelled" }, now);
  assert.equal(recalculateTender(t, now).status, "NEW");
  const applied = recalculateTender(
    JSON.parse(JSON.stringify(t)),
    new Date(now.getTime() + 180000),
  );
  assert.equal(applied.status, "CANCELLED");
  assert.equal(applied.commentColor, "none");
});
test("date-only deadlines retain the whole Kyiv day; precise times count hours/minutes", () => {
  const t = { ...fresh(), deadline: "06.10.2026" };
  assert.equal(expireTender(t, new Date("2026-10-06T20:59:59Z")), t);
  assert.equal(
    expireTender(t, new Date("2026-10-06T21:00:00Z")).status,
    "CLOSED_NO_PARTICIPATION",
  );
  const p = periodInfo(
    {
      ...fresh(),
      submissionPeriod: {
        start: "2026-10-06T10:00:00+03:00",
        end: "2026-10-06T18:30:00+03:00",
      },
    },
    now,
  );
  assert.equal(p.label, "3 год 30 хв");
  assert.match(p.endLabel, /18:30/);
  assert.equal(
    periodInfo({ ...fresh(), deadline: "31.02.2026" }, now).days,
    null,
  );
});

test("administrative context after submission remains stable until fresher lifecycle data arrives", () => {
  const pending = {
    ...fresh(),
    deadline: "05.10.2026",
    lifecycle: {
      participation: "submitted",
      decision: "pending",
      updatedAt: "2026-10-05T10:00:00Z",
    },
  };
  const t = recalculateTender(
    saveComment(pending, "дискваліфіковано", now, 0),
    now,
  );
  assert.equal(t.status, "DISQUALIFIED");
  assert.equal(recalculateTender(t, new Date(now.getTime() + 1000)), t);
  const freshSource = syncLifecycle(
    t,
    { state: "awarded", decision: "won" },
    new Date(now.getTime() + 2000),
    0,
  );
  assert.equal(
    recalculateTender(freshSource, new Date(now.getTime() + 2000)).status,
    "WON",
  );
  const closed = recalculateTender(
    syncLifecycle(
      fresh(),
      { state: "closed", participation: "submitted" },
      now,
      0,
    ),
    now,
  );
  assert.equal(closed.status, "WAITING_DECISION");
});
