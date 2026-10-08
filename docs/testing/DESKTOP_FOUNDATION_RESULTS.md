# Desktop Foundation — результати етапу №2

## Desktop

- Статична SPA з наявними таблицею, картками, hotbar, Settings, ADMIN, CSS і фільтрами; server-module guard у desktop bundler.
- SQLite через вузькі Rust-команди, application data directory, міграція №1, WAL/FK, integrity check, параметризовані запити, транзакції.
- Окремий профіль Desktop POC та демонстраційний тендер. `.tenderpro-local` не використовується.
- Коментар, колір, історія, перший перегляд і UI preferences збережено в SQLite. Архітектурні таблиці AI/jobs/documents/sync ще не виконують майбутні функції.
- Windows EXE перевірено через реальний WebView2/CDP, не browser mock. Відкрито таблицю й картку; коментар редагувався в обох місцях.
- Повне закриття native процесу та запуск нового процесу відновили коментар, жовтий колір, історію й масштаб 125%. В release UI перевірено також фактичний background color.
- Release EXE та NSIS installer успішно зібрано. Installer не встановлювався; запуск перевірено безпосередньо з release EXE. Перевірка виконана на цьому Windows-комп’ютері; окремий Windows 10/11 compatibility matrix не виконувався.
- Native UI працював із bundled assets; dev server 1420 не запускався. Наявний web dev server не зупинявся й не використовувався desktop-програмою.

## Перевірки

| Перевірка | Результат |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | 129/129 PASS |
| `npm run build` | PASS — існуюча web-збірка |
| `npm run desktop:frontend:build` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 3/3 native SQLite PASS |
| `npm run desktop:build -- --debug --no-bundle` | PASS |
| `npm run desktop:build` | PASS — release EXE та x64 NSIS |
| Native table/card/comment/color/preferences/restart | PASS |
| Markdown links після перенесення | PASS — missing links 0 |
| Main/production/shared UI source | Без змін |
| Protected `.tenderpro-local` | 88 файлів: контрольні хеші збігаються |

Неблокуючі warnings: JS chunks понад 500 kB, зокрема ExcelJS; web wrapper повідомляє про `vite-tsconfig-paths`. Це не build errors.

## Очищення

Перевірено 45 файлів у корені. 10 документів перенесено у `docs`. 27 кореневих файлів перенесено в `_temp`; також архівовано `.test-output` з 96 файлами в `_temp/other/legacy-test-output`. Остаточно видалених матеріалів — 0. Старий tracked `SOURCE_MANIFEST.txt` тепер є тимчасовим архівним матеріалом; його копія локальна/ignored, оригінал зберігається у Git history.

Створено `docs/architecture`, `docs/agents`, `docs/development`, `docs/testing`, `_temp/screenshots`, `_temp/logs`, `_temp/reports`, `_temp/other`. README, конфігурації, package manifests та `.env` залишено у корені; постійні fixtures залишено на місці. Старі screenshots/logs у корені прибрано. Link у `MVP_ARCHITECTURE.md` виправлено після перенесення; новий README містить актуальний каталог документації. Тест Excel більше не створює `.test-output`.

## Межі

Реальних AI-запитів, ADM API, sidecar чи production deployment не створено. Desktop callbacks для недоступних функцій явно повідомляють про обмеження. Нормальне закриття flush-ить pending writes; примусове завершення процесу до відправлення debounce може втратити останні не збережені символи.

Native/UI QA screenshots, logs, process metadata, cleanup inventory та hash checks — у `_temp`; програма від них не залежить. До етапу №3 не переходити без погодження.
