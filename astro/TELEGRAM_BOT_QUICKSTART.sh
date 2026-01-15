#!/bin/bash

# Beem Telegram Bot MVP - Быстрый запуск
# Запусти этот скрипт чтобы быстро начать работу

set -e

echo "🎬 Beem Video AI - Telegram Bot MVP"
echo "=================================="
echo ""

# Проверяем Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен"
    echo "   Скачай с https://nodejs.org/ (версия 20+)"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js: $NODE_VERSION"

# Переходим в папку астро
cd "$(dirname "$0")"

echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1️⃣  BACKEND SETUP (в первом терминале):"
echo "   cd astro"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "2️⃣  BOT SETUP (во втором терминале):"
echo "   cd bot"
echo "   npm install"
echo "   cp .env.example .env.local"
echo "   # Отредактируй .env.local и добавь TELEGRAM_BOT_TOKEN"
echo "   npm run dev"
echo ""
echo "3️⃣  ПОЛУЧИ TOKEN от @BotFather:"
echo "   - Открой https://t.me/botfather"
echo "   - Отправь /newbot"
echo "   - Следуй инструкциям"
echo "   - Скопируй токен в .env.local"
echo ""
echo "4️⃣  ТЕСТИРОВАНИЕ:"
echo "   - Открой своего бота в Telegram"
echo "   - Отправь /start"
echo "   - Загрузи фото"
echo "   - Напиши описание"
echo "   - Нажми 'Сгенерировать'"
echo "   - Жди видео (1-3 минуты)"
echo ""
echo "📖 Подробная документация:"
echo "   cat TELEGRAM_BOT_MVP.md"
echo ""
echo "❓ Проблемы?"
echo "   1. Проверь что Backend запущен"
echo "   2. Проверь токен Telegram в .env.local"
echo "   3. Посмотри логи обоих компонентов"
echo ""
