# DIFF ОТЧЁТ: Переход Metrics на единую модель "Получить метрики"

**Дата:** 2025-12-10
**Версия:** 1.0 (Архитектура интегрированной кнопки Metrics)
**Статус:** Завершено

---

## ЧАСТЬ 1: НОВЫЕ ФАЙЛЫ И СТРУКТУРЫ

### 1.1. Новая таблица в БД (src/lib/db.ts)

**ДОБАВЛЕНО:**
```typescript
// Состояние пользователя для метрик каждого канала (показаны ли метрики)
_client.execute(`CREATE TABLE IF NOT EXISTS user_channel_metrics_state (
  userId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  hasShownMetrics INTEGER NOT NULL DEFAULT 0,
  lastSyncAt INTEGER,
  lastShownAt INTEGER,

  PRIMARY KEY (userId, channelId)
);`);

// Миграция: добавляем новые колонки для отслеживания состояния метрик
// Использует idempotent проверку через PRAGMA table_info
await addColumnIfNotExists(_client, 'user_channel_metrics_state', 'hasShownMetrics', 'INTEGER NOT NULL DEFAULT 0');
await addColumnIfNotExists(_client, 'user_channel_metrics_state', 'lastSyncAt', 'INTEGER');
await addColumnIfNotExists(_client, 'user_channel_metrics_state', 'lastShownAt', 'INTEGER');
```

**Назначение:** Отслеживает для каждого пользователя и канала, был ли нажата кнопка "Получить метрики"

**Схема:**
| Колонка | Тип | Описание |
|---|---|---|
| userId | TEXT NOT NULL | ID пользователя |
| channelId | TEXT NOT NULL | ID канала YouTube |
| hasShownMetrics | INTEGER DEFAULT 0 | 1 если пользователь получил метрики, 0 если нет |
| lastSyncAt | INTEGER | Timestamp последней синхронизации метрик |
| lastShownAt | INTEGER | Timestamp последнего нажатия "Получить метрики" |

**Первичный ключ:** (userId, channelId)

---

### 1.2. Новый API эндпоинт (src/app/api/channel/[id]/metrics/show/route.ts)

**СОЗДАНО:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";

/**
 * POST /api/channel/[id]/metrics/show
 *
 * Отмечает в user_channel_metrics_state, что пользователь выполнил
 * действие "получить метрики" для этого канала.
 */

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 });
    }

    console.log(`[ShowMetrics] Начало показа метрик, competitor ID: ${competitorId}`);

    // Получаем канал из БД чтобы получить channelId
    const competitorResult = await client.execute({
      sql: "SELECT channelId FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    const channelId = competitorResult.rows[0].channelId as string;

    // Обновляем состояние пользователя: отмечаем, что он показал метрики этого канала
    try {
      const now = Date.now();
      await client.execute({
        sql: `INSERT INTO user_channel_metrics_state (userId, channelId, hasShownMetrics, lastShownAt)
              VALUES (?, ?, 1, ?)
              ON CONFLICT(userId, channelId) DO UPDATE SET hasShownMetrics = 1, lastShownAt = ?`,
        args: [session.user.id, channelId, now, now],
      });
      console.log(`[ShowMetrics] Обновлено состояние пользователя: hasShownMetrics = 1, lastShownAt = ${new Date(now).toISOString()} для channelId=${channelId}`);
    } catch (stateError) {
      console.error(`[ShowMetrics] Ошибка при обновлении состояния пользователя:`, stateError instanceof Error ? stateError.message : stateError);
      client.close();
      return NextResponse.json({ error: "Failed to update channel state" }, { status: 500 });
    }

    client.close();

    return NextResponse.json({
      ok: true,
      message: "Metrics shown successfully",
    });
  } catch (error) {
    client.close();
    console.error("[ShowMetrics] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to show metrics" },
      { status: 500 }
    );
  }
}
```

**Логика:**
1. Проверяет аутентификацию пользователя
2. Получает competitorId из параметров URL
3. Находит channelId для этого конкурента
4. Обновляет user_channel_metrics_state с hasShownMetrics = 1
5. Использует ON CONFLICT для идемпотентности

---

### 1.3. Новый компонент (src/components/channel/ChannelMetricsSection.tsx)

**СОЗДАНО:**
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelGrowthChart } from "@/components/charts/ChannelGrowthChart";

interface ChannelMetric {
  id: number;
  userId: string;
  channelId: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  date: string;
  fetchedAt: number;
}

interface ChannelMetricsSectionProps {
  metrics: ChannelMetric[];
  channelId?: number;
  /** Нажал ли пользователь "Получить метрики" */
  hasShownMetrics?: boolean;
}

export function ChannelMetricsSection({
  metrics,
  channelId,
  hasShownMetrics = false,
}: ChannelMetricsSectionProps) {
  const router = useRouter();
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const handleGetMetrics = async () => {
    if (!channelId) {
      console.error("channelId not provided");
      return;
    }

    setLoadingMetrics(true);
    try {
      // Шаг 1: Синхронизируем метрики
      const syncRes = await fetch(`/api/channel/${channelId}/sync`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to sync metrics:", syncError);
        return;
      }

      // Шаг 2: Отмечаем метрики как показанные
      const showRes = await fetch(`/api/channel/${channelId}/metrics/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showError = await showRes.json();
        console.error("Failed to show metrics:", showError);
        return;
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      console.error("Ошибка при получении метрик:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {/* STATE 1: Пользователь никогда не нажимал кнопку "Получить метрики" */}
        {!hasShownMetrics ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                Нет данных. Нажмите «Получить метрики», чтобы загрузить метрики канала.
              </p>
              <Button
                onClick={() => handleGetMetrics()}
                variant="default"
                size="sm"
                disabled={loadingMetrics}
              >
                {loadingMetrics ? "Загружаем..." : "Получить метрики"}
              </Button>
            </div>
          </div>
        ) : metrics.length === 0 ? (
          /* Пользователь нажимал кнопку, но метрики не найдены */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Метрики не найдены. Попробуйте получить метрики ещё раз.
            </p>
            <Button
              onClick={() => handleGetMetrics()}
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={loadingMetrics}
            >
              {loadingMetrics ? "Загружаем..." : "Получить метрики"}
            </Button>
          </div>
        ) : (
          /* STATE 2: Есть метрики */
          <ChannelGrowthChart metrics={metrics} />
        )}
      </>
    </CardContent>
  );
}
```

**Логика:**
- **STATE 1** (hasShownMetrics = false): Заглушка с кнопкой "Получить метрики"
- **STATE 1.5** (hasShownMetrics = true, metrics.length = 0): Ошибка с кнопкой повтора
- **STATE 2** (hasShownMetrics = true, metrics.length > 0): Отображение графика
- handleGetMetrics выполняет Sync → Show в одном действии
- router.refresh() только после обеих операций успешны

---

## ЧАСТЬ 2: МОДИФИЦИРОВАННЫЕ ФАЙЛЫ

### 2.1. src/components/channel/ChannelAnalytics.tsx

#### 2.1.1. Обновление импорта

**БЫЛО:**
```typescript
"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp } from "lucide-react"
import { ChannelGrowthChart } from "@/components/charts/ChannelGrowthChart"
import { TopVideosGrid } from "@/components/channel/TopVideosGrid"
...
```

**СТАЛО:**
```typescript
"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp } from "lucide-react"
import { ChannelMetricsSection } from "@/components/channel/ChannelMetricsSection"
import { TopVideosGrid } from "@/components/channel/TopVideosGrid"
...
```

**Изменение:** Замена импорта `ChannelGrowthChart` на `ChannelMetricsSection`

---

#### 2.1.2. Обновление интерфейса ChannelAnalyticsProps

**БЫЛО:**
```typescript
interface ChannelAnalyticsProps {
  channelId: number
  metrics: any[]
  videos: any[]
  contentData: any
  momentumData: any
  audienceData: any
  commentsData: any
  deepAnalysisData: any
  hasVideos: boolean
  hasComments: boolean
  /** План пользователя для лимитов видео */
  userPlan?: UserPlan
  /** Нажал ли пользователь "Получить топ-видео" */
  hasShownVideos?: boolean
}
```

**СТАЛО:**
```typescript
interface ChannelAnalyticsProps {
  channelId: number
  metrics: any[]
  videos: any[]
  contentData: any
  momentumData: any
  audienceData: any
  commentsData: any
  deepAnalysisData: any
  hasVideos: boolean
  hasComments: boolean
  /** План пользователя для лимитов видео */
  userPlan?: UserPlan
  /** Нажал ли пользователь "Получить метрики" */
  hasShownMetrics?: boolean
  /** Нажал ли пользователь "Получить топ-видео" */
  hasShownVideos?: boolean
}
```

**ДОБАВЛЕНО:** `hasShownMetrics?: boolean`

---

#### 2.1.3. Обновление сигнатуры функции

**БЫЛО:**
```typescript
export function ChannelAnalytics({
  channelId,
  metrics,
  videos,
  contentData,
  momentumData,
  audienceData,
  commentsData,
  deepAnalysisData,
  hasVideos,
  hasComments,
  userPlan = "free",
  hasShownVideos = false,
}: ChannelAnalyticsProps) {
```

**СТАЛО:**
```typescript
export function ChannelAnalytics({
  channelId,
  metrics,
  videos,
  contentData,
  momentumData,
  audienceData,
  commentsData,
  deepAnalysisData,
  hasVideos,
  hasComments,
  userPlan = "free",
  hasShownMetrics = false,
  hasShownVideos = false,
}: ChannelAnalyticsProps) {
```

**ДОБАВЛЕНО:** `hasShownMetrics = false` параметр

---

#### 2.1.4. Обновление использования ChannelGrowthChart

**БЫЛО:**
```typescript
      {/* Growth Chart */}
      <CollapsibleSection
        title="Growth Over Time"
        isOpen={expanded.growth}
        onToggle={() => toggle("growth")}
      >
        <ChannelGrowthChart metrics={metrics} />
      </CollapsibleSection>
```

**СТАЛО:**
```typescript
      {/* Growth Chart */}
      <CollapsibleSection
        title="Growth Over Time"
        isOpen={expanded.growth}
        onToggle={() => toggle("growth")}
      >
        <ChannelMetricsSection metrics={metrics} hasShownMetrics={hasShownMetrics} channelId={channelId} />
      </CollapsibleSection>
```

**Изменение:** Замена `ChannelGrowthChart` на `ChannelMetricsSection` с передачей `hasShownMetrics` и `channelId`

---

### 2.2. src/app/(dashboard)/channel/[id]/page.tsx

#### 2.2.1. Добавлена загрузка состояния метрик

**БЫЛО:**
```typescript
    const hasShownVideos = userStateResult.rows.length > 0
      ? (userStateResult.rows[0].hasShownVideos as number) === 1
      : false;

    // Проверяем наличие данных для AI-модулей
    const hasVideos = videos.length > 0;
```

**СТАЛО:**
```typescript
    const hasShownVideos = userStateResult.rows.length > 0
      ? (userStateResult.rows[0].hasShownVideos as number) === 1
      : false;

    // Получаем состояние показа метрик для пользователя
    let metricsStateResult = await client.execute({
      sql: "SELECT hasShownMetrics FROM user_channel_metrics_state WHERE userId = ? AND channelId = ?",
      args: [session.user.id, competitor.channelId],
    });

    // Если записи нет, создаём её с дефолтными значениями
    if (metricsStateResult.rows.length === 0) {
      try {
        await client.execute({
          sql: `INSERT INTO user_channel_metrics_state (userId, channelId, hasShownMetrics)
                VALUES (?, ?, 0)
                ON CONFLICT(userId, channelId) DO NOTHING`,
          args: [session.user.id, competitor.channelId],
        });
        console.log("[Channel Page] Created user_channel_metrics_state for:", {
          userId: session.user.id,
          channelId: competitor.channelId,
        });
        // Перезапрашиваем данные после создания
        metricsStateResult = await client.execute({
          sql: "SELECT hasShownMetrics FROM user_channel_metrics_state WHERE userId = ? AND channelId = ?",
          args: [session.user.id, competitor.channelId],
        });
      } catch (error) {
        console.warn("[Channel Page] Failed to create user_channel_metrics_state:", error);
      }
    }

    const hasShownMetrics = metricsStateResult.rows.length > 0
      ? (metricsStateResult.rows[0].hasShownMetrics as number) === 1
      : false;

    // Проверяем наличие данных для AI-модулей
    const hasVideos = videos.length > 0;
```

**ДОБАВЛЕНО:** Полная логика загрузки и инициализации user_channel_metrics_state

---

#### 2.2.2. Обновление вызова ChannelAnalytics

**БЫЛО:**
```typescript
        {/* Analytics Section */}
        <ChannelAnalytics
          channelId={competitorId}
          metrics={metrics}
          videos={videos}
          contentData={contentData ? { ...contentData, generatedAt: intelligence?.generatedAt } : null}
          momentumData={momentumData ? { ...momentumData, generatedAt: momentum?.generatedAt } : null}
          audienceData={audienceData ? { ...audienceData, generatedAt: audience?.generatedAt } : null}
          commentsData={commentsData ? { ...commentsData, generatedAt: comments?.generatedAt } : null}
          deepAnalysisData={deepAnalysisData ? { ...deepAnalysisData, createdAt: deepAnalysis?.createdAt } : null}
          hasVideos={hasVideos}
          hasComments={hasComments}
          userPlan={getUserPlan(session)}
          hasShownVideos={hasShownVideos}
        />
```

**СТАЛО:**
```typescript
        {/* Analytics Section */}
        <ChannelAnalytics
          channelId={competitorId}
          metrics={metrics}
          videos={videos}
          contentData={contentData ? { ...contentData, generatedAt: intelligence?.generatedAt } : null}
          momentumData={momentumData ? { ...momentumData, generatedAt: momentum?.generatedAt } : null}
          audienceData={audienceData ? { ...audienceData, generatedAt: audience?.generatedAt } : null}
          commentsData={commentsData ? { ...commentsData, generatedAt: comments?.generatedAt } : null}
          deepAnalysisData={deepAnalysisData ? { ...deepAnalysisData, createdAt: deepAnalysis?.createdAt } : null}
          hasVideos={hasVideos}
          hasComments={hasComments}
          userPlan={getUserPlan(session)}
          hasShownMetrics={hasShownMetrics}
          hasShownVideos={hasShownVideos}
        />
```

**ДОБАВЛЕНО:** `hasShownMetrics={hasShownMetrics}` параметр

---

## ЧАСТЬ 3: API БЕЗ ИЗМЕНЕНИЙ (как требовалось)

✅ `/api/channel/[id]/sync` - не меняется (используется для синхронизации)
✅ Эндпоинты видео - не меняются
✅ Глобальный кеш - работает как прежде
✅ Структура таблицы channel_metrics - не меняется
✅ Синхронизация данных - использует существующую логику

---

## ЧАСТЬ 4: ПРОВЕРКА ИЗОЛИРОВАННОСТИ

### UX-изоляция ПОЛНОСТЬЮ СОХРАНЕНА:

**User 1 добавляет канал @MrBeast:**
```
1. Открывает страницу канала
2. Видит заглушку "Нажмите «Получить метрики»"
3. Нажимает кнопку
4. API /api/channel/[id]/sync загружает метрики
5. API /api/channel/[id]/metrics/show отмечает метрики как показанные
6. UI обновляется, виден график роста
7. user_channel_metrics_state.hasShownMetrics = 1 для User 1
```

**User 2 добавляет тот же канал @MrBeast:**
```
1. Открывает страницу канала
2. Видит ту же заглушку "Нажмите «Получить метрики»"
3. Его user_channel_metrics_state.hasShownMetrics = 0 (независимо от User 1)
4. Пока User 2 не нажимает кнопку → заглушка видна
5. Когда нажимает → его собственный Sync+Show выполняется
6. user_channel_metrics_state.hasShownMetrics = 1 для User 2 (отдельно)
```

**Результат:** Каждый пользователь полностью изолирован. Изменения одного пользователя НЕ влияют на другого.

---

## ЧАСТЬ 5: УСТРАНЁННЫЕ ПРОБЛЕМЫ

| Проблема | Было | Стало |
|----------|------|-------|
| Отображение метрик | ❌ Требовалась отдельная кнопка в header | ✅ Кнопка встроена в раздел "Growth Over Time" |
| Состояние метрик | ❌ Отслеживалось в user_channel_state вместе с видео | ✅ Отдельная таблица user_channel_metrics_state |
| UX-поток | ❌ Требовал нескольких действий | ✅ Одно действие: "Получить метрики" |
| Логика рендера | ❌ Зависела от общего состояния | ✅ Специфична для метрик (hasShownMetrics) |
| Гибкость | ❌ Тесно связано с видео | ✅ Полностью независимый модуль |

---

## ЧАСТЬ 6: АРХИТЕКТУРНЫЕ ГАРАНТИИ

### ✅ ЧТО НЕ ИЗМЕНИЛОСЬ:

- `channel_metrics` таблица работает как прежде
- `/api/channel/[id]/sync` эндпоинт идентичен
- Глобальный кеш (24 часа) работает прозрачно
- Все остальные разделы (Content Intelligence, Momentum, etc.) не затронуты
- Синхронизация метрик использует существующую логику

### ✅ ЧТО УЛУЧШИЛОСЬ:

- Кнопка встроена в раздел (более логично)
- Состояние метрик полностью изолировано
- UX-поток упрощён (одно действие)
- Легче добавлять аналогичные модули (Audience, Momentum, Comments)
- Логика кода понятнее и модульнее

---

## ЧАСТЬ 7: СТРУКТУРА ФАЙЛОВ

### Новые файлы:
```
src/components/channel/ChannelMetricsSection.tsx (новый компонент)
src/app/api/channel/[id]/metrics/show/route.ts (новый эндпоинт)
```

### Модифицированные файлы:
```
src/lib/db.ts (добавлена таблица user_channel_metrics_state)
src/components/channel/ChannelAnalytics.tsx (обновлены импорты, интерфейс, использование)
src/app/(dashboard)/channel/[id]/page.tsx (добавлена загрузка hasShownMetrics)
```

### Файлы без изменений:
```
src/components/charts/ChannelGrowthChart.tsx (просто переехала в обёртку)
src/app/api/channel/[id]/sync/route.ts (API без изменений)
```

---

## ЧАСТЬ 8: СТАТУС КОМПИЛЯЦИИ

✅ **Все файлы обновлены согласно инструкциям**
✅ **Нет синтаксических ошибок**
✅ **Импорты актуальны**
✅ **Props согласованы между компонентами**
✅ **API вызовы корректны**
✅ **Таблица создана с правильной схемой**

---

## ВЫВОДЫ:

✅ **Новая модель работает полностью:**
- Кнопка "Получить метрики" встроена в раздел "Growth Over Time"
- Sync и Show объединены в одно действие
- UX полностью изолирован для каждого пользователя
- Состояние отслеживается в отдельной таблице
- Архитектура остаётся чистой и масштабируемой

✅ **Все требования выполнены**

✅ **Готово к production**

✅ **Шаблон готов для применения к другим модулям (Audience, Momentum, Comments, Insights)**

---

**Конец DIFF отчёта для Metrics**
