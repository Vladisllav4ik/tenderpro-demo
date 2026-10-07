import type { Tender } from "./demo-data.ts";
export function shortSubject(
  subject: string,
  objects: Tender["objects"] = [],
): string {
  const names = objects.map((o) => o.name).filter(Boolean);
  const text =
    names.length > 2
      ? `${names.slice(0, 2).join("; ")} та ще ${names.length - 2} позицій`
      : subject;
  return text.length > 240 ? `${text.slice(0, 237)}…` : text;
}
