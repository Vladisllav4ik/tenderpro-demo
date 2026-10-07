import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentLog } from "./contracts.ts";
import { sanitizeSnapshot } from "./snapshots.server.ts";
export interface UsageJournal {
  append(log: AgentLog): Promise<void>;
  list(): Promise<AgentLog[]>;
}
export class LocalUsageJournal implements UsageJournal {
  private path: string;
  private queue: Promise<void> = Promise.resolve();
  constructor(privateDirectory = join(process.cwd(), ".tenderpro-local")) {
    this.path = join(privateDirectory, "agent-usage.jsonl");
  }
  async prepare() {
    await mkdir(join(this.path, ".."), { recursive: true });
    await appendFile(this.path, "", { encoding: "utf8", mode: 0o600 });
  }
  append(log: AgentLog) {
    const operation = this.queue.then(async () => {
      await this.prepare();
      await appendFile(
        this.path,
        JSON.stringify(sanitizeSnapshot(log)) + "\n",
        {
          encoding: "utf8",
          mode: 0o600,
        },
      );
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async list() {
    await this.queue;
    try {
      const lines = (await readFile(this.path, "utf8")).trim().split("\n");
      return lines
        .slice(-200)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as AgentLog];
          } catch {
            return [];
          }
        })
        .reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  clear() {
    const operation = this.queue.then(async () => {
      await this.prepare();
      await writeFile(this.path, "", { encoding: "utf8", mode: 0o600 });
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  removeTenderIds(ids: ReadonlySet<string>) {
    const operation = this.queue.then(async () => {
      let raw = "";
      try {
        raw = await readFile(this.path, "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      const kept = raw
        .trim()
        .split("\n")
        .filter(Boolean)
        .filter(
          (line) => !ids.has((JSON.parse(line) as AgentLog).tenderId ?? ""),
        );
      await this.prepare();
      await writeFile(this.path, kept.length ? kept.join("\n") + "\n" : "", {
        encoding: "utf8",
        mode: 0o600,
      });
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
export const usageJournal = new LocalUsageJournal();
