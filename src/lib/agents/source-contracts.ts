import type { Tender } from "../demo-data.ts";
import type { JsonValue } from "./contracts.ts";
export type SourceDocument = {
  lotId?: string | null;
  versionId?: string;
  revision?: string | null;
  contentHash?: string;
  sourceHash?: string | null;
  sizeBytes?: number;
  documentId: string;
  name: string;
  url: string;
  mimeType: string | null;
  datePublished: string | null;
  dateModified: string | null;
  source: "prozorro";
  downloadStatus: "pending" | "downloaded" | "failed";
  parseStatus: "pending" | "parsed" | "failed";
  text: string;
  error: string | null;
  cacheKey?: string;
  textTruncated?: boolean;
};
export type PreparationFlags = {
  baseDataReady: boolean;
  documentsFetched: boolean;
  documentsParsed: boolean;
  documentsAvailable: boolean | null;
  agent2Completed: boolean;
};
export type Agent2Preparation = {
  tender: Tender;
  rawProzorroData: JsonValue | null;
  documents: SourceDocument[];
  flags: PreparationFlags;
  prozorroFetched: boolean;
  baseFieldsCount: number;
  errors: string[];
  fetchedAt: string | null;
};
export interface SourcePreparationService {
  prepare(
    tender: Tender,
    previous?: Agent2Preparation,
  ): Promise<Agent2Preparation>;
}
