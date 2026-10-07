import type { Tender } from "./demo-data.ts";

export function getExpectedValue(t: Tender): number | null {
  const value =
    t.expectedValue !== undefined
      ? t.expectedValue
      : (t.totalAmount ?? t.budget);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export const vatLabel = (
  value: boolean | null | undefined,
  unknown = "ПДВ: -",
) => (value === true ? "з ПДВ" : value === false ? "без ПДВ" : unknown);
export const expectedValueLabel = (t: Tender) => {
  const value = getExpectedValue(t);
  return value === null
    ? "-"
    : `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value)}${t.currency === "UAH" ? " ₴" : t.currency ? ` ${t.currency}` : ""}`;
};
const tenderId = (t: Tender) => t.id.replace(/-IMP.*$/, "");
function trustedURL(value: string | undefined, host: string) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" &&
      url.hostname === host &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export const sourceProzorroURL = (t: Tender) =>
  trustedURL(t.sourceUrlProzorro ?? t.sourceUrl, "prozorro.gov.ua") ??
  `https://prozorro.gov.ua/tender/${encodeURIComponent(tenderId(t))}`;
// Verified public tender pages use the lower-case human TenderID, not internal Prozorro IDs.
export const workspaceZakupivliURL = (t: Tender) =>
  trustedURL(t.workspaceUrlZakupivli, "zakupivli.pro") ??
  `https://zakupivli.pro/gov/tenders/${encodeURIComponent(tenderId(t).toLowerCase())}`;

export function presentationTender(
  t: Tender,
  source?: Record<string, any> | null,
): Tender {
  const next = {
    ...t,
    expectedValue: getExpectedValue(t),
    vatIncluded:
      typeof t.vatIncluded === "boolean" &&
      !["agent2", "agent3", "agent4"].includes(
        t.provenance?.["vatIncluded"]?.source ?? "",
      )
        ? t.vatIncluded
        : null,
    sourceUrlProzorro: sourceProzorroURL(t),
    workspaceUrlZakupivli: workspaceZakupivliURL(t),
    provenance: { ...t.provenance },
  };
  if (!next.provenance["expectedValue"] && t.provenance?.["budget"])
    next.provenance["expectedValue"] = t.provenance["budget"];
  if (
    next.vatIncluded === null &&
    typeof source?.["value"]?.valueAddedTaxIncluded === "boolean"
  ) {
    next.vatIncluded = source["value"].valueAddedTaxIncluded;
    next.provenance["vatIncluded"] = {
      source: "prozorro",
      sourceId: source["id"],
      evidence: `value.valueAddedTaxIncluded=${next.vatIncluded}`,
    };
  }
  return next;
}

const units: Record<string, string> = {
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
};
export const unitAbbreviation = (unit?: string) =>
  unit ? (units[unit.trim().toLocaleLowerCase("uk-UA")] ?? unit) : "";
export function subjectWithUnits(t: Tender): string {
  if (t.objects?.length)
    return (
      t.objects
        .slice(0, 2)
        .map((o) =>
          [
            o.name,
            o.quantity !== undefined
              ? `${o.quantity} ${unitAbbreviation(o.unit)}`.trim()
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join(";\n") +
      (t.objects.length > 2 ? `\nта ще ${t.objects.length - 2} позицій` : "")
    );
  return [
    t.subject ?? "-",
    t.quantity !== undefined
      ? `${t.quantity} ${unitAbbreviation(t.unit)}`.trim()
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function chronologicalCompare(a: Tender, b: Tender): number {
  const stamp = (value: string | null | undefined) =>
    value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const primary = (t: Tender) =>
    stamp(t.publishedAt) ?? stamp(t.createdAt) ?? 0;
  return (
    primary(a) - primary(b) ||
    (stamp(a.createdAt) ?? primary(a)) - (stamp(b.createdAt) ?? primary(b)) ||
    a.id.localeCompare(b.id)
  );
}
