import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import {
  defaultPipelineSettings,
  pipelineSettingsSchema,
  type PipelineSettings,
  type PipelineRecord,
  type LifecycleInput,
} from "./system-contracts.ts";
import { sanitizeSnapshot } from "./snapshots.server.ts";
import type { AgentConfig } from "./contracts.ts";
export type RecheckJob = {
  jobKey: string;
  accountId: string;
  tenderId: string;
  revision: number;
  statusRecheckAt: string;
  input: LifecycleInput;
  claimedAt: string | null;
};
export interface PipelineRepository {
  save(record: PipelineRecord): Promise<void>;
  list(accountId?: string): Promise<PipelineRecord[]>;
}
export interface RecheckRepository {
  schedule(
    accountId: string,
    input: LifecycleInput,
    delaySeconds: number,
    now?: Date,
  ): Promise<RecheckJob>;
  list(accountId?: string): Promise<RecheckJob[]>;
  claimDue(accountId?: string, now?: Date): Promise<RecheckJob | null>;
  finish(job: RecheckJob): Promise<boolean>;
  release(job: RecheckJob): Promise<void>;
}
type LocalState = {
  pipelines: PipelineRecord[];
  jobs: RecheckJob[];
  revision: number;
  settings?: PipelineSettings;
  configs?: AgentConfig[];
};
// One-process demo adapter. Replace with DB transactions/unique constraints for multiple workers.
export class LocalAgentRepositories implements PipelineRepository {
  private path: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(directory = join(process.cwd(), ".tenderpro-local")) {
    this.path = join(directory, "agent-staging.json");
  }
  private async read(): Promise<LocalState> {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return { pipelines: [], jobs: [], revision: 0 };
      throw e;
    }
  }
  private transaction<T>(operation: (state: LocalState) => T): Promise<T> {
    const result = this.queue.then(async () => {
      const state = await this.read();
      const value = operation(state);
      await mkdir(join(this.path, ".."), { recursive: true });
      await writeFile(
        this.path + ".tmp",
        JSON.stringify(sanitizeSnapshot(state)),
        { encoding: "utf8", mode: 0o600 },
      );
      await rename(this.path + ".tmp", this.path);
      return sanitizeSnapshot(value);
    });
    this.queue = result.catch(() => {});
    return result;
  }
  save(record: PipelineRecord) {
    return this.transaction((s) => {
      s.pipelines = [
        sanitizeSnapshot(record),
        ...s.pipelines.filter((p) => p.pipelineId !== record.pipelineId),
      ].slice(0, 200);
    });
  }
  async list(accountId?: string): Promise<PipelineRecord[]> {
    await this.queue;
    const s = await this.read();
    // Separate named views below avoid ambiguous repository list semantics.
    return s.pipelines.filter((p) => !accountId || p.accountId === accountId);
  }
  async pending(accountId?: string): Promise<RecheckJob[]> {
    await this.queue;
    return (await this.read()).jobs.filter(
      (j) => !accountId || j.accountId === accountId,
    );
  }
  async settings(): Promise<PipelineSettings> {
    await this.queue;
    return (await this.read()).settings ?? defaultPipelineSettings;
  }
  async configurations(): Promise<AgentConfig[]> {
    await this.queue;
    return (await this.read()).configs ?? [];
  }
  saveConfigurations(configs: AgentConfig[]) {
    return this.transaction((s) => {
      s.configs = sanitizeSnapshot(configs);
    });
  }
  saveSettings(input: PipelineSettings) {
    const valid = pipelineSettingsSchema.parse(input);
    return this.transaction((s) => {
      s.settings = valid;
      return valid;
    });
  }
  schedule(
    accountId: string,
    input: LifecycleInput,
    delaySeconds: number,
    now = new Date(),
  ) {
    if (
      !Number.isInteger(delaySeconds) ||
      delaySeconds < 180 ||
      delaySeconds > 300
    )
      throw new Error("Затримка має бути 180–300 секунд.");
    return this.transaction((s) => {
      const jobKey = `${accountId}:${input.id}`;
      const previous = s.jobs.find((j) => j.jobKey === jobKey);
      if (
        previous?.input.contextUpdatedAt &&
        input.contextUpdatedAt &&
        Date.parse(previous.input.contextUpdatedAt) >
          Date.parse(input.contextUpdatedAt)
      )
        return previous;
      const job: RecheckJob = {
        jobKey,
        accountId,
        tenderId: input.id,
        revision: ++s.revision,
        statusRecheckAt: new Date(
          now.getTime() + delaySeconds * 1000,
        ).toISOString(),
        input: sanitizeSnapshot(input),
        claimedAt: null,
      };
      s.jobs = [job, ...s.jobs.filter((j) => j.jobKey !== jobKey)];
      return job;
    });
  }
  claimDue(accountId?: string, now = new Date()) {
    return this.transaction((s) => {
      const job = s.jobs
        .filter(
          (j) =>
            (!accountId || j.accountId === accountId) &&
            Date.parse(j.statusRecheckAt) <= now.getTime() &&
            (!j.claimedAt || now.getTime() - Date.parse(j.claimedAt) > 3600000),
        )
        .sort((a, b) => a.statusRecheckAt.localeCompare(b.statusRecheckAt))[0];
      if (!job) return null;
      job.claimedAt = now.toISOString();
      return structuredClone(job);
    });
  }
  finish(job: RecheckJob) {
    return this.transaction((s) => {
      const current = s.jobs.find((j) => j.jobKey === job.jobKey);
      if (!current || current.revision !== job.revision) return false;
      s.jobs = s.jobs.filter((j) => j.jobKey !== job.jobKey);
      return true;
    });
  }
  release(job: RecheckJob) {
    return this.transaction((s) => {
      const current = s.jobs.find(
        (j) => j.jobKey === job.jobKey && j.revision === job.revision,
      );
      if (current) current.claimedAt = null;
    });
  }
}
export const localAgentRepositories = new LocalAgentRepositories();
export const recheckRepository: RecheckRepository = {
  schedule: (...args) => localAgentRepositories.schedule(...args),
  list: (id) => localAgentRepositories.pending(id),
  claimDue: (...args) => localAgentRepositories.claimDue(...args),
  finish: (job) => localAgentRepositories.finish(job),
  release: (job) => localAgentRepositories.release(job),
};
