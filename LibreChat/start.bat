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

echo [1/2] Запускаю Backend в новом окне...
start "LibreChat Backend" cmd /k "npm run backend:dev"

echo [2/2] Жду 3 секунды пока стартует backend...
timeout /t 3 /nobreak > nul

echo [3/3] Запускаю Frontend...
echo.
echo ============================================
echo   Открой браузер: http://localhost:3080
echo ============================================
echo.
npm run frontend:dev
