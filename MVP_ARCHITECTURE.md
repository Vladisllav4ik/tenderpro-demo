# TenderPro MVP

Вертикаль: демо-вхід → імпорт/наявні тендери → серверна mock-обробка → таблиця → картка → збереження → автоматичні статуси.

## Маршрути та ролі

- `/` і `/dashboard` → `/tenders`; без сесії → `/login`.
- USER: `/tenders`, `/tenders/:id`, `/settings`.
- ADMIN: додатково `/agents`.
- `/profile` → `/settings`.
- `/inbox`, `/pipeline`, `/categories`, `/rules`, `/knowledge`, `/customers`, `/analytics`, `/export` → `/tenders`. Старі компоненти лишилися в коді, меню їх не показує.

На `/login` є три явно позначені демо-акаунти: `user`, `user2`, `admin`. Це симуляція, а не захист реальних даних: кожен відвідувач може обрати ADMIN. Сервер визначає роль зі списку акаунтів; клієнт не передає роль. Оpaque HTTPOnly/SameSite cookie посилається на серверну сесію з терміном 24 години. Сесії в пам’яті; перезапуск, HMR або інша серверна інстанція потребують повторного входу. Відповіді з акаунтом мають `Cache-Control: private, no-store`.

Гарди маршрутів відповідають за навігацію. Окремі серверні перевірки захищають читання prompts/logs та зміну конфігурацій (ADMIN), запуск pipeline (авторизований акаунт). TanStack Start CSRF middleware вже включений у `src/start.ts`.

## Preferences і дані

`UserPreferencesRepository` / `LocalPreferencesRepository` у `src/lib/preferences-repository.ts` — межа для майбутнього backend-адаптера. Ключі `tenderpro.users.<accountId>.table.<setting>` охоплюють compact/detailed layouts, order, widths, visibility, pinned, sort, zoom, filters, AI, dateRange, selectedTenderId, scrollX/Y, detailMode, fullscreenPreferred, profileName та personal. Тендери, коментарі й ручні кольори: `tenderpro.users.<accountId>.tenders`.

Перший `user` одноразово успадковує старі `tenderpro.table.*` і `tenderpro-demo`. Вже наявні персональні значення не перезаписуються; другий USER і ADMIN не успадковують чужі дані. Перемикання акаунтів перезавантажує застосунок і монтує окремий store. Це локальна ізоляція, не безпечне сховище для конфіденційних даних і не синхронізація між пристроями.

`Tender` у `src/lib/demo-data.ts` містить предмет, CPV, суми, кількість/одиницю/ціну, періоди, адресу, три блоки вимог, документи, AI summary/risks/score, статус/історію, commentText/commentColor та timestamps. `CanonicalTender` гарантує матеріалізовані поля спільної моделі. Старі `budget`, `score`, `history` збережені для сумісності; `canonicalTender()` синхронізує `totalAmount`, `aiScore`, `statusHistory`.

Fixtures перенесені з UI у `demo-fixtures.ts`; початкова міграція матеріалізує їх у Tender лише для початкових fixture IDs. Нові записи/Excel не отримують showcase-специфікацій. Таблиця, detailed mode, картка і preview використовують об’єкти з одного `DemoProvider`. `tenderFlow(t)` лише проєктує той самий об’єкт, без вибору окремого dataset за route ID. Невідомі значення показуються як `-`/null; mock не генерує AI score для імпортованого тендера. Предмет і summary стислі; повний масив позицій зберігається.

## Чотири агенти

`src/lib/agents/contracts.ts`: `AgentService<I,O>`, `TenderSourceConnector`, `AgentConfigRepository`, `AgentConfig`, `AgentLog`, результати фільтра/статусу/pipeline.

`mock-services.ts`:

1. `CollectorAgentService` + `MockTenderSourceConnector`: забирає надані записи з лімітом, без мережевого сканування чи AI. Майбутній Prozorro connector реалізує той самий interface.
2. `FilterAgentService`: прості правила за наданою назвою/предметом/описом/текстами документів; відсікає явно непрофільне, визначає одну з фіксованих категорій, уточнює загальну назву за відомим предметом. Це mock, не мовна модель.
3. `DetailAgentService`: тільки для прийнятих, структурує надані поля та вимоги без дублювання, формує позначений mock-висновок. Не читає PDF/XLSX/DOCX і не вигадує відсутні дані.
4. `StatusAgentService`: використовує чинний детермінований workflow; повертає recommendedStatus, reason, confidence, eventType і Tender. Підтверджене джерело, подання/рішення, дати й відкладений коментар зберігають чинні правила. Перемога без підтвердження не створюється.

`pipeline.ts` оркеструє enabled-агентів і ліміт batchSize, пропускає detail для відсіяних записів, записує фактичні processed/error counts. Якщо filter вимкнено, detail виконується тільки для раніше прийнятих записів. `relevance` і `relevanceReason` зберігають результат первинного фільтра в Tender; відсіяні записи за замовчуванням приховані з робочої вибірки, але доступні через фільтр релевантності. Статус закупівлі та ручний колір коментаря від цього не підмінюються. Tokens/usage = 0, оскільки зовнішній AI не викликається. Усі сервіси лишають commentColor незмінним.

`execution.server.ts` перевіряє сесію/роль. `client.ts` містить TanStack server functions `getAgentAdmin`, `updateAgentConfig`, `processTenders`; імпорти реалізацій відбуваються лише всередині серверних handlers. Frontend не викликає OpenAI і не має API keys.

У таблиці меню «Тендери» → «Обробити агентами (mock)» обробляє до 100 записів поточної вибірки; менший server batchSize відхиляє завеликий запуск. `mergeAgentResult()` застосовує результат до актуального store і зберігає коментар, колір, lifecycle, затримку та історію, які могли змінитися під час запиту. Зміни зберігаються автоматично.

У `/agents` ADMIN редагує enabled/model/systemPrompt/limits; promptVersion змінюється лише при зміні prompt, version — при збереженні конфігурації. Окремий тестовий запуск показує журнали, не змінюючи таблицю. Конфігурації й останні 200 журналів зберігаються у mock repository в пам’яті сервера до перезапуску. model/systemPrompt/maxTokens/timeout/retries — конфігурація для майбутнього AI adapter; детермінований mock не інтерпретує prompt і не витрачає tokens.

Автоматична фонова перевірка статусів у відкритому застосунку збережена; реального фонового моніторингу Prozorro поза сесією немає.

## Наступний крок для реального backend

- Замінити демо-вхід production auth із серверними сесіями, закритою видачею ADMIN та відновленням входу між інстанціями.
- Реалізувати backend repositories для user preferences, тендерів, конфігурацій і журналів з перевіркою власника кожного запису.
- Додати серверний OpenAI adapter з API key у server environment, валідацією структурованого output, застосуванням token/timeout/retry limits, реальним usage та помилками. UI та контракти зберігаються.
- Додати Prozorro connector, отримання/витягування документів та фонове виконання status service з idempotent history.

Production OpenAI, production Prozorro, повідомлення, склад, 1С, CRM постачальників і автоматичний deploy не входять у цей етап.

## Перевірки

`npm run typecheck`, `npm test`, `npm run build` — успішно, 49 тестів. Тести охоплюють старий Excel/table/workflow і нову ізоляцію preferences, єдину модель, пропуск detail, невідомі дані, prompt versioning, batch limits та захист ручних змін від пізньої відповіді.

Production preview перевірено у браузері: redirects/login, USER без admin-menu і з відмовою серверного доступу (401 без входу, 403 для USER), ADMIN prompt edit/version/reload і mock logs, персональний zoom 150%/100% у двох USER, картки XCMG/DONGFENG/фільтрів, table/preview/card зі спільним summary, імпорт 35 рядків без помилок і 39 видимих рядків, mock-процесинг, відсів медичного тендера зі збереженням purple commentColor, повернення відсіяного запису через relevance filter. Runtime errors у робочих сценаріях не виявлено. Build має наявні неблокуючі попередження: ExcelJS chunk >500 kB і bundled vite-tsconfig-paths. Deploy не виконувався.

Механізм серверних функцій: [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions). Гард маршруту доповнює серверну перевірку дозволів, а не замінює її.
