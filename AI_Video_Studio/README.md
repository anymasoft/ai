# Beem — AI Video Studio

Сервис генерации коротких видео (6-10 сек) для карточек товаров на Wildberries и Ozon.
Продавец загружает фото товара, пишет описание — получает продающее видео за ~1 минуту.

## Структура проекта

```
AI_Video_Studio/
├── bot/          # Telegram-бот (Python + aiogram)
├── web/          # Веб-приложение (Astro + TypeScript)
├── docs/         # Архитектура и документация
├── .env.example  # Все переменные окружения
└── docker-compose.yml
```

## Два канала — один продукт

| Канал | Путь | Технологии | Аудитория |
|-------|------|-----------|-----------|
| **Telegram-бот** | `bot/` | Python, aiogram, SQLite | Массовый рынок, быстрый старт |
| **Веб-приложение** | `web/` | Astro SSR, TypeScript, SQLite | B2B, агентства, работа с Gallery |

## Быстрый старт

### 1. Переменные окружения

```bash
cp .env.example .env
# заполни .env своими значениями
```

### 2. Telegram-бот

```bash
cd bot
pip install -r requirements.txt
python main.py
```

### 3. Веб-приложение

```bash
cd web
npm install
npm run dev
# открой http://localhost:4321
```

### 4. Через Docker (оба сервиса вместе)

```bash
docker-compose up --build
```

## Как это работает

### Основной поток

```
Пользователь (фото + текст)
        ↓
Smart Prompt Enhancer (GPT-4o-mini)
  Фаза 1: перевод + кинематографические детали
  + PRESERVE system (если есть текст/цены/баннеры)
        ↓
Camera Director Compiler (GPT-4o-mini)
  Фаза 2: добавление MiniMax camera commands
  + санитайзер невалидных команд
        ↓
MiniMax Hailuo-02 API
  → генерация видео 6 или 10 секунд
        ↓
Готовое видео → пользователю
```

### PRESERVE-система (ключевое IP)

Если пользователь пишет «цена -50% не меняется» или «баннер сохранить» — система автоматически:
1. Добавляет `PRESERVE:` constraint (запрет изменения фона/текста/баннеров)
2. Добавляет `NO_GENERATION:` блок (запрет создания новых графических элементов)
3. Принудительно использует `[Static shot]` — любое движение камеры разрушает параллаксом текст на видео

Это решает главную боль продавцов маркетплейсов: фото с ценой или акционным баннером превращается в видео без артефактов.

## Тарифы

### Telegram-бот
| Пакет | Видео | Цена | ₽/видео |
|-------|-------|------|---------|
| Free trial | 3 | 0 ₽ | — |
| Starter | 5 | 490 ₽ | 98 ₽ |
| Seller | 20 | 1490 ₽ | 75 ₽ |
| Pro | 50 | 2990 ₽ | 60 ₽ |

### Веб-приложение
| Пакет | Кредиты | Цена | ₽/кредит |
|-------|---------|------|---------|
| Free | 3 | 0 ₽ | — |
| Basic | 50 | 3 950 ₽ | 79 ₽ |
| Professional | 200 | 13 800 ₽ | 69 ₽ |
| Custom | любое | 89 ₽/кредит | 89 ₽ |

> 1 кредит = 6 сек видео, 2 кредита = 10 сек видео

## База данных

На данный момент каждый канал использует **отдельный SQLite файл** — это технический долг.
Цель: мигрировать на общий PostgreSQL с единой схемой пользователей.

### Схема бота (`bot/beem.db`)
```sql
users(id, telegram_id UNIQUE, video_balance, free_remaining, username, created_at)
payments(id, payment_id UNIQUE, telegram_id, pack_id, videos_count, amount, status)
generations(id, telegram_id, image_path, prompt, status, video_path, created_at)
queue(id, generation_id UNIQUE, status)
```

### Схема веб-приложения (`web/beem.db`)
```sql
users(id, email UNIQUE, name, plan, role, generation_balance, generation_used, createdAt)
sessions(id, userId, token UNIQUE, expiresAt)
payments(id, userId, externalPaymentId UNIQUE, amount, credits, status, provider)
generations(id, userId, status, duration, cost, minimax_job_id, video_url, prompt_director, ...)
```

## Технический стек

| Слой | Бот | Веб |
|------|-----|-----|
| Язык | Python 3.x | TypeScript |
| Фреймворк | aiogram 2.x | Astro 5 SSR |
| БД | SQLite | SQLite |
| Платежи | YooKassa (polling) | YooKassa (webhook) |
| AI — промпты | OpenAI GPT-4o-mini | OpenAI GPT-4o-mini |
| AI — видео | MiniMax Hailuo-02 | MiniMax Hailuo-02 |
| Auth | Telegram user_id | Email + Google + Yandex OAuth |

## Переменные окружения

Описаны в `.env.example`. Общие переменные для обоих сервисов:
- `OPENAI_API_KEY` — GPT-4o-mini для улучшения промптов
- `MINIMAX_API_KEY` — генерация видео
- `YOOKASSA_SHOP_ID` + `YOOKASSA_API_KEY` — приём платежей

## Дорожная карта

- [ ] Объединить базы данных (PostgreSQL, единый аккаунт)
- [ ] YooKassa webhook вместо polling в боте
- [ ] Queue concurrency > 1 (параллельные генерации)
- [ ] Интеграция с WB/Ozon API (прямая загрузка видео в карточку)
- [ ] B2B тариф для агентств (bulk pricing)
