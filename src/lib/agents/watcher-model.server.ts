import { createHash } from "node:crypto";
import type { SourceDocument } from "./source-contracts.ts";
import type { DocumentVersion } from "../tender-hierarchy.ts";
export function stableJSON(value: unknown): string {
  if (Array.isArray(value))
    return JSON.stringify(value.map((v) => JSON.parse(stableJSON(v))));
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, JSON.parse(stableJSON(v))]),
      ),
    );
  return JSON.stringify(value ?? null);
}
export const fingerprint = (v: unknown) =>
  createHash("sha256").update(stableJSON(v)).digest("hex");
const ordered = (v: any[]) =>
  [...v].sort((a, b) =>
    String(a.id ?? a.documentId).localeCompare(String(b.id ?? b.documentId)),
  );
export type Fingerprints = {
  structuredDataHash: string;
  lotsHash: string;
  itemsHash: string;
  documentsHash: string;
  questionsHash: string;
  answersHash: string;
};
export function fingerprints(
  data: Record<string, any>,
  docs: SourceDocument[],
): Fingerprints {
  const { lots = [], items = [], documents, questions = [], ...base } = data;
  return {
    structuredDataHash: fingerprint(base),
    lotsHash: fingerprint(ordered(lots)),
    itemsHash: fingerprint(ordered(items)),
    documentsHash: fingerprint(
      ordered(
        docs.map((d) => ({
          documentId: d.documentId,
          name: d.name,
          url: d.url,
          mimeType: d.mimeType,
          dateModified: d.dateModified,
          datePublished: d.datePublished,
          lotId: d.lotId ?? null,
          revision: d.revision ?? null,
          sourceHash: d.sourceHash ?? null,
          contentHash: d.contentHash ?? null,
        })),
      ),
    ),
    questionsHash: fingerprint(
      ordered(
        questions.map((q: any) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          date: q.date,
          questionOf: q.questionOf,
          relatedItem: q.relatedItem,
        })),
      ),
    ),
    answersHash: fingerprint(
      ordered(
        questions.map((q: any) => ({
          id: q.id,
          answer: q.answer ?? null,
          dateAnswered: q.dateAnswered ?? null,
        })),
      ),
    ),
  };
}
export function mergeDocumentVersions(
  previous: DocumentVersion[],
  docs: SourceDocument[],
): DocumentVersion[] {
  const version = (d: DocumentVersion) =>
    fingerprint([
      d.documentId,
      d.sourceUrl,
      d.dateModified,
      d.revision,
      d.hash,
    ]);
  const map = new Map(
    previous.map((d) => {
      const versionId = version(d);
      return [versionId, { ...d, versionId }] as const;
    }),
  );
  for (const d of docs) {
    const versionId = fingerprint([
      d.documentId,
      d.url,
      d.dateModified,
      d.revision ?? null,
      d.contentHash ?? null,
    ]);
    d.versionId = versionId;
    for (const [key, old] of map)
      if (
        !old.hash &&
        old.documentId === d.documentId &&
        old.sourceUrl === d.url &&
        old.dateModified === d.dateModified
      )
        map.delete(key);
    map.set(versionId, {
      documentId: d.documentId,
      versionId,
      name: d.name,
      datePublished: d.datePublished,
      dateModified: d.dateModified,
      hash: d.contentHash ?? null,
      sourceUrl: d.url,
      cacheKey: d.cacheKey ?? null,
      parseStatus: d.parseStatus,
      text: d.text,
      lotId: d.lotId ?? null,
      revision: d.revision ?? null,
    });
  }
  return [...map.values()];
}
export function textDelta(before: string, after: string, max = 18000) {
  if (before === after) return { before: "", after: "", truncated: false };
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++;
  const a = before.slice(Math.max(0, start - 600), before.length - end + 600),
    b = after.slice(Math.max(0, start - 600), after.length - end + 600);
  return {
    before: a.slice(0, max),
    after: b.slice(0, max),
    truncated: a.length > max || b.length > max,
  };
}
export type ChangePlan = {
  changed: boolean;
  structured: boolean;
  semantic: boolean;
  lifecycle: boolean;
  documents: string[];
  questions: string[];
  answers: string[];
  reasons: string[];
  removedDocuments: string[];
};
export function classifyChanges(
  old: Record<string, any>,
  fresh: Record<string, any>,
  oldDocs: SourceDocument[],
  docs: SourceDocument[],
): ChangePlan {
  const a = fingerprints(old, oldDocs),
    b = fingerprints(fresh, docs);
  const changed = Object.keys(a).some(
    (k) => a[k as keyof Fingerprints] !== b[k as keyof Fingerprints],
  );
  if (!changed)
    return {
      changed: false,
      structured: false,
      semantic: false,
      lifecycle: false,
      documents: [],
      removedDocuments: [],
      questions: [],
      answers: [],
      reasons: [],
    };
  const changedDocs = docs
    .filter((d) => {
      const p = oldDocs.find((x) => x.documentId === d.documentId);
      return (
        !p ||
        (p.contentHash && d.contentHash
          ? p.contentHash !== d.contentHash
          : fingerprint([p.url, p.dateModified, p.name]) !==
            fingerprint([d.url, d.dateModified, d.name]))
      );
    })
    .map((d) => d.documentId);
  const removedDocuments = oldDocs
    .filter((d) => !docs.some((x) => x.documentId === d.documentId))
    .map((d) => d.documentId);
  const questions = (fresh["questions"] ?? [])
    .filter((q: any) => {
      const p = (old["questions"] ?? []).find((x: any) => x.id === q.id);
      return (
        !p ||
        fingerprint([p.title, p.description]) !==
          fingerprint([q.title, q.description])
      );
    })
    .map((q: any) => q.id);
  const answers = (fresh["questions"] ?? [])
    .filter((q: any) => {
      const p = (old["questions"] ?? []).find((x: any) => x.id === q.id);
      return (q.answer || p?.answer) && (!p || p.answer !== q.answer);
    })
    .map((q: any) => q.id);
  const requirementChange =
    fingerprint([
      old["title"],
      old["description"],
      old["features"],
      ordered(old["items"] ?? []).map((i: any) => [
        i.id,
        i.description,
        i.classification,
      ]),
    ]) !==
    fingerprint([
      fresh["title"],
      fresh["description"],
      fresh["features"],
      ordered(fresh["items"] ?? []).map((i: any) => [
        i.id,
        i.description,
        i.classification,
      ]),
    ]);
  const lifecycle =
    fingerprint([
      old["status"],
      old["awards"],
      old["qualifications"],
      old["cancellations"],
      ordered(old["lots"] ?? []).map((l: any) => [l.id, l.status]),
    ]) !==
    fingerprint([
      fresh["status"],
      fresh["awards"],
      fresh["qualifications"],
      fresh["cancellations"],
      ordered(fresh["lots"] ?? []).map((l: any) => [l.id, l.status]),
    ]);
  const semantic =
    changedDocs.length > 0 ||
    removedDocuments.length > 0 ||
    questions.length > 0 ||
    answers.length > 0 ||
    requirementChange ||
    fingerprint(old["complaints"]) !== fingerprint(fresh["complaints"]);
  return {
    changed,
    structured:
      a.structuredDataHash !== b.structuredDataHash ||
      a.lotsHash !== b.lotsHash ||
      a.itemsHash !== b.itemsHash,
    semantic,
    lifecycle,
    documents: changedDocs,
    removedDocuments,
    questions,
    answers,
    reasons: [
      ...(changedDocs.length ? ["document changed/new"] : []),
      ...(removedDocuments.length ? ["document removed"] : []),
      ...(questions.length ? ["question changed/new"] : []),
      ...(answers.length ? ["answer changed/new"] : []),
      ...(requirementChange ? ["structured subject/requirements changed"] : []),
      ...(lifecycle ? ["lifecycle changed"] : []),
    ],
  };
}
export const defaultWatchCadence = {
  activeHours: 3,
  nearDeadlineHours: 1,
  afterSubmissionHours: 12,
  nearDeadlineWindowHours: 24,
};
export function nextWatch(
  data: Record<string, any>,
  now = new Date(),
  config = defaultWatchCadence,
): string | null {
  if (["complete", "cancelled", "unsuccessful"].includes(data["status"]))
    return null;
  const end = Date.parse(data["tenderPeriod"]?.endDate ?? ""),
    remaining = end - now.getTime();
  const hours =
    remaining <= 0
      ? config.afterSubmissionHours
      : remaining < config.nearDeadlineWindowHours * 3600000
        ? config.nearDeadlineHours
        : config.activeHours;
  return new Date(now.getTime() + hours * 3600000).toISOString();
}
export type WatcherState = {
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  nextCheckAt: string | null;
  changeDetected: boolean;
  fingerprints: Fingerprints;
  plan: ChangePlan | null;
  reason: string[];
  agent3Started: boolean;
  scope: string[];
  tokensUsed: number | null;
  aiCalls: number;
  error: string | null;
};
