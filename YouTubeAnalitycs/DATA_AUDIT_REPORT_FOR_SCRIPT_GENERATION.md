# ПОЛНЫЙ ОТЧЕТ АУДИТА ДАННЫХ ДЛЯ ГЕНЕРАЦИИ СЦЕНАРИЕВ

## Дата аудита: 06.12.2025
## Проект: YouTube Competitors Analytics

---

## 1. ОБЗОР ДОСТУПНЫХ ДАННЫХ

### 1.1. Источники данных
- **ScrapeCreators API**: основной источник данных о каналах, видео, комментариях
- **Внутренние расчеты**: momentum score, views per day, медианные сравнения
- **AI аналитика**: GPT-анализ каналов, комментариев, трендов
- **База данных SQLite**: хранение всех собранных и сгенерированных данных

### 1.2. Структура БД (ключевые таблицы)
```
channel_videos: id, channelId, videoId, title, thumbnailUrl, viewCount, likeCount, commentCount, publishedAt, fetchedAt
video_details: id, videoId, url, likeCount, commentCount, viewCount, durationMs, keywordsJson, transcriptShort, updatedAt
video_comments: id, videoId, commentId, content, publishedTime, replyLevel, likes, replies, authorName, authorChannelId, isVerified, isCreator, fetchedAt, channelId, data
competitors: id, userId, platform, channelId, handle, title, avatarUrl, subscriberCount, videoCount, viewCount, lastSyncedAt, createdAt
```

---

## 2. ДЕТАЛЬНАЯ ТАБЛИЦА ДАННЫХ

| Поле | Наличие | Источник | В БД? | Готовность |
|------|---------|----------|-------|------------|
| **title** | ✅ ДА | ScrapeCreators API | ✅ ДА (channel_videos) | ✅ Готово |
| **description** | ❌ НЕТ | Не сохраняется | ❌ НЕТ | ❌ Требуется |
| **keywords / tags** | ⚠️ ЧАСТИЧНО | ScrapeCreators API | ✅ ДА (video_details.keywordsJson) | ⚠️ JSON парсинг |
| **viewCount** | ✅ ДА | ScrapeCreators API | ✅ ДА (channel_videos) | ✅ Готово |
| **likeCount** | ✅ ДА | ScrapeCreators API | ✅ ДА (channel_videos, video_details) | ✅ Готово |
| **commentCount** | ✅ ДА | ScrapeCreators API | ✅ ДА (channel_videos, video_details) | ✅ Готово |
| **publishedAt** | ✅ ДА | ScrapeCreators API | ✅ ДА (channel_videos) | ✅ Готово |
| **channelTitle** | ✅ ДА | ScrapeCreators API | ✅ ДА (competitors.title) | ✅ Готово |
| **channelHandle** | ✅ ДА | ScrapeCreators API | ✅ ДА (competitors.handle) | ✅ Готово |
| **momentumScore** | ✅ ДА | Расчет (momentum-queries.ts) | ❌ НЕТ (на лету) | ✅ Готово |
| **viewsPerDay** | ✅ ДА | Расчет (momentum-queries.ts) | ❌ НЕТ (на лету) | ✅ Готово |
| **medianComparison** | ✅ ДА | Расчет (momentum-queries.ts) | ❌ НЕТ (на лету) | ✅ Готово |
| **transcript** | ⚠️ ЧАСТИЧНО | ScrapeCreators API | ✅ ДА (video_details.transcriptShort) | ⚠️ Только короткая |
| **summary (видео)** | ❌ НЕТ | Не генерируется | ❌ НЕТ | ❌ Требуется |
| **summary (канала)** | ✅ ДА | AI анализ (analyzeChannel.ts) | ✅ ДА (ai_insights.summary) | ✅ Готово |
| **themes / topics** | ✅ ДА | AI анализ трендов | ✅ ДА (trending_insights.themes) | ✅ Готово |
| **formats** | ✅ ДА | AI анализ трендов | ✅ ДА (trending_insights.formats) | ✅ Готово |
| **recommendations** | ✅ ДА | AI анализ трендов | ✅ ДА (trending_insights.recommendations) | ✅ Готово |
| **audience insights** | ✅ ДА | AI анализ комментариев | ✅ ДА (channel_ai_comment_insights) | ✅ Готово |
| **comment sentiments** | ✅ ДА | AI анализ комментариев | ✅ ДА (channel_ai_comment_insights) | ✅ Готово |
| **hooks** | ❌ НЕТ | Не генерируется | ❌ НЕТ | ❌ Требуется |
| **structure / outline** | ❌ НЕТ | Не генерируется | ❌ НЕТ | ❌ Требуется |

---

## 3. ГРУППИРОВКА ДАННЫХ ПО ТИПАМ

### 3.1. Уже хранятся в БД и готовы к использованию
- **Базовые метаданные видео**: title, viewCount, likeCount, commentCount, publishedAt
- **Данные канала**: channelTitle, channelHandle, subscriberCount, videoCount
- **AI аналитика канала**: summary, strengths, weaknesses, opportunities, threats, recommendations (ai_insights)
- **Трендовая аналитика**: themes, formats, recommendations (trending_insights)
- **Аналитика комментариев**: audience insights, sentiment analysis (channel_ai_comment_insights)
- **Ключевые слова**: keywords/tags (video_details.keywordsJson)

### 3.2. Приходят из API и записываются в БД
- Все данные из ScrapeCreators API (каналы, видео, детали видео, комментарии)
- keywords/tags в формате JSON
- Короткая транскрипция (transcriptShort)

### 3.3. Приходят из API, но НЕ сохраняются
- Полное описание видео (description)
- Полная транскрипция
- Детальная информация о канале (помимо базовых метрик)

### 3.4. Генерируются GPT, но НЕ сохраняются отдельно для видео
- Summary отдельных видео (только для каналов)
- Hooks для сценариев
- Структура/outline сценариев
- Анализ форматов успешных видео

---

## 4. ДАННЫЕ ДЛЯ ИДЕАЛЬНОГО СЦЕНАРНОГО ПРОМПТА

### 4.1. ✅ Идеально подходят для сценариев
1. **title + momentumScore** - понимание "выстреливающих" тем
2. **themes + formats из trending_insights** - определение трендов
3. **audience insights из комментариев** - понимание боли аудитории
4. **keywords/tags** - тематический анализ
5. **viewCount + viewsPerDay** - оценка виральности
6. **AI анализ канала** - сильные/слабые стороны, рекомендации

### 4.2. ⚠️ Требуют доработки/догенерации
1. **Описание видео (description)** - нужно получать и сохранять
2. **Hooks** - нужно генерировать на основе анализа успешных видео
3. **Структура сценариев** - нужно анализировать успешные форматы
4. **Анализ форматов** - длительность, стиль, структура успешных видео

### 4.3. ❌ Отсутствуют полностью
1. **Готовые hooks для сценариев**
2. **Шаблоны структуры успешных видео**
3. **Анализ стилистики и тональности**

---

## 5. РЕКОМЕНДАЦИИ ПО ИСПОЛЬЗОВАНИЮ ДАННЫХ

### 5.1. Для текущего сценарного генератора (/api/scripts/generate)
**Использовать:**
- title + momentumScore для отбора видео
- themes/formats из trending_insights для трендов
- keywords для тематической точности
- audience insights для понимания аудитории

**Дополнить:**
- Генерацией hooks на основе успешных title
- Анализом структуры успешных видео
- Использованием transcriptShort для контент-анализа

### 5.2. Для улучшения системы
1. **Добавить сохранение description** из ScrapeCreators API
2. **Реализовать генерацию hooks** на основе AI-анализа успешных видео
3. **Создать анализ форматов** (длительность, структура, стиль)
4. **Сохранять AI-анализ отдельных видео** (не только каналов)

### 5.3. Структура идеального промпта для GPT
```
1. КОНТЕКСТ:
   - Трендовые темы: [themes из trending_insights]
   - Популярные форматы: [formats из trending_insights]
   - Аудитория: [insights из комментариев]

2. ДАННЫЕ ВИДЕО:
   - Заголовки: [title + momentumScore]
   - Ключевые слова: [keywords/tags]
   - Метрики: [viewCount, viewsPerDay, engagement]

3. ЗАДАЧА:
   - Сгенерировать hooks на основе успешных паттернов
   - Предложить структуру на основе популярных форматов
   - Учесть боли аудитории из комментариев
```

---

## 6. ВЫВОДЫ

### 6.1. Сильные стороны текущей системы
- Полная интеграция с ScrapeCreators API
- Богатая AI-аналитика (каналы, комментарии, тренды)
- Расчет momentum и виральных метрик
- Структурированное хранение в БД

### 6.2. Слабые стороны для сценарной генерации
- Отсутствие hooks и структурных шаблонов
- Неполные данные о форматах видео
- Отсутствие анализа description
- Нет AI-анализа отдельных видео (только каналов)

### 6.3. Приоритетные улучшения
1. **Высокий приоритет**: Генерация hooks на основе AI
2. **Высокий приоритет**: Анализ форматов успешных видео
3. **Средний приоритет**: Сохранение description
4. **Низкий приоритет**: Полная транскрипция

---

## 7. ТЕХНИЧЕСКИЕ ДЕТАЛИ

### 7.1. API эндпоинты для данных
- `/api/trending/insights` - трендовая аналитика
- `/api/channel/[id]/comments/ai` - анализ комментариев
- `/api/channel/[id]/summary` - анализ канала
- `/api/scripts/generate` - текущий генератор сценариев

### 7.2. Таблицы БД для сценарных данных
- `trending_insights` - themes, formats, recommendations
- `channel_ai_comment_insights` - audience insights, sentiments
- `ai_insights` - канальный анализ (SWOT)
- `video_details` - keywords, transcriptShort

### 7.3. Ключевые файлы кода
- `src/lib/momentum-queries.ts` - расчет momentum, viewsPerDay
- `src/lib/ai/analyzeChannel.ts` - AI анализ каналов
- `src/lib/ai/comments-analysis.ts` - AI анализ комментариев
- `src/app/api/scripts/generate/route.ts` - текущий генератор

---

**Аудит выполнен:** Полный анализ данных для генерации сценариев YouTube
**Статус:** Готово к использованию с рекомендациями по улучшению
**Следующие шаги:** Реализация генерации hooks и анализа форматов
