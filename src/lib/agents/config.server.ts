import type {
  AgentConfig,
  AgentConfigRepository,
  AgentId,
  AgentLog,
} from "./contracts.ts";
const descriptions: Record<AgentId, [string, string, string]> = {
  collector: [
    "Збір",
    "Знайти і занести базові поля та посилання джерела",
    "Збирай ID, назву, замовника, CPV, суму, дати і документи. Не аналізуй та не вигадуй відсутніх полів.",
  ],
  filter: [
    "Первинний фільтр",
    "Релевантність, категорія, практичний предмет закупівлі",
    "Використовуй назву, опис та документи. Відсій нерелевантне профілю техніки, запчастин, обладнання. Категорії: Техніка, Запчастини, Обладнання, Матеріали, Паливо, Послуги, Інше. Витягни лише відомі характеристики.",
  ],
  detail: [
    "Детальний розбір",
    "Структурувати прийняті тендери",
    "Заповни Tender лише за наданими джерелами. Невідоме — null. Не дублюй technical, qualification, special requirements. Не змінюй commentText або commentColor.",
  ],
  status: [
    "Статуси",
    "Автоматичний життєвий цикл та історія",
    "Врахуй стан джерела, подання, рішення, дати і коментар. Поверни recommendedStatus, reason, confidence, eventType. Не вигадуй перемогу. Не змінюй commentColor.",
  ],
};
const configs = new Map<AgentId, AgentConfig>(
  (Object.keys(descriptions) as AgentId[]).map((id) => {
    const [name, description, systemPrompt] = descriptions[id];
    return [
      id,
      {
        id,
        name,
        description,
        enabled: true,
        model: "deterministic-mock",
        systemPrompt,
        version: 1,
        promptVersion: "v1",
        limits: { maxTokens: 2000, timeout: 30, retries: 0, batchSize: 100 },
      },
    ];
  }),
);
export const agentRepository: AgentConfigRepository = {
  list: () => structuredClone([...configs.values()]),
  save(input) {
    const old = configs.get(input.id);
    if (
      !old ||
      typeof input.systemPrompt !== "string" ||
      input.systemPrompt.length > 20000 ||
      typeof input.enabled !== "boolean" ||
      typeof input.model !== "string" ||
      input.model.length > 100
    )
      throw new Error("Некоректна конфігурація");
    const limits = input.limits;
    if (
      !limits ||
      !Number.isInteger(limits.maxTokens) ||
      limits.maxTokens < 1 ||
      limits.maxTokens > 100000 ||
      !Number.isInteger(limits.timeout) ||
      limits.timeout < 1 ||
      limits.timeout > 300 ||
      !Number.isInteger(limits.retries) ||
      limits.retries < 0 ||
      limits.retries > 5 ||
      !Number.isInteger(limits.batchSize) ||
      limits.batchSize < 1 ||
      limits.batchSize > 1000
    )
      throw new Error("Некоректні ліміти");
    const changed = old.systemPrompt !== input.systemPrompt;
    const next = {
      ...old,
      enabled: input.enabled,
      model: input.model,
      systemPrompt: input.systemPrompt,
      limits: { ...limits },
      version: old.version + 1,
      promptVersion: changed
        ? `v${Number(old.promptVersion.slice(1)) + 1}`
        : old.promptVersion,
    };
    configs.set(input.id, next);
    return structuredClone(next);
  },
};
export const agentLogs: AgentLog[] = [];
export function appendLog(log: AgentLog) {
  agentLogs.unshift(log);
  agentLogs.splice(200);
}
