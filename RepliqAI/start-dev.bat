@echo off
REM ============================================================
REM   LibreChat - DEV MODE (with hot reload)
REM ============================================================
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   LibreChat - DEVELOPMENT MODE
echo   Backend + Frontend with HOT RELOAD
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
    echo [!] ВНИМАНИЕ: Отредактируй .env и заполни MONGO_URI!
    echo.
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
REM 3. Проверяем node_modules
REM ============================================================
if not exist "node_modules" (
    echo.
    echo [*] Устанавливаю зависимости...
    call npm install
    if errorlevel 1 (
        echo [!] Ошибка при установке зависимостей!
        pause
        exit /b 1
    )
    echo [+] Зависимости установлены!
)

REM ============================================================
REM 4. Проверяем пакеты
REM ============================================================
if not exist "node_modules/@librechat/api/dist/index.js" (
    echo.
    echo [*] Собираю пакеты...
    call npm run build:packages
    if errorlevel 1 (
        echo [!] Ошибка при сборке пакетов!
        pause
        exit /b 1
    )
    echo [+] Пакеты собраны!
)

REM ============================================================
REM 5. Добавляем SEARCH=false в .env если нет
REM ============================================================
findstr /c:"SEARCH=" .env > nul 2>&1
if errorlevel 1 (
    echo SEARCH=false >> .env
    echo [*] Добавлено SEARCH=false в .env
)

REM ============================================================
REM 6. ГОТОВО - Запускаем BACKEND и FRONTEND в отдельных окнах
REM ============================================================
echo.
echo [+] Все проверки пройдены!
echo.
echo ============================================================
echo   ЗАПУСКАЮ:
echo   - Backend: http://localhost:3080 (с горячей перезагрузкой)
echo   - Frontend: src/* (с горячей перезагрузкой)
echo.
echo   Для остановки: закройте оба окна или нажмите Ctrl+C
echo ============================================================
echo.

REM Запускаем Backend в отдельном окне
start "LibreChat Backend (Dev)" cmd /k npm run backend:dev

REM Небольшая задержка чтобы backend запустился
timeout /t 3 /nobreak

REM Запускаем Frontend в отдельном окне
start "LibreChat Frontend (Dev)" cmd /k npm run frontend:dev

REM Информационное сообщение
echo.
echo [OK] Оба сервера должны запуститься в отдельных окнах!
echo.
echo Backend должен быть на: http://localhost:3080
echo Frontend dev server на: http://localhost:5173 (если используется Vite)
echo.
echo Если видите ошибки - проверьте:
echo 1. MONGO_URI заполнена в .env
echo 2. npm install выполнена
echo 3. Нет других процессов на портах 3080 и 5173
echo.
pause
