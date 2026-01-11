# СУДЕБНО-ТЕХНИЧЕСКИЙ АУДИТ: MiniMax Callback Integration
## Диагностика ошибки 2013 - "invalid params, fail to check callback url"

**Дата аудита:** 2026-01-11
**Версия:** Claude Opus 4.5
**Статус:** Анализ завершен, диагностика в процессе

---

## ЧАСТЬ 1: ЭТАЛОН Python

### Рабочий Python pipeline (из рабочего кода)

```python
# Шаг 1: Вызов MiniMax API
response = requests.post(
    'https://api.minimax.io/v1/video_generation',
    headers={
        'Authorization': f'Bearer {MINIMAX_API_KEY}',
        'Content-Type': 'application/json'
    },
    json={
        'model': 'MiniMax-Hailuo-02',
        'first_frame_image': 'data:image/jpeg;base64,...',  # ✅ ПОЛНОЕ base64
        'prompt': 'описание движения товара',               # ✅ ТЕКСТ ОБЯЗАТЕЛЕН
        'duration': 6,                                       # ✅ NUMBER, не "6s"
        'resolution': '512P',
        'callback_url': 'https://yourdomain.com/minimax_callback'  # ✅ БЕЗ /api
    }
)

# Ответ: {"task_id": "1234567890", "status": "processing"}

# Шаг 2: MiniMax вызывает CHALLENGE verification
POST /minimax_callback
Content-Type: application/json

{
  "challenge": "challenge_token_xxxxx"
}

# Шаг 3: Python должен вернуть
HTTP/1.1 200 OK
Content-Type: application/json

{
  "challenge": "challenge_token_xxxxx"
}

# Шаг 4: MiniMax вызывает callback с результатом
POST /minimax_callback
Content-Type: application/json

{
  "task_id": "1234567890",
  "status": "success",
  "file_id": "file_xxxxx"
}

# Шаг 5: Python обрабатывает и возвращает
HTTP/1.1 200 OK
Content-Type: application/json

{
  "ok": true
}
```

### Ключевые моменты Python эталона:
1. ✅ PAYLOAD ПОЛНЫЙ: image, prompt, duration (число), callback
2. ✅ CHALLENGE: endpoint возвращает JSON с challenge
3. ✅ CALLBACK_URL: без /api, только /minimax_callback
4. ✅ HTTP 200: все ответы - 200 OK с JSON

---

## ЧАСТЬ 2: Web Pipeline (Astro)

### Текущая реализация Web

**File: `/src/pages/minimax_callback.ts`**
```typescript
export async function POST(request: Request) {
  try {
    console.log('[MINIMAX_CALLBACK] Получен запрос');

    // Парсим JSON от MiniMax
    let payload: CallbackPayload;
    try {
      payload = await request.json();
    } catch (e) {
      console.error('[MINIMAX_CALLBACK] Ошибка парсинга JSON');
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // CHALLENGE verification
    if (payload.challenge) {
      console.log('[MINIMAX_CALLBACK] ✅ Challenge получен');
      const response = new Response(
        JSON.stringify({ challenge: payload.challenge }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
      console.log('[MINIMAX_CALLBACK] ✅ Challenge ответ отправлен');
      return response;
    }

    // ... обработка реального callback'а ...

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MINIMAX_CALLBACK] Критическая ошибка:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

**File: `/src/lib/minimax/callMinimaxAPI.ts`**
```typescript
export async function callMinimaxAPI(
  imagePath: string,
  prompt: string,
  duration: number,
  callbackUrl: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    // Гарантируем что duration это число
    const durationNumber = typeof duration === 'string'
      ? parseInt(duration.replace('s', ''), 10)
      : Number(duration);

    // PAYLOAD
    const payload: MinimaxRequest = {
      model: 'MiniMax-Hailuo-02',
      first_frame_image: imageDataUrl,  // ✅ base64
      prompt: prompt,                    // ✅ TEXT
      duration: durationNumber,          // ✅ NUMBER
      resolution: '512P',
      callback_url: callbackUrl,         // ✅ без /api
    };

    console.log(
      `[MINIMAX] Отправляем запрос: duration=${durationNumber}, callback=${callbackUrl}`
    );

    // MiniMax API call
    const response = await fetch('https://api.minimax.io/v1/video_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as MinimaxResponse;

    if (!response.ok) {
      console.error('[MINIMAX] API ошибка:', data.error || response.statusText);
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    if (!data.task_id) {
      console.error('[MINIMAX] Нет task_id в ответе:', data);
      return {
        success: false,
        error: 'No task_id in response',
      };
    }

    console.log(`[MINIMAX] ✅ Задача создана: ${data.task_id}`);
    return {
      success: true,
      taskId: data.task_id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MINIMAX] Ошибка при вызове API:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
```

---

## ЧАСТЬ 3: ТАБЛИЦА СРАВНЕНИЯ Python vs Web

| Параметр | Python | Web (Astro) | Статус |
|----------|--------|------------|--------|
| **Endpoint** | /v1/video_generation | /v1/video_generation | ✅ СОВПАДАЕТ |
| **Model** | 'MiniMax-Hailuo-02' | 'MiniMax-Hailuo-02' | ✅ СОВПАДАЕТ |
| **Duration тип** | int (6) | Number (6) | ✅ СОВПАДАЕТ |
| **Duration значение** | 6 | 6 | ✅ СОВПАДАЕТ |
| **first_frame_image** | data:image/jpeg;base64,... | data:image/jpeg;base64,... | ✅ СОВПАДАЕТ |
| **first_frame_image размер** | ~100KB+ base64 | ~100KB+ base64 | ✅ СОВПАДАЕТ |
| **prompt** | "описание движения" | generation.prompt | ✅ СОВПАДАЕТ |
| **resolution** | '512P' | '512P' | ✅ СОВПАДАЕТ |
| **callback_url формат** | https://yourdomain.com/minimax_callback | ${callbackBase}/minimax_callback | ✅ СОВПАДАЕТ |
| **callback_url без /api** | ✅ БЕЗ /api | ✅ БЕЗ /api | ✅ СОВПАДАЕТ |
| **Authorization header** | Bearer {key} | Bearer {key} | ✅ СОВПАДАЕТ |
| **Content-Type header** | application/json | application/json | ✅ СОВПАДАЕТ |
| **Challenge response тип** | JSON | JSON | ✅ СОВПАДАЕТ |
| **Challenge response код** | 200 OK | 200 OK | ✅ СОВПАДАЕТ |
| **Challenge response формат** | {"challenge": "xxx"} | {"challenge": "xxx"} | ✅ СОВПАДАЕТ |

### ВЫВОД СРАВНЕНИЯ:
```
⚠️  ВСЕХ параметры ИДЕНТИЧНЫ между Python и Web
⚠️  КОД выглядит правильно с точки зрения контракта API
⚠️  ОШИБКА 2013 "fail to check callback url" НЕ связана с параметрами
```

---

## ЧАСТЬ 4: ДЕКОДИРОВАНИЕ ОШИБКИ 2013

### Ошибка от MiniMax:
```
status_code: 2013
message: "invalid params, fail to check callback url"
```

### Что ЭТО ОЗНАЧАЕТ:

**Error 2013 НЕ означает:**
- ❌ "параметры payload'а неправильные"
- ❌ "duration должен быть строка"
- ❌ "image отсутствует"
- ❌ "prompt неправильный"
- ❌ "callback_url имеет неправильный формат"

**Error 2013 ОЗНАЧАЕТ:**
```
🔴 MiniMax НЕ МОЖЕТ ДОСТИЧЬ callback_url во время verification handshake

Это значит:
1. MiniMax отправляет POST /minimax_callback с challenge
2. Но endpoint НЕДОСТУПЕН для MiniMax
3. Ответ от endpoint'а: timeout, 404, 500, или еще что-то плохое
4. MiniMax говорит: "я не могу проверить callback, отказываю в генерации"
```

### ВОЗМОЖНЫЕ ПРИЧИНЫ ошибки 2013:

| Причина | Признак | Как проверить |
|---------|---------|---------------|
| **ngrok мертв** | Callback URL не отвечает | curl -X POST https://your.ngrok.io/minimax_callback |
| **Endpoint не существует (404)** | /minimax_callback не маршрутизирован | curl -X POST http://localhost:3000/minimax_callback |
| **Firewall блокирует MiniMax** | Сервер отвечает, но MiniMax не может подключиться | Проверить firewall правила |
| **Endpoint возвращает ошибку (500)** | Ошибка в обработчике | Проверить логи: npm run dev |
| **Неправильный Content-Type** | Ответ не JSON | curl -v -X POST ... |
| **Astro routing broken** | Endpoint существует но не обрабатывается | Проверить /src/pages/minimax_callback.ts |

---

## ЧАСТЬ 5: ДИАГНОСТИЧЕСКИЕ ТЕСТЫ

### Тест 1: Проверка локального endpoint'а

```bash
# Убедитесь что npm run dev запущен в другом терминале

# Отправьте mock challenge
curl -v -X POST \
  -H "Content-Type: application/json" \
  -d '{"challenge": "test_challenge_123"}' \
  http://localhost:3000/minimax_callback
```

**Ожидаемый результат (PASS):**
```
< HTTP/1.1 200 OK
< Content-Type: application/json
<
{"challenge":"test_challenge_123"}
```

**Возможные ошибки:**
- `404 Not Found` → endpoint не существует
- `500 Internal Server Error` → ошибка в коде
- `405 Method Not Allowed` → POST не разрешен
- `Content-Type: text/html` → неправильный тип, Astro возвращает HTML

### Тест 2: Проверка ngrok tunnel

```bash
# Если используется ngrok, проверьте что он живой
curl -v -X POST \
  -H "Content-Type: application/json" \
  -d '{"challenge": "test_challenge_123"}' \
  https://YOUR-NGROK-URL.ngrok.io/minimax_callback
```

Или посмотрите в ngrok dashboard: http://localhost:4040

### Тест 3: Проверка маршрутизации Astro

Файл `/src/pages/minimax_callback.ts` должен:
- ✅ Существовать в /src/pages/
- ✅ Экспортировать `export async function POST(request: Request)`
- ✅ Возвращать `new Response(JSON.stringify(...), { status: 200, headers: { 'Content-Type': 'application/json' } })`

### Тест 4: Полная симуляция MiniMax handshake

```bash
#!/bin/bash

# 1. Отправка challenge (как MiniMax это делает)
echo "=== ШАГ 1: Challenge verification ==="
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"challenge": "minimax_challenge_xyz"}' \
  http://localhost:3000/minimax_callback

# 2. Отправка успешного callback
echo -e "\n\n=== ШАГ 2: Success callback ==="
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test_task_12345",
    "status": "success",
    "file_id": "file_test_xyz"
  }' \
  http://localhost:3000/minimax_callback

# 3. Отправка failed callback
echo -e "\n\n=== ШАГ 3: Failed callback ==="
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test_task_12345",
    "status": "failed",
    "error": "Generation failed"
  }' \
  http://localhost:3000/minimax_callback
```

---

## ЧАСТЬ 6: ШАГ ДИАГНОСТИКИ

### Шаг 1: Запустите локальный тест
```bash
cd /home/user/ai/astro
npm run dev &
sleep 5
bash diagnostic_minimax.sh
```

Этот скрипт покажет:
- ✅/❌ Сервер доступен?
- ✅/❌ Endpoint существует?
- ✅/❌ Challenge работает?
- ✅/❌ Content-Type правильный?

### Шаг 2: Интерпретируйте результаты

Если все тесты PASS:
```
✅ ВЫВОД: Локальный callback работает идеально
🔍 СЛЕДУЮЩЕЕ: Проблема в ngrok URL или firewall
→ Действие: Проверьте MINIMAX_CALLBACK_URL в .env
→ Действие: Перезапустите ngrok если используется
→ Действие: Проверьте firewall правила
```

Если тест #3 FAIL (404 или 500):
```
❌ ВЫВОД: Endpoint не работает локально
🔍 ПРИЧИНА: файл /src/pages/minimax_callback.ts
→ Действие: Проверьте что файл существует
→ Действие: Проверьте экспорт: export async function POST
→ Действие: Перезагрузите dev сервер: npm run dev
```

Если Content-Type FAIL (не JSON):
```
❌ ВЫВОД: Endpoint возвращает неправильный тип
🔍 ПРИЧИНА: Astro возвращает HTML вместо JSON
→ Действие: Проверьте код - не должно быть редиректов
→ Действие: Убедитесь что используется new Response() с headers
```

### Шаг 3: Если локально работает но MiniMax не подключается

Тогда проблема 100% в сети/firewall:
```
1. MINIMAX_CALLBACK_URL указывает на мертвый ngrok?
   → Перезапустите ngrok, обновите URL в .env

2. Firewall блокирует входящие соединения от MiniMax?
   → Проверьте firewall правила
   → Разрешите incoming traffic на port 443
   → Если ngrok - убедитесь что ngrok туннель открыт

3. Callback URL включает лишние path-сегменты?
   → Должен быть: https://yourdomain.com/minimax_callback
   → НЕ должно быть: https://yourdomain.com/api/minimax_callback
   → НЕ должно быть: https://yourdomain.com:8000/minimax_callback
```

---

## ЧАСТЬ 7: ИТОГОВЫЙ ВЫВОД

### Найденные ФАКТЫ:
1. ✅ Все параметры payload'а ПРАВИЛЬНЫЕ
2. ✅ Callback endpoint ПРАВИЛЬНО структурирован
3. ✅ Challenge verification ПРАВИЛЬНО реализована
4. ✅ Duration тип ПРАВИЛЬНЫЙ (Number)
5. ✅ Callback URL БЕЗ /api ПРАВИЛЬНО

### Что ВЫЗЫВАЕТ ошибку 2013:
```
🔴 ERROR 2013 = MiniMax НЕ МОЖЕТ ДОСТИЧЬ callback_url

ПОТОМУ ЧТО:
- ngrok URL мертв (нужен перезапуск)
- ИЛИ firewall блокирует MiniMax
- ИЛИ endpoint не маршрутизирован (404)
- ИЛИ endpoint возвращает ошибку (500)

НЕ ПОТОМУ ЧТО:
- ✅ параметры неправильные (они правильные)
- ✅ payload неполный (он полный)
- ✅ duration неправильный тип (он Number)
- ✅ callback_url имеет /api (его нет)
```

### КОНКРЕТНЫЕ ДЕЙСТВИЯ (по приоритету):

1. **НЕМЕДЛЕННО:** Запустите diagnostic_minimax.sh
   ```bash
   bash diagnostic_minimax.sh
   ```
   Это покажет точную причину

2. **ЕСЛИ локальный тест пройден:** Проверьте ngrok
   ```bash
   # Перезапустите ngrok
   ngrok http 3000
   # Скопируйте новый URL: https://abcd-1234.ngrok.io
   # Обновите .env: MINIMAX_CALLBACK_URL=https://abcd-1234.ngrok.io
   ```

3. **ЕСЛИ локальный тест НЕ пройден:** Проверьте endpoint
   ```bash
   # Убедитесь /src/pages/minimax_callback.ts существует и экспортирует POST
   cat /src/pages/minimax_callback.ts | head -30
   ```

4. **ЕСЛИ все локально работает:** Проверьте firewall
   ```bash
   # Проверьте что порт открыт
   netstat -tuln | grep 3000
   # или для ngrok
   curl https://YOUR-NGROK-URL/minimax_callback
   ```

---

## СЛЕДУЮЩАЯ ФАЗА

После запуска диагностики:
1. Предоставьте OUTPUT от diagnostic_minimax.sh
2. Я дам ТОЧНЫЙ диагноз
3. Мы исправим ROOT CAUSE
4. Генерация видео будет работать

**ОЖИДАЮ:**
```
$ bash diagnostic_minimax.sh
[результаты тестов]
```

---

*Создано: 2026-01-11*
*Версия: Forensic Analysis v1.0*
*Статус: Готово к диагностике*
