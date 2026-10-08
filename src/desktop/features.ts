import type * as Web from "../lib/agents/client";
import { agentModules } from "../lib/agent-presentation";
import type { AgentConfig } from "../lib/agents/contracts";
const unavailable =
  <T extends (...args: any[]) => any>(name: string) =>
  (..._args: Parameters<T>): ReturnType<T> =>
    Promise.reject(
      new Error(
        `${name}: не підключено на етапі Desktop Foundation. AI-запити не виконуються.`,
      ),
    ) as ReturnType<T>;
export const getImportedCrash = async (): Promise<
  Awaited<ReturnType<typeof Web.getImportedCrash>>
> => [];
export const getAgentAdmin = async (): Promise<
  Awaited<ReturnType<typeof Web.getAgentAdmin>>
> =>
  (() => ({
    configs: agentModules.map(
      (a) =>
        ({
          id: a.id,
          name: a.title,
          description: "Desktop Foundation: агент не підключено",
          enabled: false,
          model: "not-connected",
          provider: "mock",
          systemPrompt: "",
          version: 1,
          promptVersion: "not-connected",
          limits: { maxTokens: 0, timeout: 30, retries: 0, batchSize: 1 },
        }) satisfies AgentConfig,
    ),
    logs: [],
    journalAvailable: false,
    histories: [],
    pendingRechecks: [],
    pipelineSettings: { autoAcceptThreshold: 0.5, reviewThreshold: 0.3 },
  }))();
export const importCrashTenders = unavailable<typeof Web.importCrashTenders>(
  "Excel → AI pipeline",
);
export const rerunCrashTenders =
  unavailable<typeof Web.rerunCrashTenders>("Pipeline");
export const rerunPreparedTender =
  unavailable<typeof Web.rerunPreparedTender>("Agent 2/3");
export const clearCrashTenders =
  unavailable<typeof Web.clearCrashTenders>("Crash-test storage");
export const saveCrashComment =
  unavailable<typeof Web.saveCrashComment>("Web storage");
export const checkTenderChanges =
  unavailable<typeof Web.checkTenderChanges>("Prozorro watcher");
export const testAgentSystem =
  unavailable<typeof Web.testAgentSystem>("AI test");
export const updatePipelineSettings =
  unavailable<typeof Web.updatePipelineSettings>("AI thresholds");
export const queueStatusRecheck =
  unavailable<typeof Web.queueStatusRecheck>("Agent 4 queue");
export const runDueStatusRecheck =
  unavailable<typeof Web.runDueStatusRecheck>("Agent 4 worker");
export const testFilterTender =
  unavailable<typeof Web.testFilterTender>("Agent 2");
export const updateAgentConfig =
  unavailable<typeof Web.updateAgentConfig>("AI configuration");
export const processTenders =
  unavailable<typeof Web.processTenders>("AI pipeline");
