# Production Deployment — MiniMax Webhooks

## ✅ Проблема решена

**Проблема:** Vite в dev режиме блокирует запросы с неправильным Host header
- Это ломает MiniMax callback verification
- Блокирует ngrok туннели
- Блокирует платежные webhooks

**Решение:** Использовать production build с Node.js

Production build Astro (через @astrojs/node adapter) **НЕ имеет Host check защиты**.
Это чистый Node.js сервер без Vite, поэтому принимает запросы с ЛЮБЫМ Host header.

---

## 🚀 Как запустить production

### Вариант 1: Через npm скрипт (рекомендуется)

```bash
# Собрать production build
npm run build

# Запустить production preview
npm run preview
```

Сервер запустится на http://localhost:4321

### Вариант 2: Запустить Node.js напрямую

```bash
# Собрать (если еще не собирали)
npm run build

# Запустить Node сервер
NODE_ENV=production node dist/server/entry.mjs
```

Сервер запустится на http://localhost:4321

### Вариант 3: Запустить с кастомным портом

```bash
# Production build
npm run build

# Запустить на порту 3000
PORT=3000 NODE_ENV=production node dist/server/entry.mjs
```

---

## ✅ Проверка что callback работает

Callback endpoint `/minimax_callback` теперь принимает запросы с ЛЮБЫМ Host header:

```bash
# Тест 1: localhost
curl -X POST http://localhost:4321/minimax_callback \
  -H "Host: localhost:4321" \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test1"}'
# Результат: {"challenge":"test1"}

# Тест 2: ngrok (внешний домен)
curl -X POST http://localhost:4321/minimax_callback \
  -H "Host: abc123.ngrok-free.app" \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test2"}'
# Результат: {"challenge":"test2"}

# Тест 3: MiniMax (внешний домен)
curl -X POST http://localhost:4321/minimax_callback \
  -H "Host: api.minimax.io" \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test3"}'
# Результат: {"challenge":"test3"}

# Тест 4: Произвольный домен
curl -X POST http://localhost:4321/minimax_callback \
  -H "Host: completely-random.domain.xyz" \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test4"}'
# Результат: {"challenge":"test4"}
```

Все тесты возвращают **HTTP 200 OK с JSON** - **БЕЗ БЛОКИРОВОК!**

---

## 📋 Конфигурация для production/staging

### .env для production

```bash
# Callback URL должен указывать на production домен
MINIMAX_CALLBACK_URL=https://yourdomain.com
# или для ngrok
MINIMAX_CALLBACK_URL=https://abc123.ngrok-free.app

# Остальные переменные...
DATABASE_URL=vr_ai.db
MINIMAX_API_KEY=your_key_here
```

### Команды для CI/CD

```bash
# Build
npm ci
npm run build

# Run
NODE_ENV=production node dist/server/entry.mjs
```

---

## 📊 Сравнение dev vs production

| Аспект | Dev (npm run dev) | Production (npm run build + node) |
|--------|-------------------|-----------------------------------|
| Host check | ✅ Включена (Vite защита) | ❌ Отключена (pure Node.js) |
| MiniMax callback | ❌ Блокирует 403 | ✅ Работает 200 OK |
| ngrok | ❌ Блокирует 403 | ✅ Работает 200 OK |
| Платежные webhooks | ❌ Блокирует 403 | ✅ Работает 200 OK |
| Скорость | Медленнее | ⚡ Быстрее |
| Размер | Большой | Оптимизирован |

---

## 🔧 Troubleshooting

### Сервер не запускается - "Port 4321 is already in use"

```bash
# Убить процесс на порту 4321
lsof -i :4321 | awk 'NR!=1 {print $2}' | xargs kill -9

# Или использовать другой порт
PORT=3000 npm run preview
```

### Ошибка "Cannot find module 'dist/server/entry.mjs'"

```bash
# Пересобрать build
npm run build

# Проверить что dist/ существует
ls -la dist/
```

### MiniMax всё ещё возвращает error 2013

1. Убедитесь что используете **production** build (не dev!)
2. Проверьте что `MINIMAX_CALLBACK_URL` в .env правильный
3. Убедитесь что процессор стартует: ищите логи `[PROCESSOR]` в консоли

---

## 📝 Итого

**Минимум для работы MiniMax callback:**

```bash
npm run build          # Собрать
npm run preview        # Запустить
# Callback готов к использованию
```

Никакие внешние сервисы (ngrok, MiniMax, платежи) больше не получат 403 Forbidden!
