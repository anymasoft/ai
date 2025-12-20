# Open Lovable с OpenAI - Краткая инструкция запуска

Проект Open Lovable позволяет создавать React приложения через диалог с AI. Эта инструкция описывает минимальные шаги для запуска только с использованием OpenAI.

## Структура проекта

```
open-lovable/              # Next.js приложение для создания React приложений
├── app/                   # API routes и страницы
├── components/            # React компоненты
├── lib/ai/               # Логика работы с AI провайдерами
├── config/               # Конфигурация приложения
└── package.json          # Зависимости
```

## Требуемые API ключи

1. **OpenAI API Key** (ChatGPT) → https://platform.openai.com/api-keys
2. **Firecrawl API Key** (веб-скрепинг) → https://firecrawl.dev
3. **Vercel Token** (для запуска приложений) → https://vercel.com/account/tokens

## Установка (минимум)

```bash
cd open-lovable

# Установить зависимости
pnpm install
# или: npm install / yarn install
```

## Конфигурация

Создайте файл `.env.local`:

```bash
cat > .env.local << 'EOF'
# === ОБЯЗАТЕЛЬНО ===
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# === AI PROVIDER: OPENAI ===
OPENAI_API_KEY=your_openai_api_key_here

# === SANDBOX PROVIDER: VERCEL ===
SANDBOX_PROVIDER=vercel
VERCEL_OIDC_TOKEN=auto_generated_by_vercel_env_pull
EOF
```

### Получение VERCEL_OIDC_TOKEN

```bash
# Установите Vercel CLI: https://vercel.com/cli
vercel link        # Связать проект с Vercel
vercel env pull    # Загрузит VERCEL_OIDC_TOKEN автоматически
```

**Если OIDC не работает**, используйте Personal Access Token:

```bash
# Получите из https://vercel.com/account/tokens
VERCEL_TEAM_ID=team_xxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxx
VERCEL_TOKEN=vercel_xxxxxxxxxxxx
```

## Запуск

```bash
# Запустить dev сервер
pnpm dev
```

Откройте http://localhost:3000 в браузере.

## Использование

1. В интерфейсе приложения выберите модель **GPT-5** (OpenAI)
2. Напишите инструкцию для создания React приложения
3. AI создаст код, приложение запустится в sandbox

## Примеры команд

```
"Создай калькулятор с темной темой"
"Сделай todo лист с возможностью сохранения в localStorage"
"Напиши погодное приложение с поиском по городам"
```

## Конфигурация моделей

Доступные модели в `config/app.config.ts`:

- `openai/gpt-5` → OpenAI GPT-5 (рекомендуется)
- `openai/gpt-4o` → OpenAI GPT-4o
- `anthropic/claude-sonnet-4` → Claude Sonnet 4
- `google/gemini-3-pro` → Gemini 3 Pro

Модель по умолчанию можно изменить в `appConfig.ai.defaultModel`.

## Структура .env.local полностью

```env
# === ОБЯЗАТЕЛЬНО ===
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# === AI ПРОВАЙДЕР ===
# Выберите один из вариантов:
OPENAI_API_KEY=your_openai_key_here
# ANTHROPIC_API_KEY=your_anthropic_key_here
# GEMINI_API_KEY=your_gemini_key_here
# GROQ_API_KEY=your_groq_key_here

# === SANDBOX (Vercel) ===
SANDBOX_PROVIDER=vercel

# Метод 1: OIDC (рекомендуется)
VERCEL_OIDC_TOKEN=auto_generated_by_vercel_env_pull

# Метод 2: Personal Access Token (если OIDC не работает)
# VERCEL_TEAM_ID=team_xxxxxxxxx
# VERCEL_PROJECT_ID=prj_xxxxxxxxx
# VERCEL_TOKEN=vercel_xxxxxxxxxxxx

# === ОПЦИОНАЛЬНО ===
# MORPH_API_KEY=your_morphllm_key_here    # Для быстрых правок
```

## Готово!

Приложение запущено и готово к использованию с OpenAI для создания React приложений.
