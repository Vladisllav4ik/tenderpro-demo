# Agent 2: один тендер через OpenAI

TanStack Start server function → ADMIN guard → перевірка одного input і збереженої конфігурації → mock або Responses API → server-side Zod validation → preview. Tender, коментар, колір, статус і таблиця не змінюються.

## Локальний запуск

```sh
npm ci
npm run dev
```

У корені `.env` має містити серверну змінну `OPENAI_API_KEY`. Значення не копіювати в `VITE_*`, source, prompts або model. Node 22 завантажує локальний `.env` лише на dev-сервері за потреби; ключ читається виключно з `process.env.OPENAI_API_KEY`. `.env` і локальний журнал ігноруються Git.

1. Відкрити `/login`, обрати «Адміністратор · ADMIN».
2. Перейти `/agents` → «Первинний фільтр».
3. Model за замовчуванням: `gpt-5.4-mini`; режим за замовчуванням: **mock**. Prompt: **v2**.
4. Для реального тесту вибрати **OpenAI**, перевірити system prompt/maxTokens/timeout/retries і натиснути **«Зберегти Первинний фільтр»**. Для першої перевірки залишити `retries = 0`.
5. Вибрати один існуючий тендер у «Тест Agent 2 · один тендер».
6. Натиснути **«AI тест · OpenAI (1 тендер)»**.

Якщо є незбережені зміни — тест недоступний. Застаріла вкладка з іншими provider/version відхиляється сервером до платного запиту. Одночасний повторний тест того самого акаунта також відхиляється.

Відповідь має рівно `relevant`, `confidence` (0–1), `category`, `object`, `reason`. Невірні типи, зайві/відсутні поля, порожні рядки та confidence поза межами — error. Результат не записується у Tender. Prompt v2 просить включати у `object` відомі ключові характеристики та кількість/одиницю.

## Як відрізнити реальний запит

У preview показані `provider = openai`, збережені model/promptVersion, duration, input/output/total tokens та Request/Response IDs, якщо їх повернув OpenAI. У журналі запис має `mock = false`, `status`, tenderId/model/час/usage. `requestMade = true` означає спробу HTTP-запиту; саме success із provider IDs і usage підтверджує відповідь API. Network error не є успішною генерацією.

Mock показує `provider = mock`, `model = deterministic-mock`, нульові tokens та «OpenAI request не відправлявся». Поле model може зберігати реальну модель для майбутнього перемикання, але mock її не викликає.

## Сервер і журнал

- `POST https://api.openai.com/v1/responses` через Node native fetch, без додаткового SDK чи його автоматичних retries.
- `model` і `instructions` беруться із збереженого agent config; `maxTokens` → `max_output_tokens`, `timeout` → AbortController; retries — лише transient network/timeout/rate-limit/5xx. Квота, ключ, модель, refusal, incomplete і invalid output не повторюються автоматично.
- Structured Outputs: `text.format.type = json_schema`, `strict = true`, усі п’ять полів required, `additionalProperties = false`; відповідь додатково перевіряється Zod на сервері.
- Input — allowlist базових даних, позицій і доступних текстів документів; comments, colors, попередній AI score/summary, account state не надсилаються. Завеликий input відхиляється, не обрізається мовчки.
- API key лише в Authorization header серверного запиту до фіксованого HTTPS endpoint; redirects заборонені. Raw provider errors, headers, request/response body і stack traces не потрапляють у публічний response або logs. Повідомлення помилок — фіксовані короткі фрази.
- Кожна фактична HTTP-спроба має окремий технічний запис; retries об’єднані runId. Usage на помилках, якщо невідомий, — null, не вигаданий 0.
- `.tenderpro-local/agent-usage.jsonl`: локальний append-only журнал, переживає перезапуск; UI показує останні 200 записів. Для cached input/reasoning tokens також є поля. Доступ до файлу через Vite HTTP заборонений. `UsageJournal` interface дозволяє замінити локальний adapter на database.
- `/agents` лишається центром конфігурації. Config repository поки в пам’яті сервера; model/prompt/limits треба зберігати знову після перезапуску, якщо вони відрізняються від defaults.

Теперішній демо-вхід дозволяє відвідувачу обрати ADMIN. Тому платний endpoint виконується тільки при серверному `NODE_ENV=development`. Production/preview не виконує реальних OpenAI запитів, навіть якщо там заданий API key. Це обмеження потрібно замінити справжньою закритою авторизацією перед публічним використанням API. У цьому етапі production auth не реалізовується.

Агенти 1/3/4 і масовий pipeline збережені як mock. Налаштування OpenAI у Agent 2 не перетворює кнопки mock-pipeline або таблиці на платну масову обробку.

## Перевірено

- TypeScript, **58 tests**, production build — успішно. Залишилися попередні неблокуючі warnings: ExcelJS chunk >500 kB та bundled vite-tsconfig-paths.
- Browser: mock preview, readonly Tender, server refusal для USER, HTTP 403 для приватного journal file, config save і режим/версія.
- **Один** реальний тест XCMG на `gpt-5.4-mini` із prompt v1, retries 0: success, relevant true, confidence 0.99; **1295 input + 118 output = 1413 tokens**, ~2943 ms; Request/Response IDs отримано, Tender не змінився.
- Після цього початковий prompt уточнено до **v2**, щоб кількість та відомі характеристики потрапляли саме в object. Новий prompt не перевірявся другим платним запитом, відповідно до обмеження користувача. Наступні запуски — вручну з UI.
- Перевірка не знайшла значення API key у source/tests, client/server build, journal або Git history. `.env` не tracked. Transport code не потрапив у client bundle.

## Змінені файли

| Файл | Зміна |
|---|---|
| `src/routes/agents.tsx` | Provider switch, один tender, preview, реальні usage/logs |
| `src/lib/agents/config.server.ts` | Model/provider defaults, prompt v2, безпечна валідація конфігурації |
| `src/lib/agents/contracts.ts` | Технічні поля журналу та provider |
| `src/lib/agents/client.ts` | Test server function |
| `src/lib/agents/execution.server.ts` | ADMIN/версія/режим/concurrency/local-only guards |
| `src/lib/agents/filter-test-contract.ts` | Input/output/request schemas та базова проєкція Tender |
| `src/lib/agents/filter-test.server.ts` | Responses adapter, mock, retries/timeout, validation/error mapping |
| `src/lib/agents/openai-env.server.ts` | Серверний env loader |
| `src/lib/agents/usage-journal.server.ts` | Durable local usage repository |
| `tests/openai-filter.test.mjs` | Детерміновані HTTP/validation/security/logging тести без API витрат |
| `vite.config.ts` | HTTP deny для приватного журналу, збережені dotenv/cert/Git deny rules |
| `.gitignore` | Private journal directory |
| `README.md`, `MVP_ARCHITECTURE.md`, `AGENT2_OPENAI.md` | Актуальні інструкції та межі інтеграції |

## До автоматичного Agent 1 → 2 → 3

Потрібні перевірка якості категоризації/object на різних тендерах, production auth із закритим ADMIN, backend repositories для configs/tenders/logs і дозволами власника, реальний Prozorro collector, справжній detail/documents Agent 3, окремо погоджений запис результатів та керована черга з бюджетом і idempotency. Цього етапу вони не входять. Deploy не виконувався.

Офіційні джерела: [Structured Outputs у Responses API](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [gpt-5.4-mini — Responses і Structured Outputs](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
