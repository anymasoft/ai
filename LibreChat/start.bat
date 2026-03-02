@echo off
REM ============================================================
REM   LibreChat - Универсальный запуск (одна команда для всего)
REM ============================================================
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   LibreChat - запуск
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
    echo     - API ключи для моделей
    echo.
    pause
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
)

REM ============================================================
REM 5. Проверяем пакеты (@librechat/api, @librechat/data-schemas)
REM ============================================================
if not exist "node_modules/@librechat/api/dist/index.js" (
    echo.
    echo [*] Первый запуск: собираю пакеты...
    echo [*] Это займет 2-3 минуты, подождите...
    echo.
    call npm run build:packages
    if errorlevel 1 (
        echo.
        echo [!] Ошибка при сборке пакетов!
        echo [!] Попробуй: npm install
        pause
        exit /b 1
    )
    echo.
    echo [+] Пакеты собраны!
)

REM ============================================================
REM 6. Проверяем фронтенд (клиент)
REM ============================================================
if not exist "client\dist\index.html" (
    echo.
    echo [*] Первый запуск: собираю фронтенд...
    echo [*] Это займет 3-5 минут, подождите...
    echo.
    call npm run build:client
    if errorlevel 1 (
        echo.
        echo [!] Ошибка при сборке фронтенда!
        echo [!] Попробуй: npm install
        pause
        exit /b 1
    )
    echo.
    echo [+] Фронтенд собран!
)

REM ============================================================
REM 7. Запускаем сервер
REM ============================================================
echo.
echo [+] Все проверки пройдены! Запускаю сервер...
echo.
echo ============================================================
echo   Сервер запущен: http://localhost:3080
echo   Для остановки: закрой это окно или нажми Ctrl+C
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

pause
