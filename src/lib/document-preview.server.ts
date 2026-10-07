import sanitizeHtml from "sanitize-html";
import type { DocumentPreview } from "./document-preview.ts";
import {
  TenderDocumentService,
  checkZipSize,
} from "./agents/document-service.server.ts";

export const cleanDocumentHTML = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "caption",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "br",
      "div",
      "span",
    ],
    allowedAttributes: {
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      ol: ["start"],
      li: ["value"],
    },
  });
const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export async function renderDocumentPreview(
  bytes: Buffer,
  name: string,
  mime: string | null,
): Promise<DocumentPreview> {
  const ext = name.split(".").at(-1)?.toLowerCase();
  const common = { sizeBytes: bytes.length };
  if (bytes.subarray(0, 4).toString() === "%PDF" || ext === "pdf")
    return {
      ...common,
      previewType: "pdf",
      mimeType: "application/pdf",
      base64: bytes.toString("base64"),
    };
  const images: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
  };
  if (ext && images[ext])
    return {
      ...common,
      previewType: "image",
      mimeType: images[ext],
      base64: bytes.toString("base64"),
    };
  if (ext === "docx" || mime?.includes("wordprocessingml")) {
    await checkZipSize(bytes);
    const mod = await import("mammoth");
    const result = await (mod.default ?? mod).convertToHtml(
      { buffer: bytes },
      {
        convertImage: (mod.default ?? mod).images.imgElement(async () => ({
          src: "",
        })),
      },
    );
    return {
      ...common,
      previewType: "html",
      html: cleanDocumentHTML(result.value),
      notice: result.messages.length
        ? "Складні елементи Word можуть відрізнятися від оригіналу."
        : undefined,
    };
  }
  if (ext === "doc" || mime === "application/msword") {
    const text = await new TenderDocumentService().extractText(
      bytes,
      name,
      mime,
    );
    return {
      ...common,
      previewType: "html",
      html: text
        .split(/\n+/)
        .filter(Boolean)
        .map((p) => `<p>${escape(p)}</p>`)
        .join(""),
      notice: "Спрощений preview DOC. Повне форматування доступне в оригіналі.",
    };
  }
  if (
    ["xls", "xlsx"].includes(ext ?? "") ||
    mime?.includes("spreadsheet") ||
    mime === "application/vnd.ms-excel"
  ) {
    if (ext !== "xls") await checkZipSize(bytes);
    const mod = await import("xlsx");
    const XLSX = mod.default ?? mod;
    const book = XLSX.read(bytes, { type: "buffer", cellDates: true });
    return {
      ...common,
      previewType: "spreadsheet",
      sheets: book.SheetNames.map((name) => {
        const all = XLSX.utils.sheet_to_json<string[]>(book.Sheets[name]!, {
          header: 1,
          raw: false,
          defval: "",
        });
        return {
          name,
          rows: all
            .slice(0, 2000)
            .map((row) => row.slice(0, 100).map((v) => String(v ?? ""))),
          truncated: all.length > 2000 || all.some((row) => row.length > 100),
        };
      }),
    };
  }
  if (ext === "txt" || mime?.startsWith("text/"))
    return {
      ...common,
      previewType: "text",
      text: (
        await new TenderDocumentService().extractText(bytes, name, mime)
      ).slice(0, 250000),
      notice:
        bytes.length > 250000
          ? "Preview скорочено; повний текст доступний в оригіналі."
          : undefined,
    };
  return {
    ...common,
    previewType: "unsupported",
    notice:
      "Цей формат не підтримує preview. Відкрийте або завантажте оригінал.",
  };
}
