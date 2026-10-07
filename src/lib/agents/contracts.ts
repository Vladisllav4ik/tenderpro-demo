import type { Tender } from "../demo-data.ts";
export type AgentId = "collector" | "filter" | "detail" | "status";
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type AgentConfig = {
  id: AgentId;
  name: string;
  description: string;
  enabled: boolean;
  model: string;
  provider?: "mock" | "openai";
  source?: "mock" | "data-source";
  mode?: "rule-based" | "mock" | "openai" | "hybrid";
  recheckDelaySeconds?: number;
  systemPrompt: string;
  version: number;
  promptVersion: string;
  limits: {
    maxTokens: number;
    timeout: number;
    retries: number;
    batchSize: number;
  };
};
export type AgentLog = {
  id?: string;
  runId?: string;
  agentId: AgentId;
  at: string;
  processed: number;
  errors: number;
  estimatedUsage: number;
  message: string;
  accountId: string;
  mock: boolean;
  provider?: "mock" | "openai" | "rule-based" | "data-source";
  pipelineId?: string | null;
  agentName?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string | null;
  inputSnapshot?: JsonValue;
  outputSnapshot?: JsonValue;
  tenderId?: string;
  model?: string;
  timestamp?: string;
  durationMs?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
  status?: "success" | "error";
  errorMessage?: string;
  requestId?: string | null;
  responseId?: string | null;
  attempt?: number;
  promptVersion?: string;
};
export interface AgentConfigRepository {
  list(): AgentConfig[];
  save(config: AgentConfig): AgentConfig;
}
export interface AgentService<I, O> {
  execute(input: I): Promise<O>;
}
export interface TenderSourceConnector {
  collect(input: { records: Tender[]; limit: number }): Promise<Tender[]>;
}
export type FilterResult = {
  accepted: boolean;
  reason: string;
  tender: Tender;
};
export type StatusResult = {
  recommendedStatus: string;
  reason: string;
  confidence: number;
  eventType: string;
  tender: Tender;
};
export type ProcessingResult = {
  tenders: Tender[];
  accepted: number;
  rejected: number;
  mock: true;
};
