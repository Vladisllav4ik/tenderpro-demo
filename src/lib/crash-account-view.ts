import type { CrashRecord } from "./agents/crash-contracts.ts";
import type { Account } from "./account-model.ts";
export function crashAccountView(
  record: CrashRecord,
  role: Account["role"],
): CrashRecord {
  if (role === "ADMIN") return record;
  const { preparation, agent3Debug, watcher, deltaResults, sourceSnapshots, ...visible } = record;
  return {
    ...visible,
    agent2Result: null,
    agent3Result: null,
    agent4Result: null,
    pipeline: null,
    mergeWarnings: [],
  };
}
