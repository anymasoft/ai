# Depeche - AI Article Editor

Минимальный FastAPI-сервер для раздачи UI рабочей области.

## Структура проекта

```
depeche/
├─ main.py              # FastAPI приложение
├─ __init__.py          # Python пакет
├─ templates/
│  └─ index.html        # HTML UI (Pixel Bootstrap)
├─ static/              # Статические файлы (CSS, JS, images)
├─ requirements.txt     # Зависимости Python
└─ README.md            # Этот файл
```

## Установка зависимостей

```bash
cd depeche
pip install -r requirements.txt
```

## Запуск сервера

Из папки depeche:

```bash
python main.py
```

Или через uvicorn:

```bash
uvicorn main:app --reload
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
- **Jinja2** — шаблонизатор
- **Pixel Bootstrap UI Kit** — используется через CDN в index.html
- **Uvicorn** — ASGI-сервер
- **Hot reload** — флаг `--reload` перезагружает сервер при изменении файлов

## Тестирование

Проверить что сервер работает:

```bash
curl http://localhost:8000/health
```

Ответ: `{"status":"ok","app":"Depeche"}`
