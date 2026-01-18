# Depeche - AI Article Editor

Минимальный FastAPI-сервер для раздачи UI рабочей области.

## Структура проекта

```
project_root/
├─ app/
│  ├─ main.py              # FastAPI приложение
│  ├─ templates/
│  │   └─ index.html       # HTML UI (Pixel Bootstrap)
│  └─ static/              # Статические файлы (CSS, JS, images)
├─ requirements.txt        # Зависимости Python
└─ README.md              # Этот файл
```

## Установка зависимостей

```bash
pip install -r requirements.txt
```

## Запуск сервера

```bash
uvicorn app.main:app --reload
```

Или просто:

```bash
python -m uvicorn app.main:app --reload
```

## Открыть в браузере

После запуска сервера откройте:

```
http://localhost:8000/
```

Вы должны увидеть UI рабочей области (Depeche) с:
- Левой панелью (sidebar) со списком статей
- Главной рабочей областью для редактирования
- Prompt bar внизу для взаимодействия

## Особенности

- **FastAPI** — асинхронный веб-фреймворк на Python
- **Jinja2** — шаблонизатор (даже если пока без динамических переменных)
- **Pixel Bootstrap UI Kit** — используется через CDN в index.html
- **Uvicorn** — ASGI-сервер
- **Hot reload** — флаг `--reload` перезагружает сервер при изменении файлов

## Тестирование

Проверить что сервер работает:

```bash
curl http://localhost:8000/health
```

Ответ: `{"status":"ok","app":"Depeche"}`

## Примечания

- HTML UI находится в `app/templates/index.html`
- CSS и JS подключаются из CDN (Pixel Bootstrap)
- Статические файлы можно добавить в `app/static/` если нужны локальные версии
- На этом этапе нет API для сохранения данных — все работает на фронте (localStorage-like)
