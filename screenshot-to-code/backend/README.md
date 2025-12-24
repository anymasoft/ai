# Backend - FastAPI Server

## Запуск сервера

### Правильные команды (порт 7001):

```bash
# Вариант 1: Через start.py (рекомендуется)
poetry run python start.py

# Вариант 2: Через uvicorn с указанием порта
poetry run uvicorn main:app --reload --port 7001

# Вариант 3: Из корня проекта
cd ..
npm run dev:backend
```

### ❌ Неправильно (запустится на порту 8000):

```bash
# Это запустит на порту 8000 вместо 7001!
poetry run uvicorn main:app --reload
```

---

## Важно

Frontend ожидает backend на **http://localhost:7001**

Если запустить backend без `--port 7001`, он стартует на порту **8000** по умолчанию и frontend не сможет к нему подключиться.

---

## Создать admin пользователя

```bash
poetry run python create_admin.py
```

Это создаст пользователя `admin@test.com` с ролью admin.

---

## База данных

- **app.db** - основная БД (users, admin_messages)
- **api.db** - API ключи и generations

Обе базы создаются автоматически при первом запуске в директории `data/`.
