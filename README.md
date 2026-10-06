# TenderPro demo

Alpha CRM та демонстраційна AI-аналітика тендерів. React 19, TanStack Start, Vite 8 та Nitro.

## Локальний запуск

Потрібен Node.js 22 (22.23+ для регресійних тестів).

```bash
npm ci
npm run dev
```

## Перевірка production build

```bash
npm run build
npm run typecheck
npm test
npm run preview -- --host 127.0.0.1 --port 3002
```

`build` генерує Vercel Build Output у `.vercel/output`. `preview` використовує Nitro для запуску production-артефакту локально. `src/routeTree.gen.ts` генерується TanStack Router під час збірки.

## GitHub → Vercel

1. Імпортувати `Vladisllav4ik/tenderpro-demo` у Vercel.
2. Production branch: `main`; Root Directory: корінь репозиторію.
3. Framework: автоматичне визначення TanStack Start. Build Command: `npm run build`; Install Command: `npm ci`; Node.js: `22.x`.
4. Залишити Output Directory без ручного override: Nitro генерує повний Vercel Build Output, включно з SSR Function і маршрутизацією.

Для демо не потрібні ключі AI, бази даних або інші environment variables. Конфігурація закріплює Nitro preset `vercel` та Node.js 22.

Офіційна документація: [TanStack Start / Lovable на Vercel](https://vercel.com/docs/frameworks/full-stack/tanstack-start).

## Перевірені сценарії

- `/dashboard`, `/tenders`, вкладка «В роботі», `/settings`, `/profile`.
- XCMG: `/tenders/UA-2026-09-29-003902-a`.
- DONGFENG: `/tenders/UA-2026-10-02-004811-a`.
- Фільтри: `/tenders/UA-2026-08-25-006722-a`.
- Excel demo import → AI-скринінг → картка → «В роботу» → менеджер / етап.

AI, документи та імпорт використовують демо-дані. Імпорт додає 3 показові рядки; повторний запуск пропускає дублікати. Стан демо зберігається у localStorage браузера. Перевірки складу, 1С та постачальників у alpha немає.

Невідомі технічні параметри позначені для уточнення. Збірка має неблокуючі попередження про великий JS chunk і `vite-tsconfig-paths` у конфігурації Lovable.
