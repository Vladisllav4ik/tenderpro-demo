import type { Tender } from "./demo-data.ts";
export type SourcePeriod = { start?: string; end?: string };
export type SourceItem = {
  id: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unitCode: string | null;
  cpv: string | null;
  lotId: string | null;
  delivery: SourcePeriod | null;
  address: string | null;
};
export type SourceLot = {
  id: string;
  title: string | null;
  status: string | null;
  value: number | null;
  currency: string | null;
  vatIncluded: boolean | null;
  auction: SourcePeriod | null;
  submission: SourcePeriod | null;
  delivery: SourcePeriod | null;
  address: string | null;
  itemIds: string[];
  documentIds: string[];
};
export type SourceQuestion = {
  id: string;
  title: string | null;
  question: string | null;
  date: string | null;
  answer: string | null;
  answerDate: string | null;
  lotId: string | null;
  status: string | null;
  sourceUrl: string;
  classification: string | null;
  impact: string | null;
  changeClaimed: boolean;
  changeVerified: boolean;
  verificationEvidence: string[];
};
export type DocumentVersion = {
  documentId: string;
  versionId: string;
  name: string;
  datePublished: string | null;
  dateModified: string | null;
  hash: string | null;
  sourceUrl: string;
  cacheKey: string | null;
  parseStatus: string;
  text: string;
  lotId: string | null;
  revision: string | null;
};
export type TenderHierarchy = {
  customerCode: string | null;
  lots: SourceLot[];
  items: SourceItem[];
  questions: SourceQuestion[];
  revisions: import("./agents/contracts.ts").JsonValue[];
  documentVersions: DocumentVersion[];
};
export const sourcePeriod = (p: any): SourcePeriod | null =>
  p && (typeof p.startDate === "string" || typeof p.endDate === "string")
    ? {
        ...(typeof p.startDate === "string" ? { start: p.startDate } : {}),
        ...(typeof p.endDate === "string" ? { end: p.endDate } : {}),
      }
    : null;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
export function sourceAddress(a: any): string | null {
  return a
    ? [a.countryName, a.region, a.locality, a.streetAddress, a.postalCode]
        .filter((v) => typeof v === "string" && v.trim())
        .join(", ") || null
    : null;
}
function common<T>(values: (T | null)[]): T | null {
  return values.length &&
    values[0] !== null &&
    values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]))
    ? values[0]!
    : null;
}
export function parseTenderHierarchy(
  data: Record<string, any>,
  versions: DocumentVersion[] = [],
): TenderHierarchy {
  const items: SourceItem[] = arr(data["items"]).map((i) => ({
    id: String(i.id ?? ""),
    description: str(i.description),
    quantity: num(i.quantity),
    unit: str(i.unit?.name ?? i.unit?.code),
    unitCode: str(i.unit?.code),
    cpv: ["CPV", "ДК021"].includes(i.classification?.scheme)
      ? str(i.classification?.id)
      : null,
    lotId: str(i.relatedLot),
    delivery: sourcePeriod(i.deliveryDate),
    address: sourceAddress(i.deliveryAddress),
  }));
  const lots: SourceLot[] = arr(data["lots"]).map((l) => {
    const related = items.filter((i) => i.lotId === l.id);
    return {
      id: String(l.id ?? ""),
      title: str(l.title),
      status: str(l.status),
      value: num(l.value?.amount),
      currency: str(l.value?.currency),
      vatIncluded:
        typeof l.value?.valueAddedTaxIncluded === "boolean"
          ? l.value.valueAddedTaxIncluded
          : null,
      auction: sourcePeriod(l.auctionPeriod),
      submission: sourcePeriod(l.tenderPeriod ?? l.submissionPeriod),
      delivery:
        sourcePeriod(l.deliveryDate) ?? common(related.map((i) => i.delivery)),
      address:
        sourceAddress(l.deliveryAddress) ??
        common(related.map((i) => i.address)),
      itemIds: related.map((i) => i.id),
      documentIds: versions
        .filter((d) => d.lotId === l.id)
        .map((d) => d.documentId),
    };
  });
  const questions: SourceQuestion[] = arr(data["questions"]).map((q) => ({
    id: String(q.id ?? ""),
    title: str(q.title),
    question: str(q.description),
    date: str(q.date),
    answer: str(q.answer),
    answerDate: str(q.dateAnswered),
    lotId:
      q.questionOf === "lot"
        ? str(q.relatedItem)
        : (items.find((i) => i.id === q.relatedItem)?.lotId ?? null),
    status: str(q.status),
    sourceUrl: `https://prozorro.gov.ua/tender/${data["tenderID"]}#questions`,
    classification: null,
    impact: null,
    changeClaimed:
      /змін[\s\S]{0,45}(опублік|внес|внесен|буде)|нов[\s\S]{0,20}редакц/iu.test(
        q.answer ?? "",
      ),
    changeVerified: false,
    verificationEvidence: [],
  }));
  return {
    customerCode: str(data["procuringEntity"]?.identifier?.id),
    lots,
    items,
    questions,
    revisions: arr(data["revisions"]),
    documentVersions: versions,
  };
}
export function verifyQuestionChanges(h: TenderHierarchy): TenderHierarchy {
  return {
    ...h,
    questions: h.questions.map((q) => {
      if (!q.changeClaimed || !q.date) return q;
      const evidence = h.documentVersions.filter(
        (d) =>
          (!q.lotId || !d.lotId || d.lotId === q.lotId) &&
          Date.parse(d.dateModified ?? d.datePublished ?? "") >=
            Date.parse(q.date!) &&
          (h.documentVersions.some(
            (old) =>
              old.documentId === d.documentId &&
              old.versionId !== d.versionId &&
              Date.parse(old.dateModified ?? old.datePublished ?? "") <
                Date.parse(d.dateModified ?? d.datePublished ?? ""),
          ) ||
            /змін|нова редакц/iu.test(d.name)),
      );
      return {
        ...q,
        changeVerified: evidence.length > 0,
        verificationEvidence: evidence.map(
          (d) =>
            `${d.documentId} / ${d.versionId} / ${d.dateModified ?? d.datePublished}`,
        ),
      };
    }),
  };
}
export function aggregateHierarchy(t: Tender) {
  const h = t.hierarchy;
  const lots = h?.lots ?? [],
    items = h?.items ?? [];
  const auctions = lots
    .filter((l) => l.auction?.start)
    .map((l) => ({ lotId: l.id, title: l.title, date: l.auction!.start! }));
  const dates = [...new Set(auctions.map((a) => a.date))];
  const unitKeys = items.map((i) => i.unitCode ?? i.unit);
  const homogeneous =
    items.length > 0 &&
    !!unitKeys[0] &&
    unitKeys.every((u) => u === unitKeys[0]) &&
    items.every((i) => i.quantity !== null);
  const deliveries = lots.some((l) => l.delivery)
    ? lots.map((l) => l.delivery)
    : items.map((i) => i.delivery);
  const addresses = lots.some((l) => l.address)
    ? lots.map((l) => l.address)
    : items.map((i) => i.address);
  const delivery = common(deliveries),
    address = common(addresses);
  const differing = (v: unknown[]) =>
    new Set(v.filter((x) => x != null).map((x) => JSON.stringify(x))).size > 1;
  const currencies = lots.map((l) => l.currency);
  const sum =
    lots.length > 0 &&
    lots.every((l) => l.value !== null && l.currency !== null) &&
    new Set(currencies).size === 1 &&
    !lots.some((l) => l.status === "cancelled")
      ? lots.reduce((n, l) => n + l.value!, 0)
      : null;
  return {
    lotCount: lots.length,
    auctions,
    auction: t.auctionPeriod?.start
      ? t.auctionPeriod
      : dates.length === 1
        ? { start: dates[0]! }
        : null,
    multipleAuctions: !t.auctionPeriod?.start && dates.length > 1,
    quantity: homogeneous ? items.reduce((n, i) => n + i.quantity!, 0) : null,
    unit: homogeneous ? items[0]!.unit : null,
    multipleUnits: items.length > 1 && new Set(unitKeys).size > 1,
    delivery,
    address,
    multipleDelivery:
      differing(deliveries) || differing(items.map((i) => i.delivery)),
    multipleAddresses:
      differing(addresses) || differing(items.map((i) => i.address)),
    multipleSubmission: differing([
      t.submissionPeriod,
      ...lots.map((l) => l.submission),
    ]),
    lotSum: sum,
    lotCurrency: sum !== null ? currencies[0] : null,
    differingFields: [
      ...(dates.length > 1 ? ["auction"] : []),
      ...(differing(lots.map((l) => l.submission)) ? ["submission"] : []),
      ...(differing(items.map((i) => i.delivery)) ? ["delivery"] : []),
      ...(differing(items.map((i) => i.address)) ? ["address"] : []),
    ],
  };
}
