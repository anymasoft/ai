# ТЕХНИЧЕСКИЙ АУДИТ - ЧАСТЬ 2

## 3. ОБЗОР ВСЕХ API ENDPOINTS

### 3.1. Competitors API

#### `GET /api/competitors`
**Назначение:** Получить список всех конкурентов текущего пользователя

**Параметры:** Нет

**Аутентификация:** Требуется (NextAuth session)

**Ответ:**
```typescript
Array<{
  id: number
  userId: string
  platform: string
  channelId: string
  handle: string
  title: string
  avatarUrl: string | null
  subscriberCount: number
  videoCount: number
  viewCount: number
  lastSyncedAt: number
  createdAt: number
}>
```

**Ошибки:**
- 401: Не авторизован

---

#### `POST /api/competitors`
**Назначение:** Добавить нового конкурента

**Параметры:**
```typescript
{
  handle: string // @channelname, channelId, или полный URL
}
```

**Логика:**
1. Проверяет аутентификацию
2. Нормализует handle через `normalizeYoutubeInput()`
3. Проверяет лимит тарифного плана
4. Запрашивает данные из ScrapeCreators API
5. Проверяет дубликаты
6. Сохраняет в БД
7. Возвращает созданную запись

**Ответ:**
```typescript
{
  id: number
  userId: string
  platform: "youtube"
  channelId: string
  handle: string
  title: string
  avatarUrl: string | null
  subscriberCount: number
  videoCount: number
  viewCount: number
  lastSyncedAt: number
  createdAt: number
}
```

**Ошибки:**
- 400: Невалидный handle
- 401: Не авторизован
- 402: Достигнут лимит плана
- 409: Конкурент уже существует
- 500: Ошибка API или БД

---

#### `DELETE /api/competitors/[id]`
**Назначение:** Удалить конкурента

**Параметры URL:** `id` (competitor ID)

**Логика:**
1. Проверяет аутентификацию
2. Проверяет владение записью
3. Удаляет запись (каскадное удаление связанных данных)

**Ответ:**
```typescript
{ success: true }
```

**Ошибки:**
- 400: Невалидный ID
- 401: Не авторизован
- 404: Конкурент не найден
- 500: Ошибка БД

---

### 3.2. Channel Sync API

#### `POST /api/channel/[id]/sync`
**Назначение:** Синхронизировать метрики канала (подписчики, видео, просмотры)

**Параметры URL:** `id` (competitor ID)

**Частота:** Раз в 6 часов (rate limit)

**Логика:**
1. Проверяет аутентификацию и владение
2. Проверяет rate limit (6 часов)
3. Запрашивает свежие данные из ScrapeCreators
4. Проверяет лимит записей в день (10 для тестирования, 1 для продакшена)
5. Сохраняет в `channel_metrics`
6. Обновляет `competitors`

**Ответ:**
```typescript
{
  status: "ok" | "exists"
  message: string
  metrics?: {
    id: number
    subscriberCount: number
    videoCount: number
    viewCount: number
    date: string // YYYY-MM-DD
    fetchedAt: number
  }
  totalDataPoints: number
}
```

**Ошибки:**
- 400: Невалидный ID
- 401: Не авторизован
- 404: Канал не найден
- 429: Rate limit (6 часов не прошло)
- 500: Ошибка API

---

#### `POST /api/channel/[id]/videos/sync`
**Назначение:** Синхронизировать топ-видео канала

**Параметры URL:** `id` (competitor ID)

**Логика:**
1. Проверяет аутентификацию и владение
2. Запрашивает видео из ScrapeCreators (до 5 страниц)
3. Для каждого видео: проверяет существование, обновляет или создает
4. Возвращает статистику

**Ответ:**
```typescript
{
  status: "ok"
  added: number // новых видео
  updated: number // обновленных видео
  totalVideos: number // всего в БД
}
```

**Особенности:**
- Использует fallback: сначала channelId, потом handle
- Загружает до ~150 видео (5 страниц по ~30)
- Сортировка: latest (последние видео)

**Ошибки:**
- 400: Невалидный ID
- 401: Не авторизован
- 404: Канал не найден
- 500: Ошибка API

---

#### `POST /api/channel/[id]/comments/sync`
**Назначение:** Синхронизировать комментарии для топ-15 видео

**Параметры URL:** `id` (competitor ID)

**Логика:**
1. Проверяет аутентификацию и владение
2. Получает топ-15 видео по просмотрам
3. Для каждого видео:
   - Проверяет свежесть комментариев (7 дней)
   - Загружает до 300 топ-комментариев
   - Сохраняет или обновляет в БД
   - Задержка 1 секунда между запросами (rate limiting)
4. Обрабатывает ошибку недостаточных кредитов (402)

**Ответ:**
```typescript
{
  success: true
  synced: number // видео синхронизировано
  skipped: number // пропущено (свежие)
  errors: number // ошибок
  totalComments: number // всего комментариев
  totalVideos: number // всего видео
  insufficientCredits?: boolean // если кредиты закончились
}
```

**Ошибки:**
- 400: Невалидный ID или нет видео
- 401: Не авторизован
- 402: Кредиты ScrapeCreators закончились
- 404: Канал не найден
- 500: Ошибка API

---

### 3.3. AI Analysis API

#### `POST /api/channel/[id]/content-intelligence`
**Назначение:** Генерация AI-анализа контента канала

**Параметры URL:** `id` (competitor ID)

**Требования:** Наличие синхронизированных видео

**Кэширование:** 7 дней

**Логика:**
1. Проверяет аутентификацию и владение
2. Проверяет наличие видео (минимум 1)
3. Проверяет кэш (если есть свежий анализ - возвращает)
4. Берет топ-50 видео
5. Формирует промпт для GPT-4o-mini
6. Генерирует анализ
7. Сохраняет в `content_intelligence`

**Ответ:**
```typescript
{
  themes: string[] // ключевые темы
  formats: string[] // форматы контента
  patterns: string[] // повторяющиеся паттерны
  opportunities: string[] // возможности
  recommendations: string[] // рекомендации
  generatedAt: number
}
```

**GPT Model:** gpt-4o-mini  
**Temperature:** 0.7  
**Max Tokens:** 1500

**Ошибки:**
- 400: Нет видео для анализа
- 401: Не авторизован
- 404: Канал не найден
- 500: Ошибка OpenAI

---

#### `GET /api/channel/[id]/content-intelligence`
**Назначение:** Получить существующий анализ контента

**Параметры URL:** `id` (competitor ID)

**Ответ:**
```typescript
{
  themes: string[]
  formats: string[]
  patterns: string[]
  opportunities: string[]
  recommendations: string[]
  generatedAt: number
} | { analysis: null }
```

---

#### `POST /api/channel/[id]/momentum`
**Назначение:** Генерация momentum-анализа (трендовые видео)

**Параметры URL:** `id` (competitor ID)

**Требования:** Наличие синхронизированных видео

**Кэширование:** 3 дня

**Логика:**
1. Получает последние 150 видео
2. Вычисляет views_per_day для каждого видео
3. Вычисляет медиану views_per_day
4. Вычисляет momentum_score = (views_per_day / median) - 1
5. Категоризирует: High Momentum (+50%+), Rising (+10%), Normal, Underperforming (-30%)
6. Фильтрует топ-20 High Momentum видео
7. Генерирует AI-анализ трендов через GPT
8. Сохраняет результат

**Ответ:**
```typescript
{
  highMomentumVideos: Array<{
    videoId: string
    title: string
    viewCount: number
    viewsPerDay: number
    momentumScore: number
    publishedAt: string
  }>
  stats: {
    totalAnalyzed: number
    highMomentum: number
    rising: number
    medianViewsPerDay: number
  }
  hotThemes: string[]
  hotFormats: string[]
  hotIdeas: string[]
  explanation: string
  generatedAt: number
}
```

**GPT Model:** gpt-4o-mini  
**Temperature:** 0.7  
**Max Tokens:** 1000

---

#### `GET /api/channel/[id]/momentum`
**Назначение:** Получить существующий momentum-анализ

**Ответ:** Аналогичен POST (с добавлением videoId к каждому видео)

---

#### `POST /api/channel/[id]/deep`
**Назначение:** Глубокий анализ аудитории

**Параметры URL:** `id` (competitor ID)

**Кэширование:** 7 дней

**Логика:**
1. Проверяет кэш
2. Генерирует generic анализ через GPT
3. Сохраняет в `deep_audience`

**Ответ:**
```typescript
{
  audienceProfile: string[]
  contentPreferences: string[]
  engagementPatterns: string[]
  recommendations: string[]
  totalAnalyzed: number
  channelTitle: string
  createdAt: number
}
```

**ПРИМЕЧАНИЕ:** Текущая реализация НЕ использует реальные данные комментариев

---

#### `GET /api/channel/[id]/deep`
**Назначение:** Получить существующий анализ аудитории

---

#### `POST /api/channel/[id]/comments/ai`
**Назначение:** Глубокий AI-анализ комментариев (v2.0)

**Параметры URL:** `id` (competitor ID)

**Требования:** Комментарии для топ-30 видео

**Логика:**
1. Получает топ-30 видео
2. Получает до 1000 комментариев (топ по лайкам)
3. Нормализует текст (удаляет emoji, URL, хештеги, HTML)
4. Разбивает на чанки по 3500 символов
5. Создает запись со статусом 'pending'
6. Анализирует каждый чанк через GPT
7. Обновляет прогресс после каждого чанка
8. Объединяет результаты
9. Сохраняет финальный результат

**Ответ:**
```typescript
{
  themes: string[] // до 10
  painPoints: string[] // до 10
  requests: string[] // до 10
  praises: string[] // до 10
  audienceSegments: string[] // до 8
  sentimentSummary: {
    positive: number // %
    negative: number // %
    neutral: number // %
  }
  topQuotes: string[] // до 15
  hiddenPatterns: string[] // до 8
  actionableIdeas: string[] // до 10
  totalAnalyzed: number
  language: "ru"
  cached: boolean
  createdAt: number
}
```

**Особенности:**
- НИКОГДА не падает (всегда возвращает JSON)
- Обновляет статус на 'error' при ошибке
- Поддерживает прогресс-трекинг

**GPT Model:** gpt-4o-mini  
**Temperature:** 0.7  
**Max Tokens:** 2000 (на чанк)

---

#### `GET /api/channel/[id]/comments/ai`
**Назначение:** Получить существующий глубокий анализ комментариев

---

#### `GET /api/channel/[id]/comments/ai/progress`
**Назначение:** Получить прогресс анализа комментариев

**Ответ:**
```typescript
{
  status: "pending" | "processing" | "done" | "error"
  progress_current: number
  progress_total: number
  percentage: number
}
```

---

### 3.4. User API

#### `POST /api/user/language`
**Назначение:** Изменить язык пользователя

**Параметры:**
```typescript
{
  language: "en" | "ru"
}
```

**Ответ:**
```typescript
{
  success: true
  language: string
}
```

---

## 4. ТЕКУЩИЕ ВОЗМОЖНОСТИ АНАЛИЗА

### 4.1. Количественный анализ (Metrics)

**Что уже реализовано:**

1. **Базовые метрики канала:**
   - Подписчики (общее количество)
   - Видео (общее количество)
   - Просмотры (общее количество)
   - Средние просмотры на видео

2. **Исторические графики:**
   - График роста подписчиков по времени
   - График роста просмотров по времени
   - График роста количества видео
   - Данные хранятся в `channel_metrics` с timestamp

3. **Метрики видео:**
   - Просмотры каждого видео
   - Лайки каждого видео
   - Комментарии каждого видео
   - Дата публикации
   - Сортировка по популярности

4. **Momentum метрики:**
   - Views per day (просмотры в день с момента публикации)
   - Momentum score (отклонение от медианы)
   - Категоризация: High Momentum, Rising, Normal, Underperforming
   - Медиана views_per_day для канала

---

### 4.2. Качественный анализ (AI-powered)

**Реализованные модули:**

#### 1. Content Intelligence
**Что анализирует:**
- Ключевые темы контента (themes)
- Форматы видео (formats): обзоры, туториалы, влоги, и т.д.
- Повторяющиеся паттерны (patterns): длина названий, ключевые слова, структура
- Возможности (opportunities): какие темы дают больше просмотров
- Рекомендации (recommendations): что стоит снять

**Источник данных:** Топ-50 видео (названия, просмотры, даты)

**Модель:** GPT-4o-mini

**Кэш:** 7 дней

---

#### 2. Momentum Insights
**Что анализирует:**
- Видео с высоким momentum (растущие видео)
- Горячие темы (hotThemes): темы с высокими показами сейчас
- Горячие форматы (hotFormats): форматы, которые работают лучше всего
- Горячие идеи (hotIdeas): конкретные идеи для создания контента
- Объяснение (explanation): почему эти темы растут

**Источник данных:** Топ-20 High Momentum видео

**Алгоритм:**
```
momentum_score = (views_per_day / median_views_per_day) - 1
High Momentum: score > 0.5 (превышает медиану на 50%+)
```

**Модель:** GPT-4o-mini

**Кэш:** 3 дня

---

#### 3. Audience Insights (Generic)
**Что анализирует:**
- Профиль аудитории (audienceProfile): характеристики аудитории
- Предпочтения контента (contentPreferences): что нравится аудитории
- Паттерны взаимодействия (engagementPatterns): как аудитория взаимодействует
- Рекомендации (recommendations): практические советы

**Источник данных:** Только название канала (generic анализ)

**ОГРАНИЧЕНИЕ:** Не использует реальные данные комментариев

**Модель:** GPT-4o-mini

**Кэш:** 7 дней

---

#### 4. Deep Comment Analysis (v2.0)
**Что анализирует:**
- Темы обсуждений (themes): о чем говорит аудитория
- Боли аудитории (painPoints): фрустрации, проблемы, жалобы
- Запросы (requests): что аудитория явно просит
- Похвалы (praises): что им нравится
- Сегменты аудитории (audienceSegments): группы (новички, эксперты, скептики)
- Sentiment анализ: positive/negative/neutral в %
- Топ-цитаты (topQuotes): реальные цитаты из комментариев
- Скрытые паттерны (hiddenPatterns): неочевидные инсайты
- Действенные идеи (actionableIdeas): предложения для автора

**Источник данных:** До 1000 комментариев с топ-30 видео (отсортированы по лайкам)

**Обработка:**
- Нормализация текста: удаление emoji, URL, хештегов, HTML, timestamp меток
- Минимальная длина: 5 символов
- Чанкинг: по 3500 символов на чанк

**Модель:** GPT-4o-mini (множественные запросы)

**Особенности:**
- Прогресс-бар с отслеживанием
- Обработка по чанкам
- Объединение результатов
- Дедупликация

---

### 4.3. Определение трендов

**Реализованный алгоритм Momentum Analysis:**

```typescript
// Для каждого видео:
1. days_since_publish = (now - publishedAt) / (1000 * 60 * 60 * 24)
2. views_per_day = viewCount / days_since_publish

// Для канала:
3. median_vpd = median(all_views_per_day)

// Для каждого видео:
4. momentum_score = (views_per_day / median_vpd) - 1

// Категоризация:
if (momentum_score > 0.5) → High Momentum
if (momentum_score > 0.1) → Rising
if (momentum_score < -0.3) → Underperforming
else → Normal
```

**Применение:**
- Выявление быстрорастущих видео
- Определение трендовых тем
- Рекомендации по контенту
- Прогнозирование успешных форматов

---

### 4.4. Анализ комментариев

**Два уровня:**

**1. Simple Comment Insights (Legacy):**
- Базовая статистика
- Количество комментариев
- Используется редко

**2. Deep Comment Analysis (v2.0):**
- Глубокий семантический анализ
- Извлечение тем и паттернов
- Sentiment analysis
- Сегментация аудитории
- Выявление болей и запросов
- Генерация цитат и идей

**Источники:**
- До 300 комментариев на видео (топ по рейтингу)
- Топ-15 видео канала для Simple
- Топ-30 видео для Deep Analysis
- Фокус на комментариях с высокими лайками

---

### 4.5. Определение популярных роликов

**Критерии:**

1. **По абсолютным просмотрам:**
   - Сортировка по `viewCount DESC`
   - Топ-N видео отображаются в UI

2. **По momentum:**
   - Сортировка по `momentum_score DESC`
   - Выявляет быстрорастущие видео

3. **По engagement:**
   - Ratio лайков к просмотрам
   - Количество комментариев

**Использование:**
- Top Videos Grid (визуальное отображение)
- Momentum Analysis (трендовые видео)
- AI Analysis (анализ успешного контента)

---
