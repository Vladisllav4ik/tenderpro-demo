import type { Tender } from "../demo-data.ts";
import type { FilterTestResult } from "./filter-test-contract.ts";
import type {
  AnalyzerResult,
  LifecycleResult,
  PipelineRecord,
} from "./system-contracts.ts";
export type CrashRecord = {
  recordId: string;
  batchId: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  rawImportedData: Tender;
  agent2Result: FilterTestResult | null;
  agent3Result: AnalyzerResult | null;
  agent4Result: LifecycleResult | null;
  finalMergedTender: Tender;
  pipeline: PipelineRecord | null;
  mergeWarnings: string[];
  processing: boolean;
  revision: number;
};
export type CrashState = {
  schemaVersion: 1;
  records: CrashRecord[];
  clearedAt: string | null;
};
export interface CrashRepository {
  list(accountId?: string): Promise<CrashRecord[]>;
  insert(records: CrashRecord[]): Promise<CrashRecord[]>;
  claim(recordId: string, rerun: boolean): Promise<CrashRecord | null>;
  save(record: CrashRecord, revision: number): Promise<boolean>;
  clear(): Promise<number>;
}
