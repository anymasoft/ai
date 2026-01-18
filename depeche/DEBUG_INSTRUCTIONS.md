# Инструкция по отладке 404 ошибки

## Что добавлено логирования

### На фронтенде (браузер console):
- `[LOAD]` - загрузка списка статей при инициализации
- `[CREATE]` - процесс нажатия кнопки "+ New Article"
- `[CREATE_API]` - API запрос на создание пустой статьи
- `[PROMPT]` - обработка текста в prompt bar
- `[PLAN_GEN]` - API запрос на генерацию плана
- `[SELECT]` - переключение между статьями

### На бэкенде (uvicorn вывод):
- `[CREATE_ARTICLE]` - endpoint POST /api/articles
- `[GENERATE_PLAN]` - endpoint POST /api/articles/{id}/plan
- `[GET_ARTICLE]` - endpoint GET /api/articles/{id}
- `[GET_ARTICLES_LIST]` - endpoint GET /api/articles
- `[DELETE_ARTICLE]` - endpoint DELETE /api/articles/{id}

## Как запустить и отладить

### 1. Установите зависимости (если ещё не установлены)
```bash
cd /home/user/ai/depeche
pip install -r requirements.txt
```

### 2. Создайте .env файл
```bash
cp .env.example .env
# Отредактируйте .env и добавьте ваш OPENAI_API_KEY
```

### 3. Запустите backend в одном терминале
```bash
cd /home/user/ai/depeche
python main.py
```

Вы должны увидеть вывод типа:
```
INFO:     Application startup complete
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4. Откройте браузер и перейдите на http://localhost:8000

### 5. Откройте DevTools браузера (F12 или Ctrl+Shift+I)
Перейдите на вкладку **Console**

### 6. Выполните тестовый сценарий

#### Сценарий 1: Создание статьи и генерация плана
1. Нажмите кнопку "+ New Article"
2. Введите название статьи, например: "Тестовая статья"
3. Нажмите кнопку "Create"

**Смотрите в Console:**
- Должны появиться логи `[CREATE]`, `[CREATE_API]`
- После этого currentArticleId должен быть установлен

4. В prompt bar введите: "Напиши план статьи: Кошки в квартире"
5. Нажмите Enter

**Смотрите в Console:**
- Логи `[PROMPT]`, `[PLAN_GEN]`
- Если возникает 404 ошибка - смотрим:
  - Какой articleId передаётся?
  - Реально ли эта статья существует?

### 7. Смотрите backend логи

В терминале с backend должны появиться логи типа:
```
[CREATE_ARTICLE] Получен запрос на создание статьи. topic='Тестовая статья'
[CREATE_ARTICLE] Создаём пустую статью с названием 'Тестовая статья'
[CREATE_ARTICLE] Статья успешно создана! ID=1, title='Тестовая статья'

[GENERATE_PLAN] Получен запрос на генерацию плана. article_id=1, topic='Кошки в квартире'
[GENERATE_PLAN] Проверяем существование статьи с ID=1
[GENERATE_PLAN] Статья найдена: ID=1, title='Тестовая статья'
[GENERATE_PLAN] Вызываем LLM для генерации плана по теме 'Кошки в квартире'
[GENERATE_PLAN] План успешно сгенерирован: 1. ...
[GENERATE_PLAN] Обновляем БД - сохраняем план для статьи ID=1
[GENERATE_PLAN] Возвращаем обновлённую статью: ID=1
```

## Что искать при ошибке 404

Если возникает 404 ошибка при генерации плана:

1. **Проверьте консоль браузера:**
   - Какой `articleId` передаётся в `[PLAN_GEN]`?
   - Может ли быть `undefined` или `null`?

2. **Проверьте backend логи:**
   - Какой `article_id` получает endpoint?
   - Статья найдена в БД?

3. **Сравните ID:**
   - ID созданной статьи (в `[CREATE_API]`)
   - ID, который передаётся в `[PLAN_GEN]`
   - Должны быть одинаковыми!

## Команда для очистки БД
```bash
rm depeche/depeche.db
# Бд пересоздастся при перезагрузке сервера
```

## Дополнительное логирование при необходимости

Если нужно добавить более детальное логирование:
- Отредактируйте функции в `/depeche/templates/index.html` между `console.log()` вызовами
- Добавьте `console.log()` в интересующих вас местах
- Используйте формат: `console.log('[SECTION] Ваше сообщение');`

Аналогично для backend:
- Добавьте `logger.info()` или `logger.error()` вызовы в main.py
- Используйте формат: `logger.info(f"[SECTION] Ваше сообщение")`
