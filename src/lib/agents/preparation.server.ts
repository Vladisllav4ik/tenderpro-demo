import type { Tender } from "../demo-data.ts";
import type { JsonValue } from "./contracts.ts";
import type {
  Agent2Preparation,
  SourcePreparationService,
} from "./source-contracts.ts";
import { ProzorroSource, normalizeProzorro } from "./prozorro.server.ts";
import { TenderDocumentService } from "./document-service.server.ts";
import {
  parseTenderHierarchy,
  verifyQuestionChanges,
} from "../tender-hierarchy.ts";
import { mergeDocumentVersions } from "./watcher-model.server.ts";
export class Agent2PreparationService implements SourcePreparationService {
  private source: ProzorroSource;
  private documents: TenderDocumentService;
  constructor(
    source = new ProzorroSource(),
    documents = new TenderDocumentService(),
  ) {
    this.source = source;
    this.documents = documents;
  }
  async prepare(
    raw: Tender,
    previous?: Agent2Preparation,
  ): Promise<Agent2Preparation> {
    const result: Agent2Preparation = {
      tender: structuredClone(raw),
      rawProzorroData: null,
      documents: [],
      flags: {
        baseDataReady: false,
        documentsFetched: false,
        documentsParsed: false,
        documentsAvailable: null,
        agent2Completed: false,
      },
      prozorroFetched: false,
      baseFieldsCount: 0,
      errors: [],
      fetchedAt: null,
    };
    try {
      const data = await this.source.fetchTender(raw.id);
      if (!Array.isArray(data["questions"]))
        data["questions"] = await this.source.fetchTenderQuestions(data["id"]);
      result.rawProzorroData = data as JsonValue;
      result.prozorroFetched = true;
      result.fetchedAt = new Date().toISOString();
      result.tender = normalizeProzorro(raw, data);
      result.flags.baseDataReady = true;
      try {
        const documents = await this.documents.fetchTenderDocuments(data["id"]);
        result.documents = this.documents.register(documents);
        result.flags.documentsFetched = true;
        result.flags.documentsAvailable = documents.length > 0;
        for (const d of result.documents) {
          const old = previous?.documents.find(
            (p) =>
              p.documentId === d.documentId &&
              p.url === d.url &&
              p.dateModified === d.dateModified &&
              (!p.sourceHash || p.sourceHash === d.sourceHash),
          );
          if (old?.downloadStatus === "downloaded")
            Object.assign(d, old, {
              versionId: d.versionId,
              lotId: d.lotId,
              revision: d.revision,
            });
          if (d.downloadStatus === "downloaded" && !d.contentHash)
            await this.documents.downloadDocument(d);
        }
        await this.documents.processAll(
          result.documents.filter((d) => d.downloadStatus !== "downloaded"),
        );
        result.tender.hierarchy = verifyQuestionChanges(
          parseTenderHierarchy(
            data,
            mergeDocumentVersions(
              previous?.tender.hierarchy?.documentVersions ?? [],
              result.documents,
            ),
          ),
        );
        result.flags.documentsParsed = result.documents.some(
          (d) => d.parseStatus === "parsed",
        );
        result.tender.documents = result.documents.map((d) => ({
          documentId: d.documentId,
          ...(d.sizeBytes !== undefined ? { sizeBytes: d.sizeBytes } : {}),
          name: d.name,
          url: d.url,
          mimeType: d.mimeType,
          datePublished: d.datePublished,
          dateModified: d.dateModified,
          downloadStatus: d.downloadStatus,
          parseStatus: d.parseStatus,
          error: d.error,
          kind: "source",
          facts: [],
          sources: [d.url],
          text: d.text,
        }));
        if (result.documents.some((d) => d.parseStatus === "failed"))
          result.errors.push(
            `${result.documents.filter((d) => d.parseStatus === "failed").length} документів не розпізнано; див. parseStatus/error.`,
          );
      } catch {
        result.errors.push("Не вдалося отримати список документів Prozorro.");
      }
      result.baseFieldsCount = [
        "title",
        "officialTitle",
        "customer",
        "cpv",
        "budget",
        "currency",
        "quantity",
        "unit",
        "unitPrice",
        "publishedAt",
        "submissionPeriod",
        "auctionPeriod",
        "deliveryPeriod",
        "address",
        "sourceUrl",
        "prozorroStatus",
        "sourceItems",
        "sourceLots",
      ].filter(
        (k) =>
          (result.tender as any)[k] != null &&
          (result.tender as any)[k] !== "-",
      ).length;
      result.flags.agent2Completed =
        result.flags.baseDataReady && result.flags.documentsFetched;
    } catch {
      result.errors.push(
        "Не вдалося підтвердити/отримати structured tender data Prozorro.",
      );
    }
    return result;
  }
}
