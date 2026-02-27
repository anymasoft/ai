@echo off
echo ============================================
echo   LibreChat - запуск
echo ============================================
echo.

:: Проверяем .env
if not exist ".env" (
    echo [!] Файл .env не найден!
    echo [!] Скопируй .env.example в .env и заполни MONGO_URI и API ключи
    pause
    exit /b 1
)

:: Создаём librechat.yaml из примера если не существует
if not exist "librechat.yaml" (
    echo [*] Создаю librechat.yaml из примера...
    copy "librechat.example.yaml" "librechat.yaml" > nul
    echo [+] librechat.yaml создан
)

:: Добавляем SEARCH=false если ещё нет (MeiliSearch не нужен)
findstr /c:"SEARCH=" .env > nul 2>&1
if errorlevel 1 (
    echo SEARCH=false >> .env
    echo [*] Добавлено SEARCH=false в .env
)

:: Собираем фронтенд если ещё не собран (занимает 3-7 минут, только первый раз)
if not exist "client\dist\index.html" (
    echo.
    echo [*] Первый запуск: собираю frontend...
    echo [*] Это займет 3-7 минут, подождите...
    echo.
    call npm run frontend
    if errorlevel 1 (
        echo.
        echo [!] Ошибка при сборке frontend!
        echo [!] Попробуй: npm install
        pause
        exit /b 1
    )
    echo.
    echo [+] Frontend собран успешно!
)

echo.
echo [*] Запускаю сервер...
echo.
echo ============================================
echo   Откроется на: http://localhost:3080
echo   Для остановки закрой это окно
echo ============================================
echo.

npm run backend:dev
