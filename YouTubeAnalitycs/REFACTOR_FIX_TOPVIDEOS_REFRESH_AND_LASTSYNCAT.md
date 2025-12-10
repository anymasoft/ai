# REFACTOR: Исправление UI-обновления и проблемы NaN в lastSyncAt

**Дата:** 2025-12-10
**Статус:** Завершено
**Коммит:** b0cd48b

---

## Обзор

Исправлены две критические проблемы в системе синхронизации видео:

1. **UI не обновляется после первого получения видео** — требовалась F5
2. **lastSyncAt приводит к "NaN часов назад"** — проблема с форматом даты и кешированием

---

## Проблема 1: UI не обновляется после sync+show

### Симптом
- Пользователь нажимает "Получить топ-видео"
- Видео успешно синхронизируются (sync+show выполняются без ошибок)
- Но UI остаётся в STATE1 (пустое состояние с кнопкой)
- Только после F5 видео появляются на странице

### Корневая причина
1. **Недостаточно динамической генерации** — page.tsx не имел `export const dynamic = 'force-dynamic'`
   - Next.js по умолчанию кеширует server components
   - Даже если router.refresh() вызывается, cached page может не перегенерироваться

2. **TopVideosGrid полагается на пропсы** — компонент получает `hasShownVideos` и `videos` из page.tsx
   - После router.refresh() page перезагружается
   - Новые значения должны прийти в пропсы
   - Но если page кешировалась, пропсы не обновляются

### Решение

#### Файл 1: `src/app/(dashboard)/channel/[id]/page.tsx`

**Добавлено:**
```typescript
/**
 * Отключаем кеширование страницы канала.
 * Необходимо для корректной работы router.refresh() после синхронизации видео.
 * Без этого страница может быть закеширована, и router.refresh() не будет эффективен.
 */
export const dynamic = "force-dynamic";
```

**Почему это работает:**
- `force-dynamic` указывает Next.js НЕ кешировать эту страницу
- Каждый запрос (включая после router.refresh()) переходит на сервер
- Запрос читает актуальное значение `hasShownVideos` из БД
- Новое значение передаётся в пропсы TopVideosGrid
- UI перерисовывается автоматически

**Добавлено также:**
```typescript
// DEBUG: логируем состояние видео для отладки UI обновления
if (process.env.NODE_ENV === "development") {
  console.log(`[ChannelPage DEBUG] user_channel_state для userId=${session.user.id}, channelId=${competitor.channelId}:`, {
    hasSyncedTopVideos,
    hasShownVideos,
    totalVideos: videos.length,
    userStateRows: userStateResult.rows.length,
  });
}
```

---

## Проблема 2: lastSyncAt приводит к "NaN часов назад"

### Симптом
- После синхронизации видео в интерфейсе видно "NaN часов назад"
- Кэширование не работает (второй пользователь всегда жжёт API вместо использования кеша)
- Причина: при парсинге даты значение оказывается невалидным

### Корневая причина
1. **Неправильный формат даты** — записывалось `Date.now()` (число в миллисекундах)
   ```typescript
   // ДО (неправильно):
   const now = Date.now(); // 1702225800000
   args: [session.user.id, channelId, now, now] // число, не строка
   ```
   - Число миллисекунд не соответствует ISO 8601
   - При парсинге может интерпретироваться некорректно

2. **Несоответствие между записью и чтением**
   - Где-то в коде ожидается ISO-строка (`new Date().toISOString()`)
   - Но записывалось число
   - При парсинге: `new Date(number)` работает, но дальше вычисления могли быть неправильными

### Решение

#### Файл 2: `src/app/api/channel/[id]/videos/sync/route.ts`

**Было:**
```typescript
const now = Date.now();
await client.execute({
  sql: `INSERT INTO user_channel_state (userId, channelId, hasSyncedTopVideos, lastSyncAt)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(userId, channelId) DO UPDATE SET hasSyncedTopVideos = 1, lastSyncAt = ?`,
  args: [session.user.id, channelId, now, now],
});
console.log(`[Sync] ... lastSyncAt = ${new Date(now).toISOString()}`);
```

**Стало:**
```typescript
// ИСПРАВЛЕНИЕ: записываем lastSyncAt как ISO-строку (а не миллисекунды)
const lastSyncAtIso = new Date().toISOString();
await client.execute({
  sql: `INSERT INTO user_channel_state (userId, channelId, hasSyncedTopVideos, lastSyncAt)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(userId, channelId) DO UPDATE SET hasSyncedTopVideos = 1, lastSyncAt = ?`,
  args: [session.user.id, channelId, lastSyncAtIso, lastSyncAtIso],
});
console.log(`[Sync] Обновлено состояние пользователя: hasSyncedTopVideos = 1, lastSyncAt = ${lastSyncAtIso}`);
```

#### Файл 3: `src/app/api/channel/[id]/videos/show/route.ts`

**Было:**
```typescript
const now = Date.now();
await client.execute({
  sql: `INSERT INTO user_channel_state (userId, channelId, hasShownVideos, lastShownAt)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(userId, channelId) DO UPDATE SET hasShownVideos = 1, lastShownAt = ?`,
  args: [session.user.id, channelId, now, now],
});
```

**Стало:**
```typescript
// ИСПРАВЛЕНИЕ: записываем lastShownAt как ISO-строку (а не миллисекунды)
const lastShownAtIso = new Date().toISOString();
await client.execute({
  sql: `INSERT INTO user_channel_state (userId, channelId, hasShownVideos, lastShownAt)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(userId, channelId) DO UPDATE SET hasShownVideos = 1, lastShownAt = ?`,
  args: [session.user.id, channelId, lastShownAtIso, lastShownAtIso],
});
```

**Почему это работает:**
- ISO 8601 формат (`2025-12-10T15:30:45.123Z`) стандартизирован
- JavaScript `new Date(isoString)` парсит его корректно
- Вычисление "часов назад": `(Date.now() - new Date(isoString).getTime()) / 1000 / 3600` даёт правильное число

---

## Улучшения в логировании

### Файл 4: `src/components/channel/TopVideosGrid.tsx`

**Добавлено детальное логирование:**

1. **При загрузке компонента:**
```typescript
// DEBUG: логируем при изменении пропсов (особенно hasShownVideos)
if (process.env.NODE_ENV === "development") {
  console.log(`[TopVideosGrid DEBUG] props update: hasShownVideos=${hasShownVideos}, videosCount=${videos.length}, videoListCount=${videoList.length}`);
}
```

2. **В handleGetTopVideos():***
```typescript
console.log(`[TopVideosGrid] Начало получения топ-видео для channelId=${channelId}`);
// ... после sync
console.log(`[TopVideosGrid] Синхронизация успешна:`, {
  status: syncData.status,
  videosCount: syncData.videos?.length,
  totalVideos: syncData.totalVideos,
  added: syncData.added,
  updated: syncData.updated,
});
// ... после show
console.log(`[TopVideosGrid] Видео отмечены как показанные:`, showData);
// ... после refresh
console.log(`[TopVideosGrid] Шаг 3: Обновление UI через router.refresh()...`);
router.refresh();
console.log(`[TopVideosGrid] router.refresh() вызван успешно`);
```

**Преимущества:**
- Видно точное место где происходит задержка или ошибка
- Можно проверить, корректно ли работают API endpoints
- Видно, когда ровно вызывается router.refresh()

---

## Архитектура после исправлений

### Поток выполнения: handleGetTopVideos()

```
1. Пользователь нажимает "Получить топ-видео"
   ↓
2. Вызов POST /api/channel/[id]/videos/sync
   - Получение видео из API или кеша
   - Сохранение в channel_videos
   - Обновление: user_channel_state.lastSyncAt = ISO-строка
   ↓
3. Вызов POST /api/channel/[id]/videos/show
   - Обновление: user_channel_state.hasShownVideos = 1
   - Обновление: user_channel_state.lastShownAt = ISO-строка
   ↓
4. router.refresh()
   - page.tsx перезагружается (force-dynamic)
   - Запрос SELECT user_channel_state для актуального hasShownVideos
   ↓
5. Новые пропсы → TopVideosGrid
   - hasShownVideos = true
   - videos = <список из БД>
   ↓
6. TopVideosGrid перерисовывается
   - STATE1 → STATE2 (с видео)
   - Видео видны пользователю без F5
```

---

## Статистика изменений

```
4 файлов изменено, 51 строка добавлено, 10 строк удалено

 src/app/(dashboard)/channel/[id]/page.tsx      | 17 ++++++++++++
 src/app/api/channel/[id]/videos/show/route.ts  |  7 ++---
 src/app/api/channel/[id]/videos/sync/route.ts  |  7 ++---
 src/components/channel/TopVideosGrid.tsx       | 30 +++++++++++++++++++---
```

---

## Что БЫЛО СОХРАНЕНО (архитектура НЕ изменилась)

✅ Структура таблиц остаётся прежней
✅ API endpoints остаются теми же (sync + show)
✅ UX-модель STATE1/STATE2 не изменена
✅ Архитектура Sync+Show сохранена
✅ Имена полей в БД остаются прежними
✅ Логика кеширования не нарушена

---

## Ожидаемые эффекты после исправления

### Проблема 1: UI-обновление
- **До:** Требуется F5 для появления видео
- **После:** Видео появляются СРАЗУ после синхронизации

### Проблема 2: NaN и кеширование
- **До:** "NaN часов назад", кеш не работает
- **После:** Корректное отображение времени, кеш работает для второго пользователя

---

## Тестирование

### Тест 1: UI обновление
```
1. Открыть страницу канала
2. Нажать "Получить топ-видео"
3. Проверить консоль (должны быть DEBUG логи)
4. Видео должны появиться БЕЗ F5
```

### Тест 2: Формат даты
```
1. Открыть DevTools → Network
2. Посмотреть ответ POST /api/channel/[id]/videos/sync
3. Проверить в response: lastSyncAt должен быть ISO строка
   Пример: "2025-12-10T15:30:45.123Z"
4. В консоли должно быть логировано это значение
```

### Тест 3: Кеширование
```
1. Первый пользователь: нажимает "Получить топ-видео"
   - API вызывается к ScrapeCreators
2. Второй пользователь (через <24 часов): нажимает "Получить топ-видео"
   - Должен использоваться кеш (нет вызова к ScrapeCreators API)
   - В консоли: "[Sync] Кеш свежий ... используем кешированные данные"
```

---

## DEBUG команды для разработки

### Просмотр логов sync
```bash
# В консоли браузера (DevTools):
// Фильтр по [TopVideosGrid] и [ChannelPage DEBUG]
```

### Проверка структуры в БД
```sql
SELECT userId, channelId, hasSyncedTopVideos, hasShownVideos, lastSyncAt, lastShownAt
FROM user_channel_state
WHERE userId = ? AND channelId = ?;
```

Значения должны быть:
- `hasSyncedTopVideos`: 0 или 1
- `hasShownVideos`: 0 или 1
- `lastSyncAt`: "2025-12-10T15:30:45.123Z" (ISO-строка или NULL)
- `lastShownAt`: "2025-12-10T15:30:46.456Z" (ISO-строка или NULL)

---

## История версий

| Версия | Дата | Изменение |
|--------|------|-----------|
| 1.0 | 2025-12-10 | Исходное исправление UI и lastSyncAt |

---

## Следующие шаги

1. **Развернуть в dev** — проверить логи консоли
2. **Протестировать UI обновление** — должно работать без F5
3. **Проверить кеширование** — второй пользователь не должен жечь API
4. **Удалить DEBUG логи после тестирования** — если необходимо (можно оставить в development)

---

**Документировано:** 2025-12-10
**Подготовлено для:** Развёртывания и тестирования
