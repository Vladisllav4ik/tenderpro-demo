import { createServerFn } from "@tanstack/react-start";
import type { Tender } from "../demo-data";
import type { AgentConfig } from "./contracts";
import type { FilterTestRequest } from "./filter-test-contract";
import type {
  AgentTestRequest,
  LifecycleInput,
  PipelineSettings,
} from "./system-contracts";
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
