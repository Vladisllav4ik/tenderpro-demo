import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type {
  CrashRepository,
  CrashRecord,
  CrashState,
} from "./crash-contracts.ts";
import { sanitizeSnapshot } from "./snapshots.server.ts";
export class LocalCrashRepository implements CrashRepository {
  private path: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(directory = join(process.cwd(), ".tenderpro-local")) {
    this.path = join(directory, "imported-crash-test.json");
  }
  private async read(): Promise<CrashState> {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return { schemaVersion: 1, records: [], clearedAt: null };
      throw e;
    }
  }
  private transaction<T>(work: (state: CrashState) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const state = await this.read();
      const result = work(state);
      await mkdir(join(this.path, ".."), { recursive: true });
      await writeFile(
        this.path + ".tmp",
        JSON.stringify(sanitizeSnapshot(state)),
        { encoding: "utf8", mode: 0o600 },
      );
      await rename(this.path + ".tmp", this.path);
      return sanitizeSnapshot(result);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async exists() {
    try {
      await readFile(this.path, "utf8");
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw e;
    }
  }
  async list(accountId?: string) {
    await this.queue;
    return (await this.read()).records.filter(
      (r) => !accountId || r.accountId === accountId,
    );
  }
  insert(records: CrashRecord[]) {
    return this.transaction((s) => {
      const ids = new Set(s.records.map((r) => r.rawImportedData.id));
      const added = records.filter((r) => {
        if (ids.has(r.rawImportedData.id)) return false;
        ids.add(r.rawImportedData.id);
        return true;
      });
      s.records.push(...added);
      return added;
    });
  }
  claim(recordId: string, rerun: boolean) {
    return this.transaction((s) => {
      const r = s.records.find((r) => r.recordId === recordId);
      if (!r) return null;
      if (r.processing && Date.now() - Date.parse(r.updatedAt) < 3600000)
        return null;
      if (!rerun && r.pipeline && r.pipeline.status !== "error") return null;
      r.processing = true;
      r.revision++;
      r.updatedAt = new Date().toISOString();
      return structuredClone(r);
    });
  }
  save(record: CrashRecord, revision: number) {
    return this.transaction((s) => {
      const i = s.records.findIndex(
        (r) => r.recordId === record.recordId && r.revision === revision,
      );
      if (i < 0) return false;
      s.records[i] = sanitizeSnapshot(record);
      return true;
    });
  }
  clear() {
    return this.transaction((s) => {
      const count = s.records.length;
      s.records = [];
      s.clearedAt = new Date().toISOString();
      return count;
    });
  }
}
export const crashRepository = new LocalCrashRepository();
