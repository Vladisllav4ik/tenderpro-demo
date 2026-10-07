import {
  CollectorAgentService,
  FilterAgentService,
  DetailAgentService,
  StatusAgentService,
} from "./mock-services.ts";
import type {
  AgentConfig,
  AgentId,
  AgentLog,
  ProcessingResult,
} from "./contracts.ts";
import type { Tender } from "../demo-data.ts";
export async function executePipeline(
  records: Tender[],
  configs: AgentConfig[],
  accountId: string,
  appendLog: (log: AgentLog) => void = () => {},
): Promise<ProcessingResult> {
  if (
    !Array.isArray(records) ||
    records.length > 1000 ||
    records.some(
      (t) =>
        !t ||
        typeof t.id !== "string" ||
        typeof t.title !== "string" ||
        typeof t.customer !== "string" ||
        !Number.isFinite(t.budget),
    )
  )
    throw new Error("Некоректні тендери");
  const enabled = (id: AgentId) => configs.find((c) => c.id === id)!.enabled;
  const batchLimit = Math.min(
    ...configs.filter((c) => c.enabled).map((c) => c.limits.batchSize),
    1000,
  );
  if (records.length > batchLimit)
    throw new Error(`Ліміт одного запуску: ${batchLimit} тендерів`);
  const counts = { collector: 0, filter: 0, detail: 0, status: 0 };
  const errors = { collector: 0, filter: 0, detail: 0, status: 0 };
  let active: AgentId = "collector";
  let accepted = 0,
    rejected = 0;
  try {
    let source = records;
    if (enabled("collector")) {
      source = await new CollectorAgentService(undefined, batchLimit).execute(
        records,
      );
      counts.collector = source.length;
    }
    const tenders: Tender[] = [];
    for (const original of source) {
      let tender = original,
        relevant = original.relevance !== "rejected";
      if (enabled("filter")) {
        active = "filter";
        const result = await new FilterAgentService().execute(tender);
        tender = result.tender;
        relevant = result.accepted;
        counts.filter++;
      }
      if (
        relevant &&
        (enabled("filter") || original.relevance === "accepted")
      ) {
        accepted++;
        if (enabled("detail")) {
          active = "detail";
          tender = await new DetailAgentService().execute(tender);
          counts.detail++;
        }
      } else if (!relevant) {
        rejected++;
        tender = {
          ...tender,
          aiSummary:
            "Не відповідає профілю компанії (mock). Детальний розбір пропущено.",
        };
      }
      if (enabled("status")) {
        active = "status";
        tender = (await new StatusAgentService().execute(tender)).tender;
        counts.status++;
      }
      tenders.push({
        ...tender,
        commentText: original.commentText ?? original.comment ?? "",
        commentColor: original.commentColor ?? "none",
      });
    }
    return { tenders, accepted, rejected, mock: true };
  } catch (error) {
    errors[active]++;
    throw error;
  } finally {
    for (const config of configs.filter((c) => c.enabled))
      appendLog({
        agentId: config.id,
        at: new Date().toISOString(),
        processed: counts[config.id],
        errors: errors[config.id],
        estimatedUsage: 0,
        message: "Детермінований mock; API і токени не використовуються",
        accountId,
        mock: true,
      });
  }
}
