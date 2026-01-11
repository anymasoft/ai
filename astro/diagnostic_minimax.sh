#!/bin/bash

# ДИАГНОСТИЧЕСКИЙ СКРИПТ для MiniMax callback integration
# Проверяет каждый аспект callback-точки

echo "=========================================="
echo "ДИАГНОСТИКА: MiniMax Callback Integration"
echo "=========================================="
echo ""

# КОНФИГУРАЦИЯ
BASE_URL="${MINIMAX_CALLBACK_URL:-http://localhost:3000}"
CALLBACK_URL="${BASE_URL}/minimax_callback"

echo "[1/5] ПРОВЕРКА КОНФИГУРАЦИИ"
echo "------"
echo "BASE_URL: $BASE_URL"
echo "CALLBACK_URL: $CALLBACK_URL"
echo ""

# ТЕСТ 1: Проверка доступности сервера
echo "[2/5] ПРОВЕРКА ДОСТУПНОСТИ СЕРВЕРА"
echo "------"
echo "Пытаюсь подключиться к $BASE_URL..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
    echo "✅ Сервер доступен"
else
    echo "❌ ОШИБКА: Сервер НЕ доступен на $BASE_URL"
    echo "   Убедитесь, что:"
    echo "   1. npm run dev запущен"
    echo "   2. ngrok/туннель активен (если используется)"
    echo ""
    exit 1
fi
echo ""

# ТЕСТ 2: Проверка endpoint'а - обычный GET
echo "[3/5] ПРОВЕРКА ENDPOINT'а (HEAD запрос)"
echo "------"
HEAD_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X HEAD "$CALLBACK_URL")
echo "HEAD $CALLBACK_URL"
echo "Статус: $HEAD_RESPONSE"
if [ "$HEAD_RESPONSE" = "405" ] || [ "$HEAD_RESPONSE" = "404" ]; then
    echo "⚠️  ВНИМАНИЕ: Endpoint вернул $HEAD_RESPONSE (это ОК для HEAD, но проверим POST)"
else
    echo "ℹ️  Статус HEAD: $HEAD_RESPONSE"
fi
echo ""

# ТЕСТ 3: Challenge verification - главный тест
echo "[4/5] ПРОВЕРКА CHALLENGE VERIFICATION (главный тест)"
echo "------"

# Mock challenge от MiniMax
CHALLENGE_VALUE="test_challenge_12345"
CHALLENGE_PAYLOAD=$(cat <<EOF
{
  "challenge": "$CHALLENGE_VALUE"
}
EOF
)

echo "Отправляю challenge-запрос..."
echo "POST $CALLBACK_URL"
echo "Payload: $CHALLENGE_PAYLOAD"
echo ""

RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$CHALLENGE_PAYLOAD" \
    "$CALLBACK_URL")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$CHALLENGE_PAYLOAD" \
    "$CALLBACK_URL")

echo "HTTP Статус: $HTTP_CODE"
echo "Response: $RESPONSE"
echo ""

# Проверяем ответ
if echo "$RESPONSE" | grep -q "\"challenge\""; then
    echo "✅ PASS: Challenge verification работает"
    echo "   Endpoint вернул challenge в JSON"
else
    if [ "$HTTP_CODE" = "404" ]; then
        echo "❌ КРИТИЧЕСКАЯ ОШИБКА: Endpoint НЕ найден (404)"
        echo "   Проблема: /minimax_callback маршрут не существует"
        echo "   Решение: Проверьте /src/pages/minimax_callback.ts"
    elif [ "$HTTP_CODE" = "500" ]; then
        echo "❌ ОШИБКА: Server error (500)"
        echo "   Проблема: Обработчик выбрасывает исключение"
        echo "   Проверьте логи сервера"
    elif [ "$HTTP_CODE" = "405" ]; then
        echo "❌ ОШИБКА: Method Not Allowed (405)"
        echo "   Проблема: POST не разрешен на endpoint'е"
    else
        echo "⚠️  ВНИМАНИЕ: Unexpected статус $HTTP_CODE"
        echo "   Response: $RESPONSE"
    fi
fi
echo ""

# ТЕСТ 4: Проверка Content-Type
echo "[5/5] ПРОВЕРКА HEADERS И CONTENT-TYPE"
echo "------"

HEADERS=$(curl -s -i -X POST \
    -H "Content-Type: application/json" \
    -d "$CHALLENGE_PAYLOAD" \
    "$CALLBACK_URL" 2>&1 | head -20)

echo "Response Headers:"
echo "$HEADERS"
echo ""

if echo "$HEADERS" | grep -i "content-type.*json"; then
    echo "✅ PASS: Content-Type = application/json"
else
    echo "⚠️  ВНИМАНИЕ: Content-Type НЕ application/json"
fi

echo ""
echo "=========================================="
echo "ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "=========================================="
echo ""
echo "ИНТЕРПРЕТАЦИЯ:"
echo "- Если все тесты PASS: проблема в ngrok URL или firewall"
echo "- Если 404: endpoint не существует"
echo "- Если 500: ошибка в коде обработчика"
echo "- Если 405: POST не разрешен"
echo ""
echo "СЛЕДУЮЩИЙ ШАГ:"
echo "1. Если все тесты прошли - проверьте ngrok URL в MINIMAX_CALLBACK_URL"
echo "2. Если endpoint не найден - проверьте /src/pages/minimax_callback.ts"
echo "3. Если ошибки - проверьте логи сервера: npm run dev"
echo ""
