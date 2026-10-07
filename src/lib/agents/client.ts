import { createServerFn } from "@tanstack/react-start";
import type { Tender } from "../demo-data";
import type { AgentConfig } from "./contracts";
import type { FilterTestRequest } from "./filter-test-contract";
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
