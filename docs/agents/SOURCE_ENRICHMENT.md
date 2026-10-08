# Excel → Prozorro → документи → Agent 3

Після підтвердженого Excel import сервер автоматично готує Agent 2: знаходить internal ID Prozorro за TenderID, отримує повний tender JSON і список документів. Точні заповнені поля Excel мають пріоритет. Structured source додає відсутні базові поля; ціна за одиницю не обчислюється діленням бюджету.

`TenderDocumentService` зберігає metadata і завантажує оригінали до приватного `.tenderpro-local/documents`. Кеш залежить від documentId, URL та dateModified. Читання підтримує PDF з текстовим шаром, DOC, DOCX, XLS, XLSX, TXT та ZIP. Підписи P7S і скани без тексту отримують parseStatus=failed; інші документи продовжують оброблятися. Є обмеження розміру файлів/архівів і тексту; OCR не виконується.

Agent 3 заблокований до завершення source preparation. Стан «список документів отримано, документів немає» відрізняється від помилки отримання. Якщо документи є, потрібен хоча б один успішний витяг тексту. Agent 3 отримує структуровані дані, metadata всіх документів і текстові витяги прочитаних документів із справжніми documentId. Довгі витяги обмежено, excerptTruncated відображає скорочення. Повний витяг зберігається окремо.

Об’єднання перевіряє текстові значення за джерелами; непідтверджені значення не застосовуються. Evidence містить field/value/sourceType/sourceId/quote/confidence. Таблиця і картка використовують finalMergedTender, а не raw AI output.

ADMIN → AI Агенти → Crash test / Pipeline: source flags, кількість документів, помилки, Agent 3 input/output, Agent 4 status/reason, raw imported data, raw Prozorro data, document registry, final merged object і provenance. «Повторити Agent 2 → Agent 3» повторює підготовку одного тендера без нового Agent 4; загальна кнопка повторює всі стадії. Старі AI outputs не використовуються як source truth.

Дані crash-test і кеш локальні, виключені з Git. Для production із кількома інстансами потрібне постійне спільне сховище; цей етап не змінює модель зберігання і не виконує deployment.

## Перевірено на 10 реальних тендерах

Дата перевірки: 07.10.2026. Префікс усіх ID: `UA-2026-10-05-`.

| ID suffix | Знайдено / завантажено | Прочитано / передано Agent 3 |
| --- | ---: | ---: |
| 010567-a | 6 | 5 |
| 006217-a | 7 | 6 |
| 009068-a | 5 | 4 |
| 010001-a | 5 | 4 |
| 013751-a | 8 | 7 |
| 001222-a | 5 | 4 |
| 010700-a | 8 | 7 |
| 009339-a | 6 | 5 |
| 014289-a | 3 | 2 |
| 002649-a | 11 | 10 |
| **Разом** | **64** | **54** |

10 інших файлів — `sign.p7s`. Усі 10 завершили Agent 2/3/4. Два початкові Agent 3 outputs перевищили ліміт 8000 tokens; повторено тільки їхній аналіз із готовим Agent 2, коротшими цитатами та більшим лімітом. Фінальний стан 10/10 success. Жодних demo records не додано.

Для `014289-a` технічні й кваліфікаційні вимоги не підтверджено: вони залишилися порожніми (`-` у картці). Для `010001-a` немає підтверджених ризиків. Невідомі спеціалізовані вимоги залишаються порожніми в Agent 3 result. Agent 4 повернув NEEDS_REVIEW для всіх 10: стан активної процедури не підтверджує нашу участь чи результат.

Перевірки: `npm test` 95/95, `npm run typecheck`, `npm run build`, production PDF worker smoke test, browser ADMIN counters/card documents/requirements. Build має попередження про великий client chunk ExcelJS; помилок збірки немає. `npm audit --omit=dev` — 0 vulnerabilities. Ключ OpenAI не потрапив у source, artifacts, Git history або client transport.
