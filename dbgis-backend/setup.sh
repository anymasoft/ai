#!/bin/bash
# Setup script для быстрого старта dbgis backend на Linux/macOS

set -e

echo "🚀 dbgis Backend — Quick Setup"
echo "================================"

# Проверка Python
echo "✓ Проверка Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 не найден. Установите Python 3.10+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo "  Python версия: $PYTHON_VERSION"

# Создание виртуального окружения
echo ""
echo "✓ Создание виртуального окружения..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  ✓ venv создан"
else
    echo "  ✓ venv уже существует"
fi

# Активация виртуального окружения
source venv/bin/activate
echo "  ✓ venv активирован"

# Установка зависимостей
echo ""
echo "✓ Установка зависимостей..."
pip install --upgrade pip setuptools wheel > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1
echo "  ✓ Зависимости установлены"

# Создание .env файла
echo ""
echo "✓ Конфигурация .env..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "  ✓ Создан .env (отредактируйте параметры подключения)"
    echo ""
    echo "  ⚠️  Внимание: отредактируйте .env с вашими параметрами PostgreSQL:"
    echo "     - DB_HOST"
    echo "     - DB_NAME"
    echo "     - DB_USER"
    echo "     - DB_PASSWORD"
else
    echo "  ✓ .env уже существует"
fi

# Проверка подключения к PostgreSQL
echo ""
echo "✓ Проверка PostgreSQL..."
python3 << 'EOF'
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

try:
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT")),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )
    print("  ✓ PostgreSQL доступна")
    conn.close()
except Exception as e:
    print(f"  ⚠️  Ошибка подключения: {e}")
    print("     Убедитесь, что PostgreSQL запущена и параметры в .env корректны")
    exit(1)
EOF

echo ""
echo "✅ Setup завершён!"
echo ""
echo "📝 Следующие шаги:"
echo "  1. Отредактируйте .env (если ещё не сделали)"
echo "  2. Создайте БД: psql -U postgres -f schema.sql"
echo "  3. Миграция (опционально): python migrate_sqlite_to_postgres.py"
echo "  4. Запуск: python main.py"
echo ""
echo "🌐 Откройте: http://localhost:8000"
echo ""
