# Переменные окружения (Environment Variables)

## Как настроить .env

Создай файл `.env.local` в корне проекта и добавь следующие переменные:

```bash
cp .env.example .env.local
```

## Обязательные переменные для MiniMax

### MINIMAX_API_KEY
- **Что это:** API ключ для работы с MiniMax API
- **Где получить:** https://www.minimaxi.com/
- **Пример:** `sk-api-2DXDu...`
- **Как использовать:**
  ```
  MINIMAX_API_KEY=sk-api-2DXDu...
  ```

### MINIMAX_CALLBACK_URL
- **Что это:** URL, на который MiniMax отправляет результат генерации видео
- **Формат:** `https://yourdomain.com/api/minimax_callback`
- **Важно:**
  - Должен быть ПУБЛИЧНЫЙ URL (MiniMax должен иметь доступ)
  - При локальной разработке используй **ngrok** для туннелирования
  - Пример с ngrok: `https://12345abc.ngrok-free.app/api/minimax_callback`

**Как использовать ngrok:**
```bash
# 1. Установить ngrok (если не установлен)
brew install ngrok
# или скачать с https://ngrok.com/

# 2. Запустить ngrok на порту Astro (обычно 3000)
ngrok http 3000

# 3. Скопировать URL и добавить в .env.local
MINIMAX_CALLBACK_URL=https://12345abc.ngrok-free.app/api/minimax_callback
```

## Другие переменные

Остальные переменные (GOOGLE_CLIENT_ID, YOOKASSA_SHOP_ID и т.д.) требуются для других функций приложения, но НЕ обязательны для работы MiniMax интеграции.

## Проверка

Убедись, что переменные установлены правильно:

```bash
# При запуске сервера Astro, в логах должны быть:
[MINIMAX] API ключ установлен ✅
[CALLBACK] Готов получать webhook от MiniMax ✅
```

## Безопасность

- **НИКОГДА** не коммитй `.env.local` в репозиторий
- В продакшене используй переменные окружения хостинга (Vercel, Render и т.д.)
- API ключ - это конфиденциальная информация, защищай его!
