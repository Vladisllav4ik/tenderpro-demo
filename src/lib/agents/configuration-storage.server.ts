import { agentRepository, restoreConfiguration } from "./config.server.ts";
import { localAgentRepositories } from "./local-repositories.server.ts";
import type { AgentConfig } from "./contracts.ts";
let loading: Promise<void> | undefined;
let writes: Promise<unknown> = Promise.resolve();
export function loadConfigurations() {
  if (!loading) {
    loading = localAgentRepositories
      .configurations()
      .then((configs) => {
        for (const config of configs) restoreConfiguration(config);
      })
      .catch(() => {
        loading = undefined;
        throw new Error("Не вдалося прочитати конфігурації агентів.");
      });
  }
  return loading;
}
export async function persistConfiguration(input: AgentConfig) {
  await loadConfigurations();
  const operation = writes.then(async () => {
    const previous = agentRepository.list();
    if (previous.find((c) => c.id === input.id)?.version !== input.version)
      throw new Error("Конфігурація змінилася. Оновіть сторінку.");
    const saved = agentRepository.save(input);
    try {
      await localAgentRepositories.saveConfigurations(agentRepository.list());
      return saved;
    } catch {
      for (const config of previous) restoreConfiguration(config);
      throw new Error("Не вдалося зберегти конфігурацію агентів.");
    }
  });
  writes = operation.catch(() => {});
  return operation;
}
