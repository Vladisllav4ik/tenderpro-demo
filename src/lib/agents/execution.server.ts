import { requireAccount } from "../session.server";
import { agentRepository, agentLogs, appendLog } from "./config.server";
import { executePipeline } from "./pipeline";
import type { AgentConfig } from "./contracts";
import type { Tender } from "../demo-data";
export function adminState() {
  requireAccount(true);
  return { configs: agentRepository.list(), logs: agentLogs };
}
export function saveConfig(config: AgentConfig) {
  requireAccount(true);
  return agentRepository.save(config);
}
export function runPipeline(records: Tender[]) {
  const account = requireAccount();
  return executePipeline(
    records,
    agentRepository.list(),
    account.id,
    appendLog,
  );
}
