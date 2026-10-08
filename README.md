# Tender PRO

Вебверсія: React + TanStack Start + Node/Nitro. Desktop Foundation: Tauri 2 + статична React SPA + SQLite. Обидві збірки використовують спільні компоненти й стилі.

## Вебверсія

```powershell
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

Node.js 22. `.tenderpro-local/` та `.env` приватні; desktop їх не читає і не змінює. `vite.config.ts` і Nitro/Vercel конфігурацію збережено. Production deployment не змінюється.

## Windows Desktop Foundation

```powershell
npm run desktop:dev
npm run desktop:build
npm run desktop:test
```

Потрібні Rust MSVC toolchain, Visual Studio C++ Build Tools/Windows SDK і WebView2. Зібраний EXE містить статичні assets і не потребує Vite, Node web server чи інтернету.

SQLite знаходиться у стандартному application data directory `ua.tenderpro.desktop.foundation/tenderpro.sqlite`. Профіль Desktop POC та тендер DESKTOP-POC-001 — окремі демонстраційні дані. Коментар, колір, історія, перший перегляд і UI preferences записуються транзакційно.

AI, watcher, Excel → AI pipeline, document backend, реальна авторизація та ADM sync ще не перенесені. Desktop adapters повідомляють недоступність; платних запитів не виконують. Excel parser/експорт і спільні екрани збережені; платформні файлові сценарії потребують окремої перевірки.

## Документація

- [Desktop Foundation](docs/development/DESKTOP_FOUNDATION.md)
- [Правила робочого простору](docs/development/WORKSPACE_RULES.md)
- [Архітектура web MVP](docs/architecture/MVP_ARCHITECTURE.md)
- [Watcher і delta analysis](docs/architecture/PIPELINE_CHANGE_MONITORING.md)
- [AI pipeline](docs/agents/AGENT_SYSTEM.md)
- [Agent 2 / OpenAI](docs/agents/AGENT2_OPENAI.md)
- [Prozorro / документи](docs/agents/SOURCE_ENRICHMENT.md)
- [Web auth](docs/development/LOCAL_AUTH.md)
- [ADMIN UI](docs/development/ADMIN_UI.md)
- [Таблиця й картки](docs/development/TABLE_CARD_UPDATES.md)
- [Web crash-test](docs/testing/CRASH_TEST.md)
- [Перевірки Desktop Foundation](docs/testing/DESKTOP_FOUNDATION_RESULTS.md)

Історичні документи можуть описувати попередні етапи; фактична реалізація визначається поточним кодом.

## Тимчасові файли

Етап №3: [ADM backend / Agent 1](server/README.md), [результати перевірок](docs/testing/ADM_AGENT1_RESULTS.md). Backend ізольований від вебверсії. Desktop отримує офіційні дані через native Sync API; агенти 2–4 не підключені.

`_temp/screenshots`, `_temp/logs`, `_temp/reports`, `_temp/other` — видалювані QA-матеріали, ignored Git. Програма й production build від них не залежать. Постійні fixtures залишаються у `tests/fixtures` та `src-tauri/fixtures`.
