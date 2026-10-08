import { createServerFn } from "@tanstack/react-start";
import type { Tender } from "../demo-data";
import type { AgentConfig } from "./contracts";
import type { FilterTestRequest } from "./filter-test-contract";
export const getImportedCrash = createServerFn({ method: "GET" }).handler(
  async () => (await import("./crash-execution.server")).importedState(),
);
export const importCrashTenders = createServerFn({ method: "POST" })
  .validator((data: { tenders: Tender[] }) => data)
  .handler(async ({ data }) =>
    (await import("./crash-execution.server")).importAndRunCrash(data),
  );
export const rerunCrashTenders = createServerFn({ method: "POST" }).handler(
  async () => (await import("./crash-execution.server")).rerunImportedCrash(),
);
export const rerunPreparedTender = createServerFn({ method: "POST" })
  .validator((data: { recordId: string }) => data)
  .handler(async ({ data }) =>
    (await import("./crash-execution.server")).rerunOnePrepared(data),
  );
export const clearCrashTenders = createServerFn({ method: "POST" }).handler(
  async () => (await import("./crash-execution.server")).clearImportedCrash(),
);
export const saveCrashComment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      comment?: string;
      color?: NonNullable<Tender["commentColor"]>;
    }) => data,
  )
  .handler(async ({ data }) =>
    (await import("./crash-execution.server")).updateImportedComment(data),
  );
import type {
  AgentTestRequest,
  LifecycleInput,
  PipelineSettings,
} from "./system-contracts";
export const checkTenderChanges = createServerFn({ method: "POST" })
  .validator((input: { recordId?: string }) => input)
  .handler(async ({ data }) =>
    (await import("./crash-execution.server")).checkChangesNow(data),
  );
export const testAgentSystem = createServerFn({ method: "POST" })
  .validator((input: AgentTestRequest) => input)
  .handler(async ({ data }) =>
    (await import("./system-execution.server")).runSystemTest(data),
  );
export const updatePipelineSettings = createServerFn({ method: "POST" })
  .validator((input: PipelineSettings) => input)
  .handler(async ({ data }) =>
    (await import("./system-execution.server")).savePipelineSettings(data),
  );
export const queueStatusRecheck = createServerFn({ method: "POST" })
  .validator((input: LifecycleInput) => input)
  .handler(async ({ data }) =>
    (await import("./system-execution.server")).scheduleStatusRecheck(data),
  );
export const runDueStatusRecheck = createServerFn({ method: "POST" }).handler(
  async () =>
    (await import("./system-execution.server")).processOneDueRecheck(),
);
export const testFilterTender = createServerFn({ method: "POST" })
  .validator((input: FilterTestRequest) => input)
  .handler(async ({ data }) =>
    (await import("./execution.server")).runSingleFilterTest(data),
  );
export const getAgentAdmin = createServerFn({ method: "GET" }).handler(
  async () => (await import("./execution.server")).adminState(),
);
export const updateAgentConfig = createServerFn({ method: "POST" })
  .validator((config: AgentConfig) => config)
  .handler(async ({ data }) =>
    (await import("./execution.server")).saveConfig(data),
  );
export const processTenders = createServerFn({ method: "POST" })
  .validator((records: Tender[]) => records)
  .handler(async ({ data }) =>
    (await import("./execution.server")).runPipeline(data),
  );
