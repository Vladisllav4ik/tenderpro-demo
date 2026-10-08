# TenderPro — Excel crash-test

Робоча таблиця стартує порожньою. Runtime fixtures та генерацію demo-специфікацій/документів прибрано; історичні приклади залишені лише у tests/fixtures як ізольовані тестові дані. Старі локальні списки очищаються під час завантаження. Перший запуск нового storage очищає старі agent previews/history, зберігаючи конфігурації та thresholds.

## Запуск

1. Локально npm run dev, увійти USER або ADMIN.
2. Agent 2 та Agent 3: OpenAI для реального прогона; mock для перевірки інфраструктури. Agent 4 — rule-based або hybrid за конфігурацією. Платні production виклики залишаються закритими до production auth.
3. Таблиця → Імпорт та дії → Імпортувати Excel → вибрати XLSX → Імпортувати 1–10.
4. Автоматично: raw → Agent 2 → Agent 3 → Agent 4 → final merged object. Collector пропускається. Відхилення / low confidence / error зупиняють залежні етапи з видимою причиною.
5. ADMIN → AI Агенти → Crash test / Pipeline: processed/errors кожного агента, state, last run, short log; під кожним ID raw, 2/3/4 results, final, provenance та merge guard.

Серверний .tenderpro-local/imported-crash-test.json зберігає окремі rawImportedData (включно з усіма клітинками, назвою файлу, номером рядка), agent2Result, agent3Result, agent4Result, finalMergedTender і pipeline. Таблиця та картка читають finalMergedTender. Journal та pipeline history залишаються у попередніх server repositories.

## Source-of-truth

Заповнені поля Excel захищені. Дати публікації/початку не виводяться з ID, невідома валюта не підставляється. Відсутні моделі, характеристики, кількість, ціни, адреси, гарантії, delivery, вимоги, документи та висновки залишаються відсутніми / «-».

Нові AI факти застосовуються лише з точним підтвердженням у наданому тексті. Непідтверджені значення зберігаються у результаті агента для діагностики, але не потрапляють у final. Документні назви з AI requiredDocuments не створюють фіктивні файли. Mock summaries не застосовуються. Консервативний guard може відхиляти перефразований коректний висновок — це видно в mergeWarnings.

## Повтор / очищення

Готові результати не запускаються повторно автоматично; successful stages повторної спроби використовують cache. Explicit ADMIN «Запустити pipeline для імпортованих» перераховує усю активну вибірку (до 10) у збережених режимах. Дублікати ID не перезаписують raw.

ADMIN «Очистити тестові тендери» видаляє crash records, пов'язані previews/logs/rechecks та final records, зберігаючи конфігурації агентів і thresholds. Очищення блокується під час pipeline. Запізнілий результат не відновлює видалений record.

## Перевірка

84/84 tests, typecheck, production build успішні. Browser: XLSX 10 рядків, 2/3/4 по 10 processed/0 errors, Collector 0 викликів, таблиця/detailed/card, explicit rerun та очистка. HTTP/OpenAI контракти і захист від вигаданих значень перевірено підміненим транспортом. Нових платних запитів під час QA немає. QA-вибірку очищено; реального XLSX користувача у запиті не було.

Vercel deployment не створюється. Перед production потрібні DB adapters/auth; цей crash-test підготовлений для локального сервера.
