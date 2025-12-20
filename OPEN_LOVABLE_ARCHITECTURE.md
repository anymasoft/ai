# Open Lovable - Архитектура и структура проекта

Документация по структуре и компонентам проекта Open Lovable.

## Обзор

**Open Lovable** - это Next.js приложение, которое позволяет создавать полнофункциональные React приложения через интерфейс чата с AI. Пользователь описывает, что он хочет, а AI автоматически генерирует React код, устанавливает зависимости и запускает приложение в облачном sandbox.

## Основная архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                     ПОЛЬЗОВАТЕЛЬСКИЙ ИНТЕРФЕЙС              │
│              (React компоненты + Tailwind CSS)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                    API МАРШРУТЫ (Next.js)                   │
│  /apply-ai-code-stream  - генерация кода с помощью AI      │
│  /analyze-edit-intent   - анализ намерений пользователя    │
│  /create-ai-sandbox     - создание изолированной среды     │
│  /sandbox-status        - статус и логи sandbox            │
│  /install-packages      - установка npm пакетов           │
│  /scrape-screenshot     - скрепинг веб-страниц (Firecrawl) │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐        ┌─────────┐        ┌─────────┐
   │   AI    │        │ SANDBOX │        │ FIRECRAWL
   │PROVIDER │        │ PROVIDER│        │ (WebScraping)
   │         │        │         │        │
   │OpenAI  │        │Vercel  │        │Web parsing
   │Claude  │        │E2B     │        │API extraction
   │Gemini  │        │        │        │
   │Groq    │        │        │        │
   └─────────┘        └─────────┘        └─────────┘
```

## Структура директорий

### `/app` - Next.js приложение

```
app/
├── api/                           # API маршруты
│   ├── apply-ai-code-stream/     # Основной поток генерации кода
│   ├── analyze-edit-intent/      # Анализ намерений пользователя
│   ├── create-ai-sandbox/        # Создание sandbox окружения
│   ├── restart-vite/             # Перезагрузка dev сервера
│   ├── run-command/              # Выполнение команд в sandbox
│   ├── install-packages/         # Установка NPM пакетов
│   ├── sandbox-status/           # Получение статуса sandbox
│   ├── sandbox-logs/             # Логи выполнения
│   ├── scrape-screenshot/        # Скрепинг веб-страниц
│   └── conversation-state/       # Управление состоянием диалога
├── layout.tsx                    # Root layout
├── page.tsx                      # Главная страница
└── landing.tsx                   # Лэндинг страница
```

### `/lib` - Утилиты и логика

```
lib/
├── ai/
│   └── provider-manager.ts       # Управление AI провайдерами
├── sandbox/                      # Логика sandbox
│   └── sandbox-manager.ts        # Управление песочницей
├── edit-intent-analyzer.ts       # Анализ типов изменений
├── context-selector.ts           # Выбор контекста для AI
├── file-parser.ts                # Парсинг файлов
├── file-search-executor.ts       # Поиск в файлах
├── morph-fast-apply.ts           # Быстрое применение изменений
└── build-validator.ts            # Валидация сборки
```

### `/components` - React компоненты

```
components/
├── Chat/                         # Компоненты чата
│   ├── ChatInterface/           # Интерфейс чата
│   └── MessageRenderer/         # Отрисовка сообщений
├── Editor/                       # Компоненты редактора
├── Preview/                      # Превью приложения
├── Sidebar/                      # Боковая панель
└── ...другие компоненты         # UI элементы
```

### `/config` - Конфигурация

```
config/
└── app.config.ts                # Главная конфигурация приложения
                                 # - Модели AI
                                 # - Параметры sandbox
                                 # - Настройки UI
```

## Ключевые компоненты

### 1. AI Provider Manager (`lib/ai/provider-manager.ts`)

Управляет различными AI провайдерами:

- **OpenAI** - GPT-5, GPT-4o и другие модели
- **Anthropic** - Claude серия
- **Google** - Gemini
- **Groq** - Kimi K2 и другие

```typescript
// Использование
const { client, actualModel } = getProviderForModel('openai/gpt-5');
```

### 2. Sandbox Manager (`lib/sandbox/sandbox-manager.ts`)

Управляет изолированным окружением:

- **Vercel Sandbox** - облачный sandbox с Node.js
- **E2B** - альтернативный sandbox провайдер

Sandbox используется для:
- Установки NPM пакетов
- Выполнения команд сборки
- Запуска dev сервера

### 3. Code Generation API (`app/api/apply-ai-code-stream/route.ts`)

Основной endpoint для генерации кода:

1. Принимает пользовательский запрос и контекст
2. Отправляет на выбранный AI провайдер
3. Парсит ответ AI
4. Применяет изменения в sandbox
5. Возвращает результаты в реальном времени (streaming)

### 4. Edit Intent Analyzer (`lib/edit-intent-analyzer.ts`)

Анализирует тип изменения:

- **Create** - создание новых файлов
- **Update** - обновление существующих файлов
- **Delete** - удаление файлов
- **Refactor** - рефакторинг кода

## Поток выполнения (Flow)

```
1. Пользователь пишет сообщение в чат
                    ↓
2. Frontend отправляет на /apply-ai-code-stream
                    ↓
3. API анализирует контекст и интент
                    ↓
4. Формируется промпт для AI
                    ↓
5. Запрос отправляется на выбранный AI провайдер
                    ↓
6. Получается ответ с кодом
                    ↓
7. Код парсится и валидируется
                    ↓
8. Файлы применяются в sandbox
                    ↓
9. Устанавливаются необходимые пакеты
                    ↓
10. Dev сервер перезагружается
                    ↓
11. Результат возвращается пользователю (streaming)
```

## Конфигурация (app.config.ts)

### Доступные модели

```typescript
availableModels: [
  'openai/gpt-5',                              // Рекомендуется
  'anthropic/claude-sonnet-4-20250514',
  'google/gemini-3-pro-preview',
  'moonshotai/kimi-k2-instruct-0905'
]
```

### Sandbox провайдеры

```typescript
// Vercel Sandbox (по умолчанию)
SANDBOX_PROVIDER=vercel
VERCEL_OIDC_TOKEN=auto_generated_by_vercel_env_pull

// E2B (альтернатива)
SANDBOX_PROVIDER=e2b
E2B_API_KEY=your_e2b_api_key
```

## Переменные окружения

### Обязательные

```env
FIRECRAWL_API_KEY          # Для веб-скрепинга
SANDBOX_PROVIDER           # vercel или e2b
```

### AI провайдеры (выберите хотя бы один)

```env
OPENAI_API_KEY             # OpenAI GPT модели
ANTHROPIC_API_KEY          # Claude модели
GEMINI_API_KEY             # Google Gemini
GROQ_API_KEY               # Groq/Kimi модели
```

### Vercel (для sandbox)

```env
# Метод 1: OIDC (рекомендуется)
VERCEL_OIDC_TOKEN          # Автоматически из vercel env pull

# Метод 2: Personal Access Token
VERCEL_TEAM_ID             # ID вашей команды
VERCEL_PROJECT_ID          # ID проекта
VERCEL_TOKEN               # Personal access token
```

## Типы данных

### ConversationState

```typescript
interface ConversationState {
  messages: Message[];
  selectedModel: string;
  sandboxState: SandboxState;
  context?: CodeContext;
}
```

### ParsedResponse

```typescript
interface ParsedResponse {
  explanation: string;
  template: string;
  files: Array<{ path: string; content: string }>;
  packages: string[];
  commands: string[];
  structure: string | null;
}
```

## Примеры использования

### Создание todo приложения

```
Пользователь: "Создай todo лист с сохранением в localStorage"
                    ↓
AI генерирует React компонент с Tailwind стилями
                    ↓
Sandbox устанавливает зависимости
                    ↓
App запускается и показывается в preview
```

### Изменение существующего кода

```
Пользователь: "Добавь тёмную тему"
                    ↓
Analyzer определяет, что это update
                    ↓
AI анализирует текущий код
                    ↓
Генерируется код с dark mode
                    ↓
Файлы обновляются, приложение перезагружается
```

## Производительность

- **Streaming** - ответы приходят в реальном времени
- **Кеширование** - кешируются провайдеры и результаты
- **Оптимизация контекста** - отправляется только необходимый код

## Расширения (Extensions)

Проект поддерживает расширения для браузера:

```
extension_new/                 # Новая версия расширения
└── manifest.json
```

Расширение позволяет использовать Open Lovable на любых сайтах.

## Развертывание

Проект можно развернуть на:

- **Vercel** - собственный хостинг Vercel
- **Docker** - в контейнере
- **Локально** - для разработки

## Связанные файлы

- `QUICKSTART_OPEN_LOVABLE_OPENAI.md` - быстрый старт с OpenAI
- `config/app.config.ts` - конфигурация приложения
- `lib/ai/provider-manager.ts` - управление AI провайдерами
- `app/api/apply-ai-code-stream/route.ts` - основной API endpoint
