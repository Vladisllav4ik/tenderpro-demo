# TenderPro: технічна інфраструктура чотирьох агентів

## Pipeline та режими

Backend `TenderOrchestrator` керує переходами. Агенти повертають результати та не викликають один одного.

```text
RAW → Collector → COLLECTED → CLASSIFICATION_PENDING → Classifier
  ├ confidence < autoAcceptThreshold → NEEDS_REVIEW
  │   confidence < reviewThreshold позначається окремою причиною
  ├ relevant=false, достатній confidence → REJECTED
  └ relevant=true, достатній confidence → CLASSIFIED
      → ANALYSIS_PENDING → Analyzer → ANALYZED → READY
      → Lifecycle evaluation → MONITORING

Помилка етапу → ERROR; наступні залежні етапи skipped із причиною.
Lifecycle окремо: context event → pending recheck → Lifecycle preview.
```

`success` описує технічне виконання: валідна рекомендація Lifecycle `NEEDS_REVIEW` не є транспортною помилкою і видима у результаті етапу.

| Агент        | Режими                           | Поточна реалізація                                                                                                                                                           |
| ------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Collector  | mock, data-source                | Окремий service, bounded timeout/retries, injectable `CollectorConnector`. Mock працює; data-source без connector повертає контрольовану помилку. Prozorro ще не підключено. |
| 2 Classifier | mock, OpenAI                     | Збережено перевірений Agent 2, існуючий test endpoint, результат та prompt v2. HTTP-транспорт виділено у спільний Responses adapter.                                         |
| 3 Analyzer   | mock, OpenAI                     | Реальний серверний Responses adapter, strict JSON output + Zod validation, staging. Окремий тест має prerequisite Classifier та thresholds.                                  |
| 4 Lifecycle  | rule-based, mock, OpenAI, hybrid | Явні факти обробляються rules без tokens у всіх режимах. OpenAI/hybrid обробляють неоднозначність через Responses adapter. Rule-only/mock повертають review без AI.          |

Наявні табличні статуси не мігрують автоматично в новий enum. Нові результати не перезаписують Tender, коментар або колір.

## Schemas

`system-contracts.ts` містить Collector output, `TenderDocumentInput`, Analyzer input/output, Lifecycle input/output, технічні statuses, pipeline states та configurable thresholds. Strict schemas відхиляють зайві поля; числа finite/nonnegative; confidence 0–1; невідомі скалярні факти nullable, невідомі списки порожні.

`TenderDocumentInput`: documentId, name, mimeType, sourceUrl, extractedText, metadata. Наявні demo documents містять текстові витяги; MIME та source URL залишаються null, якщо не відомі. Metadata має обмежену форму flat JSON scalars. PDF/DOCX/XLSX ingestion не реалізовано. Парсер у майбутньому передає DTO без зміни Analyzer.

Analyzer отримує базові дані, результат Classifier, відомі вимоги/unitPrice, документний текст і metadata Collector. Mock не вигадує валюту, ціну, ризики, required documents: наявність файлу не означає вимогу подати його. OpenAI відповіді перевіряються сервером; перевірка фактичної достовірності висновків є наступним content/evaluation етапом.

Lifecycle enum: NEW, WAITING, IN_PROGRESS, NOT_PARTICIPATING, NOT_SUBMITTED, SUBMITTED, DISQUALIFIED, WON, LOST, CANCELLED, COMPLETED, NEEDS_REVIEW. Розширення централізоване у `lifecycleStatuses`; правило WON потребує підтвердженого результату та awarded/closed source. Невідома участь не означає not-submitted. Дата без часу зберігає весь календарний день у Europe/Kyiv.

## Як тестувати в UI

1. `npm run dev`, demo ADMIN, `/agents`.
2. Збережіть змінені конфігурації. Перед тестом backend звіряє versions; account execution lock спільний для Classifier, orchestrator і worker.
3. Agent 1: виберіть mock, існуючий тендер → **Test Collector**.
4. Agent 2: mock або OpenAI, існуючий тендер → **AI тест**. Існуючий preview з п'ятьма полями збережено. Standalone Agent 2 має `pipelineId=null` у journal; у повному pipeline — конкретний pipelineId.
5. Agent 3: mock або OpenAI → **Analyzer Test**. Спочатку Classifier: його provider також може витрачати tokens. Rejected/low-confidence результат зупиняє Analyzer з видимою причиною.
6. Agent 4: виберіть mode → **Status Test**. Source facts пріоритетні; preview показує decisionSource, confidence, reason, eventType, evaluatedAt.
7. Повний тест: налаштуйте й збережіть thresholds, виберіть один тендер → **TEST PIPELINE ON 1 TENDER**. Default draft thresholds: autoAccept=0.5, review=0.3, щоб наявний mock confidence 0.5 проходив усі етапи. Це не фінальна оцінка якості.
8. Результати/пропуски кожного етапу, provider, transitions, token totals, audit/snapshots показуються у preview. **Pipeline history** містить технічну історію всіх акаунтів під ADMIN доступом.

UI називає mock, OpenAI та rule-based явно. Кнопки попереджають про можливий OpenAI, включно з Analyzer prerequisite і Lifecycle fallback. Великий старий mock-test у `/agents` замінено однотендерним контролом. Compatibility processing таблиці залишається deterministic mock і не запускає платний API.

## Recheck

Зміна коментаря або `syncLifecycle` ставить backend job з `statusRecheckAt = serverNow + delaySeconds`, default180, діапазон180–300. Один jobKey на account+tender; повторний контекст замінює job і збільшує revision. Старіший contextUpdatedAt не замінює новіший.

Черга зберігається на диск. Claim має lease1год для відновлення після падіння worker. Finish/release перевіряє revision; результат in-flight старого контексту позначається застарілим і не прибирає новий pending job. Помилка залишає job для повторного явного запуску.

У demo немає фонового оплачуваного scheduler: `/agents` → **Pending lifecycle rechecks** → **Обробити 1 дозрілий recheck**. ADMIN driver виконує один job, включно з контекстом директора/USER, і зберігає owner accountId; staging only. Production timer/queue worker потрібно підключити до цього механізму пізніше. Існуючий локальний табличний status recalculation збережено окремо, щоб не змінювати робочий flow.

## Storage / audit / security

- `.tenderpro-local/agent-usage.jsonl`: append-only usage/audit attempts; UI читає останні200.
- `.tenderpro-local/agent-staging.json`: останні200 pipeline records, pending rechecks, persisted configurations і thresholds. Atomic replace для одного server process.
- Репозиторії: `PipelineRepository`, `RecheckRepository`, `UsageJournal`, конфігураційний cache/repository; agent services не залежать від filesystem. Вони отримують connector, transport та audit sink.
- Кожен новий agent run: runId, pipelineId/null, agentId/name, tenderId, accountId, provider/model/promptVersion, startedAt/finishedAt/duration, tokens, status/error, requestId/responseId/null, sanitized input/output snapshots. Всі retry attempts враховуються у pipeline totals; невідоме usage позначається, а не видається за0.
- Pipeline зберігає thresholds, переходи, stages, runs, aggregate input/output/total tokens. Foundation собівартості: `cost.amount=null`, USD, pricingVersion=null до підключення тарифного каталогу. Ціни не вигадуються.
- `sanitizeSnapshot` видаляє secret/password/key/token fields, credential patterns та значення secret environment variables. Додаткове redaction на repository/journal boundaries; raw provider errors/headers/stacks не повертаються.
- `OPENAI_API_KEY` тільки server process.env. Локальна Node22 dotenv загрузка лише для dev. `.env`, `.tenderpro-local`, build output і тестові артефакти ignored; Vite не віддає приватний journal.
- Демо-вхід дозволяє вибрати ADMIN; усі billable test handlers блокують production до справжньої закритої авторизації. За замовчуванням Collector/Classifier/Analyzer mock, Lifecycle rule-based. Public Vercel function filesystem не є durable storage: перед production агентами потрібен DB adapter/worker і production auth.

## Файли

Нові: `agent-services.server.ts`, `responses.server.ts`, `system-contracts.ts`, `orchestrator.server.ts`, `system-execution.server.ts`, `local-repositories.server.ts`, `snapshots.server.ts`, `configuration-storage.server.ts`, `execution-lock.server.ts`, `src/components/tenderpro/agent-system-tests.tsx`, `tests/agent-system.test.mjs`.

Оновлені: `contracts.ts`, `config.server.ts`, `filter-test.server.ts`, `execution.server.ts`, `client.ts`, `usage-journal.server.ts`, `demo-store.tsx`, `routes/agents.tsx`, README.

## Що далі

Content/business: фінальні prompts, категорії, status rules/enum semantics, thresholds, extraction quality/factual evaluation, policy прийняття staging-результатів. Analyzer і Lifecycle prompts v1 редагуються у `/agents`; Classifier перевірений v2 збережено.

Integration work: Prozorro connector, документні парсери, production DB adapters/transactions, production auth, scheduler/queue driver. Інтерфейси готові, реальні connectors/deployment не створено. Масові платні запити та автоматичний overwrite не виконуються.

## Перевірки

Typecheck без помилок, 80 regression/unit/integration tests, production build успішний. Залишилися попередні нефатальні попередження: великий ExcelJS chunk та рекомендація Vite замінити vite-tsconfig-paths. Fake HTTP перевіряє Responses protocol, configured prompt/model, strict schemas, usage, invalid output, retries і hybrid fallback без звернення до OpenAI. Browser QA: всі окремі тести, повний mock pipeline, comment coalescing та explicit due-job processing.

Нових реальних OpenAI requests на цьому етапі: **0**, новий платний usage: **0 tokens**. Раніше виконаний Agent 2 request1413tokens залишається історичним записом. Vercel deployment не створюється.
