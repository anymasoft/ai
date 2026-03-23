@echo off
REM Setup script для Windows

echo.
echo 🚀 dbgis Backend - Quick Setup (Windows)
echo ==========================================
echo.

REM Проверка Python
echo ✓ Проверка Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python не найден. Установите Python 3.10+ с python.org
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo   Python версия: %PYTHON_VERSION%

REM Создание виртуального окружения
echo.
echo ✓ Создание виртуального окружения...
if not exist "venv" (
    python -m venv venv
    echo   ✓ venv создан
) else (
    echo   ✓ venv уже существует
)

REM Активация виртуального окружения
call venv\Scripts\activate.bat
echo   ✓ venv активирован

REM Установка зависимостей
echo.
echo ✓ Установка зависимостей...
python -m pip install --upgrade pip setuptools wheel >nul 2>&1
pip install -r requirements.txt >nul 2>&1
echo   ✓ Зависимости установлены

REM Создание .env файла
echo.
echo ✓ Конфигурация .env...
if not exist ".env" (
    copy .env.example .env >nul
    echo   ✓ Создан .env (отредактируйте параметры подключения)
    echo.
    echo   ⚠️  Внимание: отредактируйте .env с вашими параметрами PostgreSQL:
    echo      - DB_HOST
    echo      - DB_NAME
    echo      - DB_USER
    echo      - DB_PASSWORD
) else (
    echo   ✓ .env уже существует
)

REM Проверка подключения к PostgreSQL
echo.
echo ✓ Проверка PostgreSQL...
python -c "import psycopg2, os; from dotenv import load_dotenv; load_dotenv(); psycopg2.connect(host=os.getenv('DB_HOST'), database=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD')); print('  ✓ PostgreSQL доступна')" 2>nul || (
    echo   ⚠️  Ошибка подключения к PostgreSQL
    echo      Убедитесь, что PostgreSQL запущена и параметры в .env корректны
)

echo.
echo ✅ Setup завершён!
echo.
echo 📝 Следующие шаги:
echo   1. Отредактируйте .env (если ещё не сделали)
echo   2. Создайте БД: psql -U postgres -f schema.sql
echo   3. Миграция (опционально): python migrate_sqlite_to_postgres.py
echo   4. Запуск: python main.py
echo.
echo 🌐 Откройте: http://localhost:8000
echo.

pause
