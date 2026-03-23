# CRITICAL FIXES — dbgis-backend

## 📋 Дата: 23.03.2026

### Резюме

Исправлены **3 критических проблемы**:
1. ✅ Нельзя остановить процесс обогащения
2. ✅ 500 ошибки в /api/companies без информации
3. ✅ Нет логирования ошибок обогащения

---

## 1️⃣ ПРОБЛЕМА: Нельзя остановить процесс обогащения

### Было (❌ не работает)
```
- Запустил /api/enrich/start → процесс крутится в фоне
- Нет способа остановить → ждём до конца или убиваем процесс (данные могут быть повреждены)
- В UI нет кнопки остановки
```

### Решение (✅ работает)

#### Новый endpoint: `POST /api/enrich/stop`

**Код в main.py:**
```python
# Глобальное состояние
ENRICHMENT_STOP_FLAG = Path(__file__).parent / ".enrichment_stop"

def set_enrichment_stop():
    """Устанавливает флаг для остановки обогащения."""
    ENRICHMENT_STOP_FLAG.touch()

def clear_enrichment_stop():
    """Очищает флаг остановки обогащения."""
    ENRICHMENT_STOP_FLAG.unlink(missing_ok=True)

@app.post("/api/enrich/stop")
async def stop_enrichment():
    """Остановить обогащение контактов."""
    try:
        set_enrichment_stop()
        return {
            "status": "stopping",
            "message": "Процесс обогащения будет остановлен"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка остановки: {str(e)}")
```

#### Механизм остановки в enrich.py

**Проверка флага в основном цикле:**
```python
# В главном цикле обогащения
while True:
    # Проверяем флаг остановки (в начале каждой итерации)
    if is_stop_requested():
        log.info(f"🛑 Остановка запрошена пользователем (обработано: {total_processed})")
        clear_stop_flag()
        show_status(conn)
        return

    batch = get_pending_batch(conn, args.batch_size)
    # ... обработка батча ...
```

#### UI: Кнопка "ОСТАНОВИТЬ"

**HTML (templates/index.html):**
```html
<button
    id="enrich-stop-btn"
    onclick="stopEnrichment()"
    title="Остановить процесс обогащения"
    class="px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition hidden"
>
    Остановить
</button>
```

**JavaScript:**
```javascript
async function stopEnrichment() {
    const stopBtn = document.getElementById('enrich-stop-btn');
    stopBtn.disabled = true;

    try {
        const resp = await fetch('/api/enrich/stop', { method: 'POST' });
        const data = await resp.json();

        if (data.status === 'stopping') {
            showEnrichMsg('Процесс обогащения останавливается…', 'text-orange-600');
        }
    } catch (e) {
        showEnrichMsg(`Ошибка остановки: ${e.message}`, 'text-red-600');
    } finally {
        stopBtn.disabled = false;
    }
}
```

**Логика видимости кнопки:**
```javascript
if (data.is_running) {
    // Процесс работает
    stopBtn.classList.remove('hidden');  // Показываем кнопку
    stopBtn.disabled = false;
} else {
    // Процесс завершился
    stopBtn.classList.add('hidden');     // Скрываем кнопку
}
```

### Как протестировать

```
1. Откройте UI: http://localhost:8000/
2. Кликните "Обогатить" для запуска
   → кнопка "Остановить" появится красная
3. Кликните "Остановить"
   → сообщение "Процесс обогащения останавливается…"
   → в логе: "Остановка запрошена пользователем"
   → кнопка скрывается
4. Проверьте в БД:
   SELECT COUNT(*) FROM companies WHERE enrichment_status = 'processing'
   → должно быть 0 (процесс остановлен)
```

---

## 2️⃣ ПРОБЛЕМА: 500 ошибки в /api/companies без информации

### Было (❌ не информативно)
```
GET /api/companies?city=москва
HTTP 500
{"detail": "Ошибка при получении компаний: ..."}

В логе: никакой информации что произошло
```

### Решение (✅ полная информация)

#### Улучшенная обработка ошибок в обоих endpoints

**В /api/companies:**
```python
try:
    cur = conn.cursor()
    where, params = build_filter_clause(...)
    # ... логика запроса ...
    return result

except Exception as e:
    # Логируем ошибку с полным traceback в stderr
    import traceback
    error_msg = f"{str(e)}\n{traceback.format_exc()}"
    print(f"❌ ОШИБКА в /api/companies: {error_msg}", file=sys.stderr)

    # Возвращаем понятное сообщение (первые 200 символов)
    raise HTTPException(
        status_code=500,
        detail=f"Ошибка при получении компаний: {str(e)[:200]}"
    )
```

**В /api/companies/{company_id}:**
```python
except HTTPException:
    raise
except Exception as e:
    # Логируем с traceback
    import traceback
    error_msg = f"{str(e)}\n{traceback.format_exc()}"
    print(f"❌ ОШИБКА в /api/companies/{company_id}: {error_msg}", file=sys.stderr)

    raise HTTPException(
        status_code=500,
        detail=f"Ошибка при получении деталей компании: {str(e)[:200]}"
    )
```

### Как протестировать

```
1. Запустите FastAPI в консоли:
   python main.py

2. Сделайте запрос, который вызовет ошибку:
   curl "http://localhost:8000/api/companies?city=мос%"

3. В консоли сразу видна ошибка:
   ❌ ОШИБКА в /api/companies: ...
   Traceback (most recent call last):
     File "main.py", line 348, in get_companies
   ...

4. В ответе клиенту (JSON):
   {
     "detail": "Ошибка при получении компаний: <первые 200 символов ошибки>"
   }
```

---

## 3️⃣ ПРОБЛЕМА: Нет логирования ошибок обогащения

### Было (❌ не понять что произошло)
```
- Компания помечена status='failed'
- Но почему failed? Неизвестно
- Нельзя отличить "сайт недоступен" от "ошибка парсинга"
```

### Решение (✅ все ошибки логируются)

#### Новая колонка: enrichment_error

**Миграция (003_add_enrichment_error.sql):**
```sql
ALTER TABLE companies
ADD COLUMN enrichment_error TEXT;

COMMENT ON COLUMN companies.enrichment_error IS 'Сообщение об ошибке при обогащении контактов';
```

#### Обновлена функция mark_failed()

**Было:**
```python
def mark_failed(conn, company_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE companies SET enrichment_status = 'failed' WHERE id = %s",
            (company_id,)
        )
```

**Стало:**
```python
def mark_failed(conn, company_id: int, error_msg: str = None):
    """Отмечает компанию как неудачную и сохраняет сообщение об ошибке."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE companies
            SET enrichment_status = 'failed', enrichment_error = %s
            WHERE id = %s
        """, (error_msg[:500] if error_msg else None, company_id))
        conn.commit()
```

#### Логирование в enrich_one()

**Было:**
```python
links = get_relevant_links(domain)
if not links:
    log.warning(f"[{company_id}] {domain}: сайт недоступен")
    mark_failed(conn, company_id)  # ← no error message
```

**Стало:**
```python
links = get_relevant_links(domain)
if not links:
    error_msg = f"Сайт недоступен или не найдены контактные страницы"
    log.warning(f"[{company_id}] {domain}: {error_msg}")
    mark_failed(conn, company_id, error_msg)  # ← сохраняем сообщение
```

**Обработка исключений:**
```python
except Exception as e:
    error_msg = f"Критическая ошибка: {str(e)[:300]}"
    log.error(f"[{company_id}] {domain}: {error_msg}")
    if conn:
        try:
            conn.rollback()
            mark_failed(conn, company_id, error_msg)  # ← сохраняем
        except Exception:
            pass
```

#### Очистка ошибки при успехе

**mark_done():**
```python
def mark_done(conn, company_id: int):
    """Отмечает компанию как успешно обогащённую."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE companies
            SET enrichment_status = 'done', enriched_at = CURRENT_TIMESTAMP,
                enrichment_error = NULL  # ← очищаем ошибку
            WHERE id = %s
        """, (company_id,))
```

### Как протестировать

```sql
-- Проверить содержание error messages
SELECT id, name, enrichment_status, enrichment_error
FROM companies
WHERE enrichment_status = 'failed'
LIMIT 10;

-- Примеры ошибок:
-- "Сайт недоступен или не найдены контактные страницы"
-- "Критическая ошибка: Connection timeout after 15 seconds"
-- "Критическая ошибка: Invalid HTML received"
```

---

## 4️⃣ УЛУЧШЕНИЕ: Проверка флага в главном цикле

**enrich.py, функция main():**
```python
while True:
    # Проверяем флаг остановки в начале каждой итерации
    if is_stop_requested():
        log.info(f"🛑 Остановка запрошена пользователем (обработано: {total_processed})")
        clear_stop_flag()
        show_status(conn)
        return  # ← выход из цикла, graceful shutdown

    batch = get_pending_batch(conn, args.batch_size)
    # ... rest of loop ...
```

**Преимущества:**
- ✓ Остановка между батчами (не в середине обработки)
- ✓ Нет потери данных (все уже сохранено)
- ✓ Флаг файла надёжен (работает между процессами)
- ✓ Нет blocking операций

---

## 📊 Сводка изменений

| Файл | Тип | Изменение |
|------|-----|----------|
| main.py | 🔧 fix | +40 строк (stop mechanism, error logging) |
| enrich.py | 🔧 fix | +30 строк (stop check, error save) |
| templates/index.html | 🎨 UI | +button, +function, +logic |
| migrations/003_*.sql | 📝 NEW | +enrichment_error column |

---

## 🚀 Deployment Checklist

### Перед production:

```bash
# 1. Примени миграцию
python migrations/run_migration.py 003_add_enrichment_error.sql

# 2. Проверь новые полчатки колонки
psql -U postgres dbgis -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'companies' AND column_name = 'enrichment_error'
"
# ожидаем: enrichment_error | text

# 3. Перезагрузи FastAPI
systemctl restart dbgis-backend
# или
pkill -f "uvicorn main:app"
python main.py

# 4. Проверь endpoints в браузере
# GET http://localhost:8000/
# POST http://localhost:8000/api/enrich/start
# GET http://localhost:8000/api/enrich/status
# POST http://localhost:8000/api/enrich/stop
```

---

## 🧪 Полный тест-план

### Сценарий 1: Остановка обогащения

```
1. UI: Кликнуть "Обогатить"
   ✓ Появилась кнопка "Остановить" (красная)
   ✓ Прогресс-бар движется

2. UI: Кликнуть "Остановить"
   ✓ Сообщение "Процесс обогащения останавливается…"
   ✓ Кнопка скрывается через 1-2 сек

3. БД: SELECT COUNT(*) FROM companies WHERE enrichment_status = 'processing'
   ✓ Результат = 0

4. Логи:
   ✓ grep "Остановка запрошена" logs/enrich.log
```

### Сценарий 2: Ошибка обогащения логируется

```
1. Запусти обогащение с минимальным батчем:
   curl -X POST http://localhost:8000/api/enrich/start?batch_size=10

2. Дождись завершения (или кликни "Остановить")

3. БД: SELECT id, name, enrichment_status, enrichment_error
        FROM companies
        WHERE enrichment_status = 'failed'
        LIMIT 5;
   ✓ Видны подробные сообщения об ошибках в колонке enrichment_error

4. Логи:
   ✓ tail -f logs/enrich.log | grep "ОШИБКА\|failed"
   ✓ Видны сообщения об ошибках
```

### Сценарий 3: API не возвращает пустые 500 ошибки

```
1. Сделать запрос:
   curl http://localhost:8000/api/companies?city=%

2. Ответ (не 500 без информации, а информативная ошибка):
   HTTP 500
   {"detail": "Ошибка при получении компаний: ..."}

3. В консоли FastAPI:
   ✓ ❌ ОШИБКА в /api/companies: ...
   ✓ Полный traceback (для debug)
```

---

## 📈 Метрики успеха

| Метрика | Было | Стало |
|---------|------|-------|
| Можно остановить обогащение | ❌ | ✅ |
| Ошибки обогащения видны | ❌ | ✅ |
| API возвращает информацию об ошибке | ❌ (500 с пустым message) | ✅ |
| UI имеет кнопку остановки | ❌ | ✅ |
| Graceful shutdown обогащения | ❌ | ✅ |

---

## 💾 Коммит

```
e1aace22 fix: Critical enrichment process management and error handling
```

---

## 🔗 Связанные документы

- `CLAUDE.md` — Архитектура проекта
- `MIGRATION_GUIDE.md` — Применение миграций
- `IMPLEMENTATION_NOTES.md` — Разделение источников данных

---

## ⚠️ Important Notes

1. **Флаг-файл (.enrichment_stop)** — удаляется автоматически при:
   - Запуске нового /api/enrich/start (clear_enrichment_stop())
   - Завершении обогащения (clear_stop_flag())
   - Это предотвращает зависание флага

2. **error_msg limitado на 500 символов** — для экономии места в БД

3. **is_running в API** — определяется по наличию 'processing' записей (не по флаг-файлу)
   - Фронтенд полагается на это, чтобы понять, работает ли процесс

4. **Graceful shutdown** — обогащение останавливается между батчами, а не в середине
   - Предотвращает потерю данных и повреждение БД

