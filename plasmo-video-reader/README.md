# Video Reader for YouTube - Plasmo Edition

Chrome-расширение на Plasmo для чтения и перевода субтитров YouTube в реальном времени.

## Быстрый старт

### 1. Установка зависимостей

```bash
cd plasmo-video-reader
npm install
```

### 2. Запуск в режиме разработки

```bash
npm run dev
```

Это запустит Plasmo в dev-режиме с hot reload. Папка `build/chrome-mv3-dev` будет автоматически создана и обновляться при изменениях.

### 3. Загрузка расширения в Chrome

1. Откройте Chrome и перейдите на `chrome://extensions/`
2. Включите "Режим разработчика" (Developer mode) в правом верхнем углу
3. Нажмите "Загрузить распакованное расширение" (Load unpacked)
4. Выберите папку `build/chrome-mv3-dev`

### 4. Использование

1. Убедитесь, что Flask backend запущен на `http://localhost:5000`
2. Откройте любое видео на YouTube
3. Откройте панель транскрипции (Show transcript)
4. Расширение автоматически добавит панель Video Reader
5. Кликайте на строки для получения перевода

## Сборка для продакшена

```bash
npm run build
```

Результат будет в папке `build/chrome-mv3-prod`. Загрузите эту папку в Chrome для финальной версии.

## Упаковка .zip

```bash
npm run package
```

Создаст .zip файл готовый для публикации в Chrome Web Store.

## Структура проекта

```
plasmo-video-reader/
├── src/
│   ├── contents/
│   │   └── youtube.tsx       # Основной контент-скрипт
│   └── style.css             # Глобальные стили с Tailwind
├── package.json
├── tailwind.config.js
├── postcss.config.cjs
└── README.md
```

## Возможности (Шаг 1)

- ✅ Поиск и отображение субтитров YouTube
- ✅ Встраивание панели Video Reader
- ✅ Подсветка активной строки
- ✅ Отправка на backend через `/translate-line`
- ✅ Отображение переводов
- ✅ Кэширование переводов

## TODO (Шаг 2)

- ⏳ Авторизация пользователя
- ⏳ Система токенов и тарифов
- ⏳ Настройки расширения

## Backend API

Расширение использует следующий endpoint:

```
POST http://localhost:5000/translate-line
Content-Type: application/json

{
  "text": "Original subtitle text"
}
```

Ожидаемый ответ:

```json
{
  "translation": "Translated text",
  "text": "Original subtitle text"
}
```

## Отладка

- Откройте DevTools на странице YouTube
- Перейдите на вкладку Console
- Все логи расширения будут там
- Ошибки перевода также логируются в консоль
