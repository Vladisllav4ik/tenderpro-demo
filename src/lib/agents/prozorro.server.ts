import type { Tender } from "../demo-data.ts";
import type { JsonValue } from "./contracts.ts";
import { sanitizeSnapshot } from "./snapshots.server.ts";
import { presentationTender } from "../tender-presentation.ts";
import {
  parseTenderHierarchy,
  aggregateHierarchy,
} from "../tender-hierarchy.ts";
export class ProzorroSource {
  private request: typeof fetch;
  constructor(request: typeof fetch = fetch) {
    this.request = request;
  }
  private async json(url: string) {
    const r = await this.request(url, {
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (!r.ok) throw new Error(`Prozorro HTTP ${r.status}`);
    return r.json();
  }
  async fetchTender(id: string): Promise<Record<string, any>> {
    if (!/^UA-\d{4}-\d{2}-\d{2}-\d{6}-[a-z]$/i.test(id))
      throw new Error("Некоректний Prozorro Tender ID.");
    const summary = await this.json(
      `https://prozorro.gov.ua/api/tenders/${encodeURIComponent(id)}/summary`,
    );
    if (summary.tenderID !== id || !/^\w{32}$/.test(summary.id))
      throw new Error("Prozorro lookup не підтвердив ID.");
    const body = await this.json(
      `https://public-api.prozorro.gov.ua/api/2.5/tenders/${summary.id}`,
    );
    if (body?.data?.tenderID !== id)
      throw new Error("Prozorro повернув інший тендер.");
    return sanitizeSnapshot(body.data);
  }
  async fetchTenderDocuments(internalId: string) {
    if (!/^[a-f\d]{32}$/i.test(internalId))
      throw new Error("Некоректний source ID.");
    return (
      await this.json(
        `https://public-api.prozorro.gov.ua/api/2.5/tenders/${internalId}/documents`,
      )
    ).data as Record<string, any>[];
  }
  async fetchTenderQuestions(internalId: string) {
    if (!/^[a-f\d]{32}$/i.test(internalId))
      throw new Error("Некоректний source ID.");
    const body = await this.json(
      `https://public-api.prozorro.gov.ua/api/2.5/tenders/${internalId}/questions`,
    );
    if (!Array.isArray(body.data))
      throw new Error("Некоректний реєстр звернень.");
    return body.data as Record<string, any>[];
  }
}
const numeric = (v: any) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
const period = (p: any) =>
  p
    ? {
        ...(p.startDate ? { start: p.startDate } : {}),
        ...(p.endDate ? { end: p.endDate } : {}),
      }
    : undefined;
export function normalizeProzorro(
  raw: Tender,
  data: Record<string, any>,
): Tender {
  const t: Tender = {
    ...structuredClone(raw),
    provenance: { ...raw.provenance },
  };
  t.hierarchy = parseTenderHierarchy(data);
  const locked = new Set(raw.sourceFields ?? []);
  const put = (field: string, value: any) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      locked.has(field)
    )
      return;
    Object.assign(t, { [field]: value });
    t.provenance![field] = {
      source: "prozorro",
      sourceType: "prozorro_tender",
      sourceId: data["id"],
      evidence: `Prozorro ${field}`,
    };
  };
  const items: Array<Record<string, any>> = Array.isArray(data["items"])
    ? data["items"]
    : [];
  put("officialTitle", data["title"]);
  put("title", data["title"]);
  put("customer", data["procuringEntity"]?.name);
  put("description", data["description"]);
  put("budget", numeric(data["value"]?.amount));
  put("totalAmount", numeric(data["value"]?.amount));
  put("currency", data["value"]?.currency);
  const cpvs = [
    ...new Set(
      items
        .map((i) =>
          ["CPV", "ДК021"].includes(i["classification"]?.scheme)
            ? i["classification"].id
            : null,
        )
        .filter(Boolean),
    ),
  ];
  put("cpv", cpvs.length === 1 ? cpvs[0] : null);
  put("publishedAt", data["dateCreated"] ?? data["date"]);
  put("submissionPeriod", period(data["tenderPeriod"]));
  if (data["tenderPeriod"]) {
    const sourcePeriod = period(data["tenderPeriod"]);
    const merged = { ...t.submissionPeriod };
    for (const key of ["start", "end"] as const) {
      const value = sourcePeriod?.[key],
        current = merged[key];
      if (
        value &&
        (!current ||
          (/^\d{4}-\d{2}-\d{2}$/.test(current) &&
            value.slice(0, 10) === current))
      ) {
        merged[key] = value;
        t.provenance![`submissionPeriod.${key}`] = {
          source: "prozorro",
          sourceId: data["id"],
          evidence: value,
        };
      }
    }
    t.submissionPeriod = merged;
  }
  put("auctionPeriod", period(data["auctionPeriod"]));
  put("sourceUrl", `https://prozorro.gov.ua/tender/${data["tenderID"]}`);
  put("prozorroStatus", data["status"]);
  put("sourceItems", items as JsonValue[]);
  put("sourceLots", (data["lots"] ?? []) as JsonValue[]);
  const aggregate = aggregateHierarchy(t);
  if (!data["auctionPeriod"]?.startDate && aggregate.auction) {
    put("auctionPeriod", aggregate.auction);
    if (!locked.has("auctionPeriod"))
      t.provenance!["auctionPeriod"] = {
        source: "prozorro",
        sourceType: "prozorro_lot",
        sourceId: data["id"],
        lotId: aggregate.auctions[0]!.lotId,
        evidence: "lots[].auctionPeriod",
      };
  }
  if (
    numeric(data["value"]?.amount) === undefined &&
    aggregate.lotSum !== null
  ) {
    put("budget", aggregate.lotSum);
    put("totalAmount", aggregate.lotSum);
    put("expectedValue", aggregate.lotSum);
    put("currency", aggregate.lotCurrency);
  }
  if (items.length) {
    const units = items.map((i) => i["unit"]?.name ?? i["unit"]?.code);
    const same = units.every((u) => u && u === units[0]);
    if (same && items.every((i) => numeric(i["quantity"]) !== undefined)) {
      put(
        "quantity",
        items.reduce((n, i) => n + i["quantity"], 0),
      );
      put("unit", units[0]);
    }
    if (items.length === 1)
      put("unitPrice", numeric(items[0]!["unit"]?.value?.amount));
    const deliveries = items.map((i) => period(i["deliveryDate"]));
    if (
      deliveries[0] &&
      deliveries.every(
        (p) => JSON.stringify(p) === JSON.stringify(deliveries[0]),
      )
    )
      put("deliveryPeriod", deliveries[0]);
    const addresses = items.map((i) => i["deliveryAddress"]);
    if (
      addresses[0] &&
      addresses.every((a) => JSON.stringify(a) === JSON.stringify(addresses[0]))
    ) {
      const a = addresses[0];
      put(
        "address",
        [a.countryName, a.region, a.locality, a.streetAddress, a.postalCode]
          .filter(Boolean)
          .join(", "),
      );
    }
    put(
      "objects",
      items.map((i) => ({
        name: i["description"] ?? "",
        ...(numeric(i["quantity"]) !== undefined
          ? { quantity: i["quantity"] }
          : {}),
        ...(i["unit"]?.name ? { unit: i["unit"].name } : {}),
        characteristics: [],
      })),
    );
    put(
      "subject",
      items
        .slice(0, 2)
        .map(
          (i) =>
            `${i["description"]}${numeric(i["quantity"]) !== undefined ? ` — ${i["quantity"]} ${i["unit"]?.name ?? i["unit"]?.code ?? ""}` : ""}`,
        )
        .join("; ") +
        (items.length > 2 ? ` та ще ${items.length - 2} позицій` : ""),
    );
  }
  // Source status is procedure state, not evidence of our participation or victory.
  if (aggregate.quantity !== null) {
    put("quantity", aggregate.quantity);
    put("unit", aggregate.unit);
  }
  if (aggregate.delivery) put("deliveryPeriod", aggregate.delivery);
  if (aggregate.address) put("address", aggregate.address);
  for (const key of [
    "quantity",
    "unit",
    "unitPrice",
    "objects",
    "subject",
    "deliveryPeriod",
    "address",
  ])
    if (!locked.has(key) && t.provenance?.[key]?.source === "prozorro")
      t.provenance[key]!.sourceType =
        ["deliveryPeriod", "address"].includes(key) &&
        t.hierarchy.lots.some((l) =>
          key === "address" ? l.address : l.delivery,
        )
          ? "prozorro_lot"
          : "prozorro_item";
  const state =
    data["status"] === "cancelled"
      ? "cancelled"
      : data["status"] === "complete" || data["status"] === "unsuccessful"
        ? "closed"
        : "active";
  t.lifecycle = {
    ...raw.lifecycle,
    state,
    ...(Number.isFinite(Date.parse(data["dateModified"]))
      ? { updatedAt: new Date(data["dateModified"]).toISOString() }
      : {}),
  };
  return presentationTender(t, data);
}
