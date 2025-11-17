# VideoReader - Clean Plasmo Migration

Чистое ядро YouTube расширения VideoReader на Plasmo Framework.

**На этом этапе:** только базовая функциональность перевода субтитров, никакой авторизации, токенов и тарифов.

## Что включено

- ✅ Панель VideoReader на странице YouTube
- ✅ Получение субтитров с YouTube
- ✅ Отправка субтитров на backend для перевода (построчно)
- ✅ Realtime подсветка текущей реплики (караоке-эффект)
- ✅ Выбор языка перевода (9 языков)
- ✅ Экспорт переведённых субтитров (SRT, VTT, TXT)
- ✅ Современный UI с Tailwind CSS
- ✅ React + TypeScript + Plasmo MV3

## Что НЕ включено (пока)

- ❌ Авторизация через OAuth/токены
- ❌ Тарифные планы и ограничения
- ❌ chrome.storage для сессий
- ❌ Background service worker с авторизацией

---

## Установка и запуск

### 1. Установите зависимости

```bash
cd video-reader-plasmo
npm install
```

### 2. Запустите dev-сервер

```bash
npm run dev
```

Plasmo автоматически соберёт расширение и будет следить за изменениями.

### 3. Загрузите расширение в Chrome

1. Откройте Chrome и перейдите в `chrome://extensions/`
2. Включите **Developer mode** (правый верхний угол)
3. Нажмите **Load unpacked**
4. Выберите папку: `video-reader-plasmo/build/chrome-mv3-dev`

### 4. Проверьте работу

1. Откройте любое видео на YouTube (с доступными субтитрами)
2. Справа от видео должна появиться панель **VideoReader**
3. Нажмите **Translate Video** → субтитры загрузятся и переведутся
4. Текущая реплика будет подсвечиваться с караоке-эффектом

---

## Сборка production версии

```bash
npm run build
```

Собранное расширение будет в `build/chrome-mv3-prod/`

Для упаковки в .zip:

```bash
npm run package
```

---

## Структура проекта

```
video-reader-plasmo/
├── src/
│   ├── contents/
│   │   └── youtube.tsx       # Основной контент-скрипт (UI + логика)
│   └── style.css             # Tailwind + кастомные стили
├── assets/
│   └── logo.png              # Логотип расширения
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.cjs
└── README.md
```

---

## Как работает backend

Расширение отправляет запросы на:

```
POST http://localhost:5000/translate-line
```

Тело запроса:

```json
{
  "videoId": "dQw4w9WgXcQ",
  "lineNumber": 0,
  "text": "Hello world",
  "prevContext": ["Previous line 1", "Previous line 2"],
  "lang": "ru"
}
```

Ответ:

```json
{
  "text": "Привет мир",
  "cached": false
}
```

**Важно:** На этом этапе backend НЕ проверяет токены/тарифы, просто переводит текст.

---

## Следующие шаги

После того, как убедитесь, что ядро работает:

1. Добавить авторизацию через OAuth (background.ts + chrome.storage)
2. Интегрировать проверку тарифов (/api/plan)
3. Показывать ограничения для Free плана
4. Добавить popup для управления аккаунтом

---

## Технологии

- **Plasmo** 0.88.0 - Framework для расширений
- **React** 18 - UI библиотека
- **TypeScript** 5 - Типизация
- **Tailwind CSS** 3 - Стили
- **Manifest V3** - Современный стандарт Chrome Extensions

---

## Troubleshooting

### Панель не появляется

- Проверьте, что вы на странице `/watch?v=...`
- Откройте DevTools → Console и посмотрите ошибки
- Убедитесь, что расширение загружено и активно в `chrome://extensions/`

### Субтитры не загружаются

- Убедитесь, что у видео есть субтитры (кнопка "Show transcript" в описании)
- Попробуйте открыть стандартную панель субтитров YouTube вручную

### Перевод не работает

- Проверьте, что Flask backend запущен на `http://localhost:5000`
- Откройте Network tab в DevTools и проверьте запросы к `/translate-line`

---

## Лицензия

Proprietary - VideoReader Team
