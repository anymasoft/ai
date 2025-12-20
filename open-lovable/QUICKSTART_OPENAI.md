# Open Lovable - Быстрый старт с OpenAI

Минимальная инструкция для запуска проекта с использованием только OpenAI.

## Требуемые ключи API

- **OpenAI API Key** → https://platform.openai.com/api-keys
- **Firecrawl API Key** → https://firecrawl.dev (для веб-скрепинга)
- **Vercel Token** (для sandbox) → https://vercel.com/account/tokens

## Установка

```bash
# 1. Клонировать и установить зависимости
git clone https://github.com/firecrawl/open-lovable.git
cd open-lovable
pnpm install  # или npm install / yarn install
```

## Конфигурация

```bash
# 2. Создать файл .env.local
cat > .env.local << 'EOF'
# Обязательно
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# AI Provider (OpenAI)
OPENAI_API_KEY=your_openai_api_key_here

# Sandbox Provider (Vercel)
SANDBOX_PROVIDER=vercel
VERCEL_OIDC_TOKEN=auto_generated_by_vercel_env_pull

# Альтернативно для Vercel (если OIDC не работает):
# VERCEL_TEAM_ID=team_xxxxxxxxx
# VERCEL_PROJECT_ID=prj_xxxxxxxxx
# VERCEL_TOKEN=vercel_xxxxxxxxxxxx
EOF
```

## Запуск

```bash
# 3. Запустить dev сервер
pnpm dev

# Откройте http://localhost:3000
```

## Получение VERCEL_OIDC_TOKEN

Если у вас есть Vercel CLI:

```bash
vercel link        # Связать проект с Vercel
vercel env pull    # Автоматически загрузить VERCEL_OIDC_TOKEN в .env.local
```

## Выбор модели в UI

При запуске приложения выберите **GPT-5** из списка моделей в интерфейсе.

## Всё!

Откройте http://localhost:3000 и начните писать инструкции AI для создания React приложений.
