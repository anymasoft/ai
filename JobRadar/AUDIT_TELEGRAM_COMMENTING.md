# Технический аудит JobRadar: пригодность для pivot в SaaS-систему автоматического комментирования Telegram-каналов

**Дата:** 2026-02-17
**Версия проекта:** JobRadar v0
**Цель:** Оценить возможность использования кодовой базы JobRadar как основы для Telegram-сервиса "оживления каналов" с автоматическим комментированием.

---

## 1. Текущая архитектура JobRadar

### 1.1 Общая схема

```
┌─────────────────────────────────────────────────────┐
│              FastAPI + Uvicorn (main.py)             │
│                                                     │
│  ┌───────────────┐   ┌────────────────────────────┐ │
│  │  REST API     │   │  Фоновый polling-цикл      │ │
│  │  (endpoints)  │   │  monitoring_loop_tasks()    │ │
│  └───────┬───────┘   └────────────┬───────────────┘ │
│          │                        │                  │
│  ┌───────▼────────────────────────▼───────────────┐ │
│  │         SQLite (jobradar.db)                    │ │
│  │  Users, Tasks, Leads, TelegramSession,          │ │
│  │  TaskSourceState, Payments...                    │ │
│  └────────────────────────────────────────────────┘ │
│          │                        │                  │
│  ┌───────▼────────────────────────▼───────────────┐ │
│  │      Per-User TelegramClient Cache              │ │
│  │      telegram_clients_cache = {user_id: client} │ │
│  └────────────────────┬───────────────────────────┘ │
└───────────────────────┼─────────────────────────────┘
                        │
                   Telegram API
                   (Telethon)
```

### 1.2 Ключевые компоненты

| Файл | Размер | Назначение |
|------|--------|------------|
| `main.py` | ~73KB | FastAPI-приложение, все REST endpoints, авторизация, биллинг |
| `monitor.py` | ~30KB | Polling-цикл, обработка задач, отправка лидов |
| `models.py` | ~14KB | 11 ORM-моделей (SQLAlchemy) |
| `database.py` | ~10KB | Инициализация БД, миграции |
| `telegram_clients.py` | ~4.6KB | Per-user кеш TelegramClient |
| `telegram_auth.py` | ~4KB | Сохранение сессий в БД |
| `filter_engine.py` | ~4KB | Движок фильтрации по ключевым словам |
| `backfill.py` | ~10KB | Загрузка истории постов |
| `config.py` | ~1.5KB | Переменные окружения |

### 1.3 Текущая модель работы

JobRadar — это **система мониторинга Telegram-каналов** для поиска лидов по ключевым словам:

1. Пользователь авторизуется через свой Telegram-аккаунт (Telethon UserBot)
2. Создаёт задачу мониторинга с указанием каналов и ключевых слов
3. Фоновый polling-цикл каждые 10-30 сек проверяет каналы на новые посты
4. При совпадении по фильтру — создаёт Lead в БД и пересылает в личный Telegram
5. Веб-дашборд для управления задачами и просмотра лидов

---

## 2. Анализ event-модели

### 2.1 Текущая модель: Polling

```python
# monitor.py:378-420
async def monitoring_loop_tasks():
    while True:
        tasks = db.query(Task).filter(Task.status == "running").all()
        for task in tasks:
            await process_task_for_leads(task, db)  # ПОСЛЕДОВАТЕЛЬНО
            await asyncio.sleep(0.2)
        await asyncio.sleep(POLLING_INTERVAL_SECONDS + random.uniform(0, 20))
```

**Проблема для нового проекта:**

- **Polling вместо Event-driven:** Текущая модель опрашивает каналы каждые 10-30 секунд. Для системы комментирования нужна **мгновенная реакция** на новый пост (Telethon EventHandler / `client.on(events.NewMessage)`).
- **Последовательная обработка:** Задачи обрабатываются в один поток (`for task in tasks`). При 100 клиентах с 1-3 постами в день и 5-20 комментариями — система будет значительно отставать.
- **Jitter слишком велик:** `random.uniform(0, 20)` добавляет до 20 сек задержки. Для комментирования неприемлемо.

### 2.2 Что нужно для нового проекта: Event-driven модель

```
Требуется:
┌─────────────────┐    event     ┌──────────────┐    задание    ┌────────────┐
│ Telethon        │ ──────────→  │ Диспетчер    │ ──────────→   │ Очередь    │
│ EventHandler    │  NewMessage  │ событий      │  комментария  │ (Redis/    │
│ (per-account)   │              │              │               │  asyncio)  │
└─────────────────┘              └──────────────┘               └─────┬──────┘
                                                                      │
                                                          ┌───────────▼──────────┐
                                                          │ Worker Pool          │
                                                          │ (поведенческие       │
                                                          │  задержки + отправка)│
                                                          └──────────────────────┘
```

### 2.3 Вердикт по event-модели

**Текущая event-модель НЕ подходит.** Polling-цикл с последовательной обработкой фундаментально несовместим с требованиями реактивного комментирования. Необходима полная замена на event-driven архитектуру с Telethon EventHandler.

---

## 3. Мультисессионность и мультиаккаунтность

### 3.1 Текущая реализация

```python
# telegram_clients.py:18
telegram_clients_cache = {}  # {user_id: TelegramClient}
```

```python
# models.py:192
class TelegramSession:
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)  # ОДНА сессия на пользователя
```

**Текущая модель:** Один пользователь = один Telegram-аккаунт. Это архитектурное ограничение заложено на уровне БД (`unique=True`) и кеша (`{user_id: TelegramClient}`).

### 3.2 Что нужно для нового проекта

Для системы комментирования требуется **мультиаккаунтная архитектура:**

- **Пул аккаунтов-комментаторов** (5-20 аккаунтов на сервис)
- **Ротация аккаунтов** для избежания блокировок
- **Независимый мониторинг здоровья** каждого аккаунта (FloodWait, бан, session expired)
- **Прокси-привязка** (аккаунт ↔ прокси)
- **Cooldown-трекинг** на уровне каждого аккаунта

### 3.3 Что нужно переделать

| Компонент | Текущее состояние | Требуется |
|-----------|-------------------|-----------|
| `TelegramSession` | 1 user = 1 session (UNIQUE) | N аккаунтов-комментаторов, не привязанных к клиентам |
| `telegram_clients_cache` | `{user_id: client}` | `{account_id: client}` с health-tracking |
| Прокси | Не поддерживается | Обязательно (per-account) |
| Ротация | Отсутствует | Round-robin / weighted rotation |
| Cooldown | Только FloodWait | Per-account cooldown, rate-limit tracking |

**Вердикт:** Мультисессионность требует **полной переработки** слоя управления Telegram-клиентами.

---

## 4. Система очередей комментариев

### 4.1 Текущее состояние

В JobRadar **нет системы очередей**. Несмотря на то что `apscheduler` указан в `requirements.txt`, он не используется в коде. Обработка полностью синхронная внутри polling-цикла:

```python
# monitor.py:597-645
for msg in reversed(filtered_messages):
    if match_text(text, filter_config):
        db.add(lead)
        db.commit()
        await send_lead_to_telegram(task, lead, db)  # Отправка ПРЯМО В ЦИКЛЕ
```

### 4.2 Необходимая архитектура очередей

```
Новый пост обнаружен
        │
        ▼
┌───────────────────────────────────┐
│ CommentScheduler                   │
│                                    │
│ 1. Определить клиента (чей канал)  │
│ 2. Определить тариф → кол-во      │
│    комментариев (5-20)             │
│ 3. Выбрать тексты (LLM / шаблоны) │
│ 4. Рассчитать расписание:          │
│    - Нелинейное распределение      │
│    - Поведенческие задержки        │
│    - Random jitter                 │
│ 5. Создать N записей CommentJob    │
│    в очереди                       │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ CommentQueue (Redis / DB)          │
│                                    │
│ job_id | post_url | account_id |   │
│ text   | scheduled_at | status |   │
│ retry_count | proxy_id | ...       │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ CommentWorker (asyncio workers)    │
│                                    │
│ - Берёт задание из очереди         │
│ - Ждёт scheduled_at               │
│ - Выбирает аккаунт из пула        │
│ - Отправляет комментарий           │
│ - Обрабатывает FloodWait / ошибки  │
│ - Обновляет статус                 │
└───────────────────────────────────┘
```

### 4.3 Оценка реализации

В текущем коде **нет ни одного компонента**, который можно переиспользовать для этой очереди. Потребуется написать:
- Модель `CommentJob` (очередь в БД или Redis)
- `CommentScheduler` — планировщик с нелинейным распределением
- `CommentWorker` — воркер с пулом аккаунтов и retry-логикой
- Интеграция с Redis (или как минимум `asyncio.PriorityQueue`)

---

## 5. Интеграция LLM

### 5.1 Текущее состояние

В JobRadar **нет никакой интеграции с LLM**. Фильтрация текста — чистый keyword matching:

```python
# filter_engine.py:111-130
def match_text(text: str, filter_config: dict) -> bool:
    normalized_text = normalize_text(text)
    for group in exclude_groups:
        if all(word in normalized_text for word in group):
            return False
    for group in include_groups:
        if all(word in normalized_text for word in group):
            return True
    return False
```

### 5.2 Точки интеграции LLM для нового проекта

```
┌──────────────────────────────────────────────┐
│  LLM Integration Points                       │
│                                                │
│  1. ГЕНЕРАЦИЯ КОММЕНТАРИЕВ                     │
│     CommentScheduler → LLM API                 │
│     Вход: текст поста + контекст канала         │
│     Выход: N уникальных комментариев            │
│     Модели: GPT-4o-mini / Claude Haiku          │
│                                                │
│  2. ПЕРСОНАЛИЗАЦИЯ (будущее)                    │
│     Учёт тона канала, стиля комментариев        │
│     Адаптация под "личность" аккаунта           │
│                                                │
│  3. МОДЕРАЦИЯ (будущее)                         │
│     Проверка сгенерированных комментариев       │
│     на адекватность перед отправкой              │
└──────────────────────────────────────────────┘
```

### 5.3 Рекомендуемая точка интеграции

Логичное место — **между обнаружением нового поста и постановкой в очередь комментариев**. На первом этапе можно использовать шаблоны с рандомизацией, а LLM подключить как отдельный сервис позже.

---

## 6. Узкие места и риски масштабирования

### 6.1 Критические узкие места

#### 6.1.1 SQLite

```python
# config.py:23
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'jobradar.db')}"

# database.py:13
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
```

**Проблема:** SQLite не поддерживает конкурентную запись. При 100 клиентах с 5-20 комментариями на пост будет **блокировка записи** (`database is locked`). SQLite подходит только для прототипа на 1-5 пользователей.

**Решение:** Миграция на PostgreSQL (обязательно для production).

#### 6.1.2 In-memory кеш клиентов

```python
# telegram_clients.py:18
telegram_clients_cache = {}  # {user_id: TelegramClient}
```

**Проблема:** Все TelegramClient хранятся в памяти одного процесса. При 20 активных аккаунтах-комментаторах каждый потребляет ~50-100MB RAM (Telethon + session data). При горизонтальном масштабировании (несколько процессов/серверов) кеш не разделяется.

**Решение:** Архитектура с вынесением управления аккаунтами в отдельный сервис или использование Redis для координации.

#### 6.1.3 Монолитный main.py (~73KB)

**Проблема:** Весь код API, авторизации, биллинга, задач, лидов — в одном файле. Это затрудняет:
- Масштабирование отдельных компонентов
- Тестирование
- Параллельную разработку
- Понимание кодовой базы

#### 6.1.4 Отсутствие rate-limiting

```python
# monitor.py:208-240
async def safe_send_message(client, chat_id, text, **kwargs):
    while True:
        try:
            return await client.send_message(chat_id, text, **kwargs)
        except FloodWaitError as e:
            await asyncio.sleep(e.seconds)  # Только РЕАКТИВНАЯ обработка FloodWait
```

**Проблема:** Обработка FloodWait только реактивная (ждём когда Telegram скажет "стоп"). Нет **проактивного rate-limiting** — нет трекинга скорости отправки, нет per-account лимитов, нет backoff между комментариями одного аккаунта.

**Риск для нового проекта:** Массовое комментирование от одного аккаунта приведёт к бану. Нужен проактивный rate limiter.

#### 6.1.5 Отсутствие прокси

В текущем коде **нет поддержки прокси**:

```python
# telegram_clients.py:75
client = TelegramClient(session_string, TELEGRAM_API_ID, TELEGRAM_API_HASH)
# Нет параметра proxy=...
```

Для мультиаккаунтной системы комментирования прокси обязательны.

### 6.2 Математика масштабирования

```
Сценарий: 100 клиентов, 3 поста/день, 15 комментариев/пост

Комментариев в день:  100 × 3 × 15 = 4,500
Комментариев в час:   4,500 / 16 (рабочих часов) ≈ 281
Комментариев в минуту: 281 / 60 ≈ 4.7

При 10 аккаунтах-комментаторах:
  ~0.47 комментария/мин на аккаунт — это безопасно

При поведенческих задержках (30с - 10мин между комментариями):
  Требуется пул из минимум 5-10 аккаунтов для параллельной работы

Пиковая нагрузка (все посты утром в 10:00-12:00):
  До 20-30 комментариев/мин — нужно минимум 15-20 аккаунтов
```

---

## 7. Что можно переиспользовать

### 7.1 Переиспользуемые компоненты (с доработкой)

| Компонент | Что можно взять | Доработка |
|-----------|----------------|-----------|
| **Telethon-интеграция** | Паттерн StringSession + кеширование клиентов | Добавить прокси, пул, ротацию, health-check |
| **FloodWait-обработка** | `safe_send_message()` — базовый паттерн retry | Добавить проактивный rate-limiting, cooldown |
| **Модель User** | Структура пользователя, auth_token | Убрать привязку к phone, добавить client_id |
| **Модель Payment** | Биллинг через YooKassa | Адаптировать тарифы |
| **Веб-авторизация** | Паттерн cookie + token | Переключить на Telegram Bot OAuth |
| **Миграции** | Паттерн `migrate_schema()` | Перейти на Alembic |

### 7.2 Непереиспользуемые компоненты

| Компонент | Причина |
|-----------|---------|
| `monitoring_loop_tasks()` | Polling-модель несовместима с реактивным комментированием |
| `filter_engine.py` | Keyword matching не нужен для комментирования |
| `backfill.py` | Специфичен для поиска лидов |
| `models.py` (Task, Lead, TaskSourceState) | Модели заточены под мониторинг, не под очередь комментариев |
| `main.py` (endpoints) | 90% endpoints специфичны для JobRadar |
| Веб-интерфейс (templates/) | Дашборд лидов не нужен; управление будет через Telegram-бот |

---

## 8. Что потребует переписывания

### 8.1 Полностью новые компоненты (нет аналогов в JobRadar)

1. **Telegram EventHandler** — подписка на новые посты в каналах клиентов через `client.on(events.NewMessage)`
2. **CommentScheduler** — планировщик с нелинейным распределением задержек
3. **CommentQueue** — очередь заданий (Redis или PostgreSQL + asyncio)
4. **CommentWorker** — пул воркеров с ротацией аккаунтов
5. **AccountPool** — управление пулом аккаунтов-комментаторов (health, cooldown, proxy)
6. **LLM-интеграция** — генерация текстов комментариев
7. **Telegram Bot** — интерфейс управления для клиентов (вместо веб-дашборда)
8. **Rate Limiter** — проактивный контроль скорости отправки

### 8.2 Компоненты, требующие значительной переработки

1. **БД:** SQLite → PostgreSQL + Redis
2. **Модели:** Новая схема (Client, Channel, CommentJob, Account, Proxy, Tariff)
3. **Управление аккаунтами:** Пул вместо per-user, ротация, прокси
4. **Конфигурация:** Docker + переменные окружения для multi-service архитектуры

### 8.3 Необходимая новая схема БД

```sql
-- Клиенты сервиса
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    telegram_user_id BIGINT UNIQUE,
    plan VARCHAR(50),  -- free | basic | pro
    max_channels INT,
    max_comments_per_post INT,
    paid_until TIMESTAMP,
    created_at TIMESTAMP
);

-- Каналы клиентов
CREATE TABLE client_channels (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES clients(id),
    channel_username VARCHAR(255),
    channel_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
);

-- Аккаунты-комментаторы (пул сервиса)
CREATE TABLE commenter_accounts (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE,
    session_string TEXT,
    proxy_id INT REFERENCES proxies(id),
    status VARCHAR(50),  -- active | cooldown | banned | disabled
    cooldown_until TIMESTAMP,
    flood_wait_until TIMESTAMP,
    total_comments_today INT DEFAULT 0,
    daily_limit INT DEFAULT 50,
    last_comment_at TIMESTAMP,
    created_at TIMESTAMP
);

-- Прокси
CREATE TABLE proxies (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255),
    port INT,
    username VARCHAR(255),
    password VARCHAR(255),
    protocol VARCHAR(10),  -- socks5 | http
    is_active BOOLEAN DEFAULT TRUE,
    assigned_account_id INT
);

-- Очередь комментариев
CREATE TABLE comment_jobs (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES clients(id),
    channel_id INT REFERENCES client_channels(id),
    post_message_id BIGINT,
    post_url VARCHAR(255),
    comment_text TEXT,
    account_id INT REFERENCES commenter_accounts(id),
    scheduled_at TIMESTAMP,
    status VARCHAR(50),  -- pending | in_progress | done | failed | cancelled
    attempt_count INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    error_message TEXT,
    executed_at TIMESTAMP,
    created_at TIMESTAMP
);

-- Тарифы
CREATE TABLE tariffs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    max_channels INT,
    max_comments_per_post INT,
    price_monthly DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE
);
```

---

## 9. Архитектурные риски нового проекта

### 9.1 Риски блокировки Telegram

| Риск | Вероятность | Влияние | Митигация |
|------|------------|---------|-----------|
| FloodWait на аккаунт | Высокая | Средний | Проактивный rate-limit, ротация аккаунтов |
| Бан аккаунта за спам | Средняя | Высокий | Поведенческие задержки, уникальные тексты (LLM), лимиты |
| Session revoke | Низкая | Высокий | Мониторинг здоровья аккаунтов, автозамена |
| IP-бан | Средняя | Высокий | Прокси-ротация, residential proxies |
| Массовый бан пула | Низкая | Критический | Разделение пулов, разные прокси, разные API ID |

### 9.2 Архитектурные риски

| Риск | Описание | Митигация |
|------|----------|-----------|
| Single point of failure | Один процесс обслуживает всё | Разделить на микросервисы |
| Потеря данных при crash | In-memory кеш и очередь | Redis persistent queue |
| Гонки (race conditions) | Несколько воркеров → один аккаунт | Distributed locking (Redis) |
| Накопление задолженности | Если комментирование отстаёт | Priority queue + TTL на задания |
| Утечка соединений Telegram | TelegramClient не всегда корректно закрывается | Health-check + GC |

---

## 10. Рекомендуемая целевая архитектура

```
┌──────────────────────────────────────────────────────────┐
│                     TELEGRAM BOT                          │
│            (управление клиентами и тарифами)              │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                      API GATEWAY                          │
│                 (FastAPI / REST API)                       │
└──────┬──────────────┬────────────────┬──────────────────┘
       │              │                │
┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼──────────────────┐
│ Channel     │ │ Comment    │ │ Account                  │
│ Monitor     │ │ Scheduler  │ │ Manager                  │
│ Service     │ │ Service    │ │ Service                  │
│             │ │            │ │                          │
│ EventHandler│ │ Нелинейные │ │ Пул аккаунтов            │
│ per-channel │ │ задержки   │ │ Прокси-ротация           │
│             │ │ LLM-текст  │ │ Health monitoring        │
└──────┬──────┘ └─────┬──────┘ └──────┬──────────────────┘
       │              │                │
┌──────▼──────────────▼────────────────▼──────────────────┐
│                    Redis                                  │
│         (очередь задач, rate-limit, locks)                │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    PostgreSQL                              │
│    (clients, channels, accounts, jobs, payments)          │
└─────────────────────────────────────────────────────────┘
```

---

## 11. Итоговое заключение

### 11.1 Количественная оценка переиспользования

| Категория | Объём кода JobRadar | Переиспользуемо | % |
|-----------|--------------------|--------------------|---|
| Telegram-клиенты | ~4.6KB | Паттерн (не код) | ~20% |
| Мониторинг | ~30KB | Нет | 0% |
| API + веб | ~73KB | Нет (другой интерфейс) | 0% |
| Модели БД | ~14KB | Частично User/Payment | ~15% |
| Фильтрация | ~4KB | Нет | 0% |
| Backfill | ~10KB | Нет | 0% |
| БД + миграции | ~10KB | Паттерн миграций | ~10% |
| Конфигурация | ~1.5KB | Паттерн .env | ~30% |
| **Итого** | **~147KB** | **~5-10%** | |

### 11.2 Вердикт

**Рекомендация: писать с нуля, взяв из JobRadar только паттерны и опыт.**

**Обоснование:**

1. **Фундаментальное расхождение моделей:** JobRadar — система **чтения** (мониторинг каналов), новый проект — система **записи** (публикация комментариев). Это принципиально разные архитектуры.

2. **Polling vs Event-driven:** Ядро JobRadar — polling-цикл, который нужно полностью заменить на event-driven модель. Это не рефакторинг, а замена основного механизма.

3. **Single-account vs Multi-account:** Вся архитектура JobRadar построена вокруг "один пользователь = один аккаунт". Новый проект требует пула аккаунтов-комментаторов с ротацией. Это другая парадигма.

4. **SQLite → PostgreSQL + Redis:** Смена БД затрагивает все слои приложения.

5. **Веб-дашборд → Telegram Bot:** Весь фронтенд (templates, static, API endpoints) не переиспользуется.

6. **Отсутствие ключевых компонентов:** Очередь, scheduler, rate-limiter, account pool, proxy manager, LLM-интеграция — всё это нужно создавать с нуля.

7. **Переиспользуемого кода < 10%.** Стоимость адаптации превышает стоимость написания нового проекта.

### 11.3 Что стоит взять из JobRadar

Не код, а **архитектурный опыт и паттерны:**

- Паттерн StringSession + кеширование TelegramClient
- Обработка FloodWaitError (расширить до проактивного rate-limiting)
- Паттерн нормализации Telegram-ссылок (`normalize_telegram_source()`)
- Структура конфигурации через .env
- Опыт работы с Telethon (entity resolution, get_messages, send_message)
- Паттерн миграций БД (перейти на Alembic)
- Структура YooKassa-интеграции для биллинга

### 11.4 Рекомендуемый план действий

1. **Создать новый проект** с чистой архитектурой
2. **Технологический стек:** Python 3.11+, FastAPI, PostgreSQL, Redis, Telethon, Docker Compose
3. **Начать с MVP:** 1 клиент, 1 канал, 3 аккаунта-комментатора, шаблонные тексты
4. **Итерация 2:** Telegram Bot для управления, тарифы, биллинг
5. **Итерация 3:** LLM-генерация текстов, расширение пула аккаунтов
6. **Итерация 4:** Масштабирование до 100 клиентов, мониторинг, алертинг

---

*Аудит подготовлен на основе полного анализа исходного кода JobRadar v0.*
