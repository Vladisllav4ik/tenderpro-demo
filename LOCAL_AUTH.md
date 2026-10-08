# Локальні акаунти MVP

Вхід через email/password; немає registration, password reset чи OAuth. Login за account ID і demo account buttons видалені. Невідомий email та неправильний пароль дають однакову помилку «Невірний email або пароль» (401).

Два заздалегідь створені акаунти:

| ID | Ім’я | Email | Role |
| --- | --- | --- | --- |
| user | Ганна Покотилова | pokotilova@euromash.com.ua | USER |
| admin | Влад | admin@tenderpro.local | ADMIN |

Users зберігаються server-side у `.tenderpro-local/auth-users.json`, виключеному з Git і недоступному через Vite. StoredAccount містить passwordHash; safe AccountContext — лише id/name/email/role. Паролі перевіряються server-side bcryptjs, hashes із випадковим salt і cost 12. Plaintext не зберігається у repository. Credentials не потрапляють у logs або HTML/source bundle.

Для першого запуску клону: `npm run auth:seed -- --generate`. Seed не перезаписує існуючих users/hashes. Згенеровані початкові паролі записуються в приватний файл `%USERPROFILE%\.codex\secrets\tenderpro-initial-credentials.txt` поза Git/workspace. У вихідному завданні початкові паролі були відсутні, тому для поточного локального запуску використано generation.

Можна передати initial passwords через server environment `TENDERPRO_USER_INITIAL_PASSWORD` / `TENDERPRO_ADMIN_INITIAL_PASSWORD` й запустити seed без `--generate`. Не додавайте їх до source або `VITE_*`. `TENDERPRO_ADMIN_EMAIL` задає identifier під час першого seed; пізніше можна змінити email ADMIN у приватному auth-users.json, залишивши id=admin і passwordHash. Після зміни identifier увійдіть повторно.

Cookie: `tenderpro_session`, opaque random 256-bit token, httpOnly, sameSite=lax, secure у production, 12 годин. Успішний login обертає попередню сесію, logout видаляє її server-side. Прострочені/неіснуючі cookies не авторизують. SessionRepository — async abstraction; поточний MemorySessionRepository призначений для local development. Для production/Vercel потрібні persistent session/user storage; deployment не виконувався.

ADMIN отримує agents/config/prompts/logs/crash-test tools; USER — лише робочу таблицю і персональні налаштування. ADMIN endpoints перевіряють роль server-side, а USER tender responses не містять technical pipeline logs/results. Account IDs залишені стабільними; zoom, layouts, widths, filters, modes, AI visibility та date range мають окремі `tenderpro.users.<id>.table.*` namespaces. Existing server agent execution logic не змінена; guards лише переведені на await для async session repository.

Перевірено: USER/ADMIN login, wrong email/password, logout із replay старого cookie, expiry/rotation, reload, route/API permissions, settings isolation, initials/email menu, build, TypeScript, 110/110 tests. Passwords не знайдено у source/build/Git history; hashes відсутні у client artifacts; приватні users/credentials URL повертають 403. Початкові credentials і hashes не закомічені.
