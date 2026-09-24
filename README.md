# Rep

React Native / Expo-приложение, которое считает отжимания фронтальной камерой. Обработка позы выполняется локально; видео и координаты тела не сохраняются.

## Режимы

- **30 дней** — 13 тренировок, дни восстановления и адаптация следующей цели по результату.
- **Свободный** — один подход без цели и таймера.
- **PvP** — приватная комната или случайный соперник, синхронный матч на 60 секунд и счёт в реальном времени через Supabase.

История и программа работают offline-first через AsyncStorage. Авторизация для сетевых функций анонимная и привязана к установке приложения.

## Запуск

```sh
npm install
cp .env.example .env
npm start
```

Переменные окружения:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Без них solo-режимы продолжают работать, а PvP открывается с виртуальным соперником.

Для нативного запуска:

```sh
npx expo run:android
npx expo run:ios
```

## Supabase

1. Применить `supabase/migrations/202609240001_rep_program_and_pvp.sql`.
2. Включить Anonymous Sign-Ins в Authentication.
3. Развернуть Edge Function `supabase/functions/pvp/index.ts` под именем `pvp`.

В базе используются RLS-политики для профилей, друзей, тренировок, матчей и приватных Realtime-каналов. В клиент передаются только Project URL и publishable key.

## Проверка

```sh
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo export --platform web
```

Регрессионные ожидаемые результаты предоставленных роликов: `3`, `2`, `2`, `30`, `6` и `9` повторений. Алгоритм требует видимое движение плеч, цикл сгибания/разгибания рук и подтверждённую горизонтальную зону ног; краткое перекрытие ног в нижней точке допускается.
