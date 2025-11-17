# 🔧 CORS Fix для /translate-line

## Проблема
Flask получал только OPTIONS запросы (CORS preflight), но реальные POST запросы блокировались браузером.

## Причина
CORS был настроен только для `/api/*`, но endpoint `/translate-line` не был покрыт.

## Решение
Обновлён SERVER_TEMPLATE.py с правильной CORS конфигурацией:

### 1. Добавлен CORS для `/translate-line`
```python
CORS(
    app,
    resources={
        r"/translate-line": {
            "origins": ["https://www.youtube.com", "https://youtube.com"],
            "methods": ["POST", "OPTIONS"],
            "allow_headers": ["Content-Type"],
            "max_age": 3600  # Кеширование preflight на 1 час
        },
        # ... другие endpoints
    }
)
```

### 2. Добавлена обработка OPTIONS в endpoint
```python
@app.route('/translate-line', methods=['POST', 'OPTIONS'])
def translate_line():
    # Обработка CORS preflight запроса
    if request.method == 'OPTIONS':
        return '', 200

    # ... остальной код
```

## Безопасность

✅ **Только YouTube origins** - разрешены только:
  - `https://www.youtube.com`
  - `https://youtube.com`

✅ **Только нужные методы** - POST и OPTIONS

✅ **Только Content-Type header** - минимальные права

✅ **Кеширование preflight** - `max_age: 3600` уменьшает количество OPTIONS запросов

✅ **Разделение прав**:
  - `/translate-line` - только YouTube, без credentials
  - `/api/*` - YouTube + расширение, с credentials для OAuth
  - `/health`, `/stats` - публичные endpoints

## Как применить

1. Перезапусти Flask сервер:
```bash
python SERVER_TEMPLATE.py
```

2. Обнови YouTube страницу

3. Открой видео с субтитрами

4. Проверь логи Flask - должно быть:
```
OPTIONS /translate-line - 200
POST /translate-line - 200  ← Теперь это появится!
POST /translate-line - 200
```

5. В DevTools Console на YouTube не должно быть CORS ошибок

## Тестирование

### В DevTools Console на YouTube:

```javascript
// Тест запроса
fetch('http://localhost:5000/translate-line', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoId: 'test',
    lineNumber: 0,
    text: 'Hello world',
    lang: 'ru'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

Должен вернуть:
```json
{
  "videoId": "test",
  "lineNumber": 0,
  "text": "Привет мир",
  "cached": false
}
```

## Что изменено

**SERVER_TEMPLATE.py:**
- Строки 22-49: Обновлена CORS конфигурация
- Строки 327, 332-333: Добавлен OPTIONS handler

**Расширение НЕ изменено** - content.js работает правильно.
