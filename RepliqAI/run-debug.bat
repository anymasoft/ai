@echo off
REM Debug запуск с полным логированием

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   LibreChat - DEBUG запуск
echo ============================================================
echo.

REM Запуск с максимальным логированием
set NODE_OPTIONS=--max-old-space-size=2048 --trace-uncaught --trace-warnings
set NODE_ENV=development

echo [DEBUG] NODE_OPTIONS: %NODE_OPTIONS%
echo [DEBUG] NODE_ENV: %NODE_ENV%
echo.

call npm run backend:dev

pause
