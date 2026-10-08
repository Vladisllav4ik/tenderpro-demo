import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SourceDocument } from "./source-contracts.ts";
import { ProzorroSource } from "./prozorro.server.ts";
const MAX_BYTES = 20 * 1024 * 1024,
  MAX_TEXT = 250000;
function safeURL(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    !(
      u.hostname === "prozorro.gov.ua" ||
      u.hostname.endsWith(".prozorro.gov.ua") ||
      u.hostname.endsWith(".amazonaws.com")
    )
  )
    throw new Error("Непідтримуваний document host.");
  return u.toString();
}
export class TenderDocumentService {
  private request: typeof fetch;
  private directory: string;
  constructor(
    request: typeof fetch = fetch,
    directory = join(process.cwd(), ".tenderpro-local", "documents"),
  ) {
    this.request = request;
    this.directory = directory;
  }
  async fetchTenderDocuments(tenderId: string) {
    return new ProzorroSource(this.request).fetchTenderDocuments(tenderId);
  }
  register(raw: Record<string, any>[]): SourceDocument[] {
    return raw.map((d) => ({
      documentId: d["id"],
      name: d["title"] ?? d["id"],
      url: d["url"],
      mimeType: d["format"] ?? null,
      datePublished: d["datePublished"] ?? null,
      dateModified: d["dateModified"] ?? null,
      sourceHash: typeof d["hash"] === "string" ? d["hash"] : null,
      lotId: d["documentOf"] === "lot" ? (d["relatedItem"] ?? null) : null,
      revision: d["revision"] ?? d["version"] ?? null,
      versionId: createHash("sha256")
        .update(
          JSON.stringify([
            d["id"],
            d["url"],
            d["dateModified"],
            d["revision"] ?? d["version"],
          ]),
        )
        .digest("hex"),
      source: "prozorro",
      downloadStatus: "pending",
      parseStatus: "pending",
      text: "",
      error: null,
    }));
  }
  async downloadDocument(doc: SourceDocument): Promise<Buffer> {
    const previousKey = doc.cacheKey;
    const cacheKey = createHash("sha256")
      .update(
        `${doc.documentId}:${doc.url}:${doc.dateModified}${doc.sourceHash ? `:${doc.sourceHash}` : ""}`,
      )
      .digest("hex");
    const path = join(this.directory, cacheKey + ".bin");
    for (const candidate of [
      ...new Set([cacheKey, ...(previousKey ? [previousKey] : [])]),
    ])
      try {
        const bytes = await readFile(join(this.directory, candidate + ".bin"));
        const checksum = doc.sourceHash?.match(/^(md5|sha256):([a-f\d]+)$/i);
        if (
          checksum &&
          createHash(checksum[1]!).update(bytes).digest("hex") !==
            checksum[2]!.toLowerCase()
        )
          continue;
        doc.cacheKey = candidate;
        doc.contentHash = createHash("sha256").update(bytes).digest("hex");
        doc.sizeBytes = bytes.length;
        doc.downloadStatus = "downloaded";
        return bytes;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    doc.cacheKey = cacheKey;
    let url = safeURL(doc.url);
    let bytes: Buffer | undefined;
    for (let i = 0; i < 5; i++) {
      const r = await this.request(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
      });
      if (r.status >= 300 && r.status < 400) {
        const location = r.headers.get("location");
        if (!location) throw new Error("Document redirect без URL.");
        url = safeURL(new URL(location, url).toString());
        continue;
      }
      if (!r.ok) throw new Error(`Document HTTP ${r.status}`);
      if (Number(r.headers.get("content-length")) > MAX_BYTES)
        throw new Error("Документ більший за 20 MB.");
      if (!r.body) throw new Error("Порожній document response.");
      const chunks: Uint8Array[] = [];
      let length = 0;
      for await (const chunk of r.body as any) {
        length += chunk.length;
        if (length > MAX_BYTES) {
          await r.body.cancel().catch(() => {});
          throw new Error("Документ більший за 20 MB.");
        }
        chunks.push(chunk);
      }
      bytes = Buffer.concat(chunks);
      break;
    }
    if (!bytes) throw new Error("Забагато document redirects.");
    await mkdir(this.directory, { recursive: true });
    await writeFile(path, bytes, { mode: 0o600 });
    doc.downloadStatus = "downloaded";
    doc.sizeBytes = bytes.length;
    doc.contentHash = createHash("sha256").update(bytes).digest("hex");
    return bytes;
  }
  async extractText(
    bytes: Buffer,
    name: string,
    mime: string | null,
    depth = 0,
  ): Promise<string> {
    const ext = name.split(".").at(-1)?.toLowerCase();
    if (bytes.subarray(0, 4).toString() === "%PDF" || ext === "pdf") {
      // Explicit import keeps the Node text worker in the Nitro bundle; a relative
      // pdf.worker.mjs lookup would point at a missing file after bundling.
      (globalThis as any).pdfjsWorker ??=
        await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const task = getDocument({
        data: new Uint8Array(bytes),
        useSystemFonts: true,
      });
      const pdf = await task.promise;
      try {
        const pages: string[] = [];
        for (let n = 1; n <= Math.min(pdf.numPages, 500); n++) {
          const p = await pdf.getPage(n);
          const content = await p.getTextContent();
          pages.push(content.items.map((i: any) => i.str ?? "").join(" "));
        }
        return pages.join("\n");
      } finally {
        await task.destroy();
      }
    }
    if (ext === "docx" || mime?.includes("wordprocessingml")) {
      await checkZipSize(bytes);
      const mod = await import("mammoth");
      return (await (mod.default ?? mod).extractRawText({ buffer: bytes }))
        .value;
    }
    if (ext === "doc" || mime === "application/msword") {
      const mod = await import("word-extractor");
      const Word = mod.default;
      const document = await new Word().extract(bytes);
      return [
        document.getBody(),
        document.getHeaders(),
        document.getFootnotes(),
        document.getEndnotes(),
      ].join("\n");
    }
    if (
      ext === "xlsx" ||
      ext === "xls" ||
      mime?.includes("spreadsheet") ||
      mime === "application/vnd.ms-excel"
    ) {
      if (ext !== "xls") await checkZipSize(bytes);
      const mod = await import("xlsx");
      const XLSX = mod.default ?? mod;
      const book = XLSX.read(bytes, { type: "buffer", cellDates: true });
      return book.SheetNames.map(
        (name) => `${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name]!)}`,
      ).join("\n");
    }
    if (ext === "txt" || mime?.startsWith("text/")) {
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return new TextDecoder("windows-1251").decode(bytes);
      }
    }
    if (ext === "zip" || mime === "application/zip") {
      if (depth >= 2) throw new Error("Надто вкладений ZIP.");
      const zip = await checkZipSize(bytes);
      const parts: string[] = [];
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        try {
          const text = await this.extractText(
            Buffer.from(await entry.async("uint8array")),
            entry.name,
            null,
            depth + 1,
          );
          if (text.trim()) parts.push(`Файл: ${entry.name}\n${text}`);
        } catch {
          /* Unsupported ZIP entries do not discard readable source documents. */
        }
      }
      return parts.join("\n");
    }
    throw new Error("Формат документа не підтримується для витягу тексту.");
  }
  async process(doc: SourceDocument) {
    try {
      const bytes = await this.downloadDocument(doc);
      const text = await this.extractText(bytes, doc.name, doc.mimeType);
      if (!text.trim())
        throw new Error(
          "Текст відсутній (скан/порожній файл/непідтримуваний вміст).",
        );
      doc.textTruncated = text.length > MAX_TEXT;
      doc.text = text.slice(0, MAX_TEXT);
      doc.parseStatus = "parsed";
    } catch (e) {
      if (doc.downloadStatus !== "downloaded") doc.downloadStatus = "failed";
      doc.parseStatus = "failed";
      doc.error = e instanceof Error ? e.message : "Document parse failed.";
    }
    return doc;
  }
  async processAll(docs: SourceDocument[]) {
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (cursor < docs.length) {
          const doc = docs[cursor++];
          if (doc) await this.process(doc);
        }
      }),
    );
    return docs;
  }
}
export async function checkZipSize(bytes: Buffer) {
  const mod = await import("jszip");
  const zip = await (mod.default ?? mod).loadAsync(bytes);
  let size = 0,
    count = 0;
  for (const entry of Object.values(zip.files)) {
    size += (entry as any)._data?.uncompressedSize ?? 0;
    count++;
  }
  if (size > 50 * 1024 * 1024 || count > 2000)
    throw new Error("Архів перевищує безпечний ліміт витягу.");
  return zip;
}
