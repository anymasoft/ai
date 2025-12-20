# Open Lovable - Краткий справочник для разработчиков

## За 30 секунд

```bash
cd open-lovable
pnpm install
echo "OPENAI_API_KEY=sk-..." >> .env.local
echo "FIRECRAWL_API_KEY=..." >> .env.local
pnpm dev
# http://localhost:3000
```

## Команды

```bash
# Установка зависимостей
pnpm install

# Запуск в режиме разработки
pnpm dev          # Next.js server на http://localhost:3000

# Сборка для production
pnpm build

# Запуск production сборки
pnpm start

# Линтинг
pnpm lint

# Тесты
pnpm test:all     # Все тесты
pnpm test:api     # Тесты API
pnpm test:code    # Тесты генерации кода
```

## Основные файлы для редактирования

| Файл | Назначение |
|------|-----------|
| `config/app.config.ts` | Конфигурация моделей, sandbox, UI |
| `lib/ai/provider-manager.ts` | Логика подключения AI провайдеров |
| `lib/edit-intent-analyzer.ts` | Анализ типов изменений (create/update/delete) |
| `app/api/apply-ai-code-stream/route.ts` | Основной endpoint генерации кода |
| `app/page.tsx` | Главная страница приложения |

## Переменные окружения

```env
# === ОБЯЗАТЕЛЬНО ===
FIRECRAWL_API_KEY=fc_...                      # Веб-скрепинг
SANDBOX_PROVIDER=vercel                       # vercel или e2b

# === AI ПРОВАЙДЕРЫ (выберите 1+) ===
OPENAI_API_KEY=sk-...                         # OpenAI
ANTHROPIC_API_KEY=sk-ant-...                  # Claude
GEMINI_API_KEY=AIz...                         # Google
GROQ_API_KEY=gsk_...                          # Groq/Kimi

# === VERCEL SANDBOX ===
# Вариант 1: OIDC (рекомендуется)
VERCEL_OIDC_TOKEN=auto_generated

# Вариант 2: Personal Token
VERCEL_TEAM_ID=team_...
VERCEL_PROJECT_ID=prj_...
VERCEL_TOKEN=vercel_...

# === ОПЦИОНАЛЬНО ===
MORPH_API_KEY=...                             # Быстрые правки
AI_GATEWAY_API_KEY=...                        # Vercel AI Gateway
```

## Добавление новой AI модели

### 1. Добавить в конфигурацию

Файл: `config/app.config.ts`

```typescript
availableModels: [
  'openai/gpt-5',
  'your-provider/your-model'  // ← Новая модель
]
```

### 2. Добавить display name

```typescript
modelDisplayNames: {
  'your-provider/your-model': 'Your Model Display Name'
}
```

### 3. Добавить конфигурацию (если нужно)

```typescript
modelApiConfig: {
  'your-provider/your-model': {
    provider: 'your-provider',
    model: 'actual-model-name'
  }
}
```

### 4. Убедиться, что провайдер добавлен в provider-manager.ts

Файл: `lib/ai/provider-manager.ts`

```typescript
// Проверить, что провайдер обрабатывается в функции
function getOrCreateClient(provider: ProviderName, ...): ProviderClient {
  // Провайдер должен быть в switch-case
}
```

## Структура API endpoint

```typescript
// app/api/apply-ai-code-stream/route.ts

export async function POST(request: NextRequest) {
  // 1. Parse request
  const { messages, selectedModel, files } = await request.json();

  // 2. Get AI provider
  const { client, actualModel } = getProviderForModel(selectedModel);

  // 3. Build context and prompt
  const context = buildContext(files);

  // 4. Call AI with streaming
  const response = await generateStreamingResponse(
    client,
    actualModel,
    messages,
    context
  );

  // 5. Parse and apply changes
  const parsed = parseAIResponse(response);
  const result = await applyCodesToSandbox(parsed);

  // 6. Return stream
  return streamResponse(result);
}
```

## Типичные типы ошибок

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `OPENAI_API_KEY is undefined` | API ключ не задан | Добавить в `.env.local` |
| `FIRECRAWL_API_KEY is undefined` | API ключ Firecrawl не задан | Получить с https://firecrawl.dev |
| `VERCEL_OIDC_TOKEN undefined` | Vercel токен не загружен | Запустить `vercel env pull` |
| `Sandbox timeout` | Слишком долгая операция | Увеличить `timeoutMinutes` в config |
| `npm install failed` | Конфликт зависимостей | Добавить `useLegacyPeerDeps: true` |

## Отладка

### Включить логирование

Файл: `config/app.config.ts`

```typescript
dev: {
  enableDebugLogging: true,
  logApiResponses: true,
}
```

### Проверить статус sandbox

API: `GET /api/sandbox-status`

```bash
curl http://localhost:3000/api/sandbox-status
```

### Просмотреть логи sandbox

API: `GET /api/sandbox-logs`

```bash
curl http://localhost:3000/api/sandbox-logs
```

### Просмотреть файлы в sandbox

API: `GET /api/get-sandbox-files`

```bash
curl http://localhost:3000/api/get-sandbox-files
```

## Поддерживаемые фреймворки

Open Lovable поддерживает создание приложений с:

- **React** (основное)
- **Next.js** (для SSR/SSG)
- **Tailwind CSS** (стилизация)
- **TypeScript** (опционально)
- **Любые NPM пакеты** (по запросу AI)

## Лучшие практики

### 1. Используйте GPT-5 для сложных задач

```typescript
// config/app.config.ts
defaultModel: 'openai/gpt-5'
```

### 2. Ограничивайте контекст для больших проектов

```typescript
maxRecentMessagesContext: 20,  // Последние 20 сообщений
```

### 3. Используйте Vercel OIDC для безопасности

```env
# Вместо этого:
VERCEL_TOKEN=vercel_xxx

# Используйте:
VERCEL_OIDC_TOKEN=auto_generated_by_vercel_env_pull
```

### 4. Протестируйте локально перед deploy

```bash
pnpm dev
# Полностью протестируйте функциональность
pnpm build
# Убедитесь что сборка успешна
```

## Расширения и плагины

### Browser Extension

```
extension_new/             # Новая версия расширения
├── manifest.json         # Конфигурация расширения
├── popup.html           # UI расширения
├── background.js        # Логика расширения
└── content.js           # Скрипт на странице
```

Установка в Chrome:
1. `chrome://extensions/`
2. Enable "Developer mode"
3. Load unpacked → выберите `extension_new/`

## Производительность

| Параметр | Значение | Описание |
|----------|----------|----------|
| `defaultRefreshDelay` | 2000ms | Задержка перед обновлением UI |
| `packageInstallRefreshDelay` | 5000ms | Задержка после установки пакетов |
| `devServerStartupDelay` | 7000ms | Время запуска dev сервера |
| `maxTokens` | 8000 | Максимум токенов для генерации |

## Полезные ссылки

- [Open Lovable GitHub](https://github.com/firecrawl/open-lovable)
- [Lovable.dev](https://lovable.dev/) - облачная версия
- [Firecrawl Docs](https://firecrawl.dev)
- [Vercel Sandbox](https://vercel.com/docs/sdk)
- [Next.js Docs](https://nextjs.org)

## Поддержка провайдеров

✅ **OpenAI** - полная поддержка (GPT-4o, GPT-5)
✅ **Anthropic** - полная поддержка (Claude)
✅ **Google** - полная поддержка (Gemini)
✅ **Groq** - полная поддержка (Kimi K2)
✅ **Vercel AI Gateway** - полная поддержка

## Версионирование

- Node.js: >= 18
- Next.js: 15.4.3
- React: 19.1.0
- TypeScript: 5.x

---

**Статус:** Актуально на 2025-12-20
**Версия:** Open Lovable v0.1.0
