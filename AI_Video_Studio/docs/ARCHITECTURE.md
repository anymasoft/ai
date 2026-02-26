# Архитектура Beem — AI Video Studio

## Обзор

Beem состоит из двух независимых сервисов с общим AI-ядром:

```
┌─────────────────────────────────────────────────────────┐
│                     Beem Platform                        │
│                                                         │
│  ┌──────────────────┐      ┌───────────────────────┐   │
│  │   Telegram Bot   │      │     Web App (Astro)   │   │
│  │   (bot/)         │      │     (web/)            │   │
│  │                  │      │                       │   │
│  │  Python/aiogram  │      │  TypeScript/Astro SSR │   │
│  │  SQLite (bot.db) │      │  SQLite (web.db)      │   │
│  │  YooKassa poll   │      │  YooKassa webhook     │   │
│  └────────┬─────────┘      └──────────┬────────────┘   │
│           │                           │                  │
│           └──────────┬────────────────┘                 │
│                      │                                   │
│              ┌───────▼────────┐                         │
│              │   AI Pipeline  │                         │
│              │                │                         │
│              │ GPT-4o-mini    │  Фаза 1: Smart Enhancer │
│              │ GPT-4o-mini    │  Фаза 2: Camera Director│
│              │ MiniMax Hailuo │  Генерация видео        │
│              └────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

## AI Pipeline — 2-фазный Prompt Engine

### Фаза 1: Smart Prompt Enhancer

**Файлы:** `bot/prompts.py`, `web/src/lib/promptEnhancer.ts`

Два режима:

**Template mode** (только в веб):
- Переводит описание на английский
- Добавляет коммерческий стиль сцены
- Не описывает движения камеры (шаблон управляет ими сам)

**Prompt mode** (бот + веб):
- Переводит на английский
- Максимизирует кинематографические детали
- Обнаруживает ключевые слова сохранения: «текст не менять», «баннер сохранить», «цена остаётся»
- Если найдено → добавляет:
  ```
  PRESERVE: all text elements unchanged, background stable
  NO_GENERATION:
  - no new text
  - no new labels
  - no new graphics
  - no new overlays
  - no new symbols
  - no new UI elements
  ```

### Фаза 2: Camera Director Compiler

**Файлы:** `bot/director.py`, `web/src/lib/cameraPromptCompiler.ts`

- Берёт результат Фазы 1
- Добавляет только 15 валидных MiniMax camera commands:
  `[Truck left/right]`, `[Pan left/right]`, `[Push in/Pull out]`,
  `[Pedestal up/down]`, `[Tilt up/down]`, `[Zoom in/out]`,
  `[Shake]`, `[Tracking shot]`, `[Static shot]`

**Критическое правило PRESERVE:**
Если в промпте есть `PRESERVE:` с ключевыми словами text/background/banner/price →
использовать **только** `[Static shot]`. Любое движение камеры вызывает параллакс,
который разрушает текст и баннеры на видео.

- Постобработка: санитайзер удаляет любые невалидные команды в `[...]`

## Базы данных

### Текущее состояние (раздельные SQLite)

```
bot/beem.db          web/beem.db
users                users
  telegram_id          email (PRIMARY)
  video_balance        generation_balance
  free_remaining       plan
payments             payments
  payment_id (UQ)      externalPaymentId (UQ)
  pack_id              credits
generations          generations
  telegram_id          userId
  status               minimax_job_id
  video_path           video_url
                       prompt_director
queue                sessions
  generation_id        token
```

### Целевое состояние (единый PostgreSQL)

```sql
-- Единая таблица пользователей
users
  id           UUID PRIMARY KEY
  email        TEXT UNIQUE          -- веб-авторизация
  telegram_id  BIGINT UNIQUE NULL   -- привязка Telegram
  balance      INTEGER DEFAULT 0   -- единый баланс кредитов
  plan         TEXT DEFAULT 'free'

-- Единая история генераций
generations
  id            UUID PRIMARY KEY
  user_id       UUID REFERENCES users
  channel       TEXT              -- 'telegram' | 'web'
  status        TEXT
  minimax_job_id TEXT
  video_url     TEXT
  prompt_final  TEXT
  credits_used  INTEGER
  created_at    TIMESTAMPTZ

-- Единая история платежей
payments
  id                UUID PRIMARY KEY
  user_id           UUID REFERENCES users
  external_id       TEXT UNIQUE      -- YooKassa payment_id
  channel           TEXT             -- 'telegram' | 'web'
  amount            NUMERIC
  credits           INTEGER
  status            TEXT
  created_at        TIMESTAMPTZ
```

## Платёжная система

### Telegram-бот (текущая схема — polling)
```
Пользователь выбирает пакет
  → YooKassa создаёт платёж
  → бот опрашивает статус каждые 10 сек (poll_attempts)
  → при status=succeeded → начисляет видео на баланс
```

### Веб-приложение (webhook)
```
Пользователь выбирает кредиты
  → YooKassa создаёт платёж
  → YooKassa отправляет webhook на /api/payments/yookassa/check
  → при status=succeeded → начисляет кредиты на баланс
```

### Целевая схема (единый webhook для обоих каналов)
```
POST /payments/webhook
  → определяем канал по metadata.channel
  → обновляем единый баланс пользователя
  → уведомляем через нужный канал (Telegram или веб)
```

## Тарифы и стоимость

### Telegram-бот
| Pack ID | Видео | Цена | ₽/видео |
|---------|-------|------|---------|
| trial | 3 | 0 ₽ | — |
| starter | 5 | 490 ₽ | 98 ₽ |
| seller | 20 | 1 490 ₽ | 75 ₽ |
| pro | 50 | 2 990 ₽ | 60 ₽ |

### Веб-приложение (кредиты)
| Plan | Кредиты | Цена | ₽/кредит |
|------|---------|------|---------|
| free | 3 | 0 ₽ | — |
| basic | 50 | 3 950 ₽ | 79 ₽ |
| professional | 200 | 13 800 ₽ | 69 ₽ |
| custom | 1+ | 89 ₽ | 89 ₽ |

> Стоимость MiniMax Hailuo-02: ~$0.07 за 6 сек, ~$0.14 за 10 сек.
> При курсе 90₽/$ и цене 69₽/кредит — маржа ~40%.

## Очередь генерации

### Telegram-бот (текущая)
- `generation_queue.py` — SQLite-based queue
- Concurrency = 1 (последовательная обработка)
- MiniMax callback через вебхук → обновляет статус
- При ошибке: max 20 попыток polling → `failed`

### Веб-приложение (текущая)
- `web/src/lib/minimax/queue.ts` — in-memory queue
- `web/src/lib/minimax/processor.ts` — обработчик
- MiniMax callback: `POST /minimax_callback`

### Целевая схема
- Единый воркер на PostgreSQL job queue (pg-boss или аналог)
- Concurrency > 1 для параллельных генераций
- Retry с exponential backoff
- Dead letter queue для failed jobs

## Развёртывание

### Бот
- VPS (любой Linux): `python main.py`
- Nginx reverse proxy для webhook endpoint
- Systemd или supervisor для автозапуска

### Веб-приложение
- Railway / Fly.io (Node.js SSR)
- Или VPS + Nginx
- HTTPS обязателен (YooKassa требует HTTPS для webhook)

## Технический долг

| Приоритет | Задача | Сложность |
|-----------|--------|-----------|
| P0 | YooKassa: polling → webhook в боте | Низкая |
| P0 | Retry при ошибке MiniMax + возврат баланса | Низкая |
| P1 | Объединить SQLite → PostgreSQL | Средняя |
| P1 | Единый аккаунт (telegram_id + email) | Средняя |
| P1 | Queue concurrency > 1 | Средняя |
| P2 | Интеграция WB/Ozon API | Высокая |
| P2 | B2B тарифная сетка для агентств | Средняя |
