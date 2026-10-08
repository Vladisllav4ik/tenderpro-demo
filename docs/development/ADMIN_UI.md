# ADMIN UI

Спільний GlobalHotbar використовує існуючі стилі worksheet toolbar, іконки й палітру. Sidebar і дубльований navigation прибрано. Тендери залишаються full-width; локальні table controls, import/export, sorting та дані не змінено. Settings/Agents мають centered content до 1340 px.

`/agents` — 4 graphite-картки (2×2 desktop, 1 колонка narrow). Operational metrics читаються з існуючих logs. Prompt та limits не показуються на картках. Crash test / Pipeline і повний pipeline test/thresholds/history/rechecks доступні в окремих секціях; їхній код виконання збережено.

Нові сторінки: `/agents/agent-1`, `/agents/agent-2`, `/agents/agent-3`, `/agents/agent-4`. Tabs: Огляд, Prompt, Ліміти, Тест, Logs. Огляд — summary; модель/режим і execution limits — у Лімітах; system prompt — у Prompt. Header switch використовує існуючий updateAgentConfig. Logs — таблиця з keyboard/click details modal та обмеженим response preview.

Settings: Профіль, Таблиця, Інтерфейс. Збережено попередні account/workspace preferences й autosave. Global account menu містить profile/settings/logout. AI Agents navigation доступний лише ADMIN, на дочірніх routes збережено той самий ADMIN guard.

Backend agent logic, prompts, pipeline, OpenAI transport, data contracts, storage та import/export не змінено.

Перевірено: ADMIN/USER navigation та redirect, усі 4 agent routes, 5 tabs, Logs modal, save через enable/disable (повернуто початковий active state), існуючий Collector mock test (0 OpenAI requests), Settings tabs, desktop/narrow layout, відсутність sidebar і full-width table. TypeScript/build успішні; 105/105 tests. Залишилося попередження про великий client chunk ExcelJS. Deployment не виконувався.
