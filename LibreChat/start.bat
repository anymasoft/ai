@echo off
REM ============================================================
REM   LibreChat - Universal run
REM ============================================================
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   LibreChat - START!!!
echo ============================================================
echo.

REM ============================================================
REM 1. Проверяем .env
REM ============================================================
if not exist ".env" (
    echo [!] Файл .env не найден!
    echo [!] Копирую .env.example в .env...
    copy ".env.example" ".env" > nul
    if errorlevel 1 (
        echo [!] Ошибка при копировании .env.example
        pause
        exit /b 1
    )
    echo [+] .env создан
    echo [!] ВНИМАНИЕ: Отредактируй .env и заполни:
    echo     - MONGO_URI (адрес MongoDB)
    echo     - API keys for models
    echo.
)

REM ============================================================
REM 1.5 Проверяем что MONGO_URI заполнена
REM ============================================================
findstr /c:"MONGO_URI=mongodb+srv://" .env > nul 2>&1
if errorlevel 1 (
    echo.
    echo [!] ОШИБКА: MONGO_URI не заполнена или некорректная в .env!
    echo.
    echo Отредактируйте .env и вставьте ваш реальный MongoDB URI.
    echo Пример:
    echo   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=...
    echo.
    pause
    exit /b 1
)

REM ============================================================
REM 2. Создаём librechat.yaml если не существует
REM ============================================================
if not exist "librechat.yaml" (
    echo [*] Создаю librechat.yaml из примера...
    copy "librechat.example.yaml" "librechat.yaml" > nul
    echo [+] librechat.yaml создан
)

REM ============================================================
REM 3. Добавляем SEARCH=false в .env если нет
REM ============================================================
findstr /c:"SEARCH=" .env > nul 2>&1
if errorlevel 1 (
    echo SEARCH=false >> .env
    echo [*] Добавлено SEARCH=false в .env
)

REM ============================================================
REM 4. Проверяем node_modules (зависимости)
REM ============================================================
if not exist "node_modules" (
    echo.
    echo [*] Первый запуск: устанавливаю зависимости...
    echo [*] Это займет 2-3 минуты, подождите...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [!] Ошибка при установке зависимостей!
        pause
        exit /b 1
    )
    echo.
    echo [+] Зависимости установлены!
) else (
    echo [+] node_modules найдены
)

REM ============================================================
REM 5. Полная сборка ВСЕГО ПРОЕКТА (Turbo build)
REM ============================================================
echo.
echo [*] Собираю весь проект (пакеты, клиент, API)...
echo [*] Это займет 5-10 минут, подождите...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo [!] Ошибка при сборке проекта!
    echo [!] Попробуй: npm install && npm run build
    pause
    exit /b 1
)
echo.
echo [+] Проект полностью собран!
echo.

REM ============================================================
REM 6. Запускаем сервер
REM ============================================================
echo ============================================================
echo   [+] СЕРВЕР ЗАПУСКАЕТСЯ...
echo ============================================================
echo   📍 http://localhost:3080
echo   🛑 Для остановки: Ctrl+C
echo ============================================================
echo.

REM Запускаем с увеличенным heap для Node.js
call npm run backend:dev

REM Если сервер упал - показываем сообщение об ошибке
if errorlevel 1 (
    echo.
    echo [!] Сервер упал с ошибкой!
    echo.
    pause
    exit /b 1
)


