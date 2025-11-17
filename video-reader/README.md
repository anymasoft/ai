# VideoReader - YouTube AI Translator

**Рабочее расширение на чистом JavaScript + Plasmo 0.90.3**

Полный перенос кода из `extension/` в Plasmo framework.

## Что работает

- ✅ Панель VideoReader на YouTube
- ✅ Получение субтитров с YouTube
- ✅ Построчный перевод через Flask backend
- ✅ Realtime подсветка с караоке-эффектом
- ✅ Выбор языка перевода (9 языков)
- ✅ Экспорт в SRT/VTT/TXT
- ✅ OAuth обработчик в background service worker
- ✅ Премиум UI с флагами стран

## Установка

### 1. Установите зависимости

```bash
cd video-reader
npm install --ignore-scripts
```

**Важно:** Используйте флаг `--ignore-scripts` чтобы пропустить сборку @parcel/watcher.

### 2. Соберите расширение

```bash
npm run build
```

Результат: `build/chrome-mv3-prod/`

Для разработки с hot reload:

```bash
npm run dev
```

Результат: `build/chrome-mv3-dev/`

### 3. Загрузите в Chrome

1. Откройте `chrome://extensions/`
2. Включите **Developer mode** (правый верхний угол)
3. Нажмите **Load unpacked**
4. Выберите папку:
   - Production: `video-reader/build/chrome-mv3-prod`
   - Development: `video-reader/build/chrome-mv3-dev`

### 4. Проверьте на YouTube

1. Откройте любое видео на YouTube с субтитрами
2. Справа от видео появится панель **VideoReader**
3. Нажмите "Translate Video"
4. Выберите язык перевода
5. Субтитры переведутся построчно

## Структура проекта

```
video-reader/
├── src/
│   ├── background/
│   │   └── index.js          # OAuth handler (из extension/background.js)
│   ├── contents/
│   │   └── index.ts          # Plasmo wrapper
│   ├── content-script.js     # Весь код из content.js + flags.js
│   └── styles.css            # Оригинальные стили из extension/
├── assets/
│   ├── icon.png
│   └── logo.png
├── build/
│   └── chrome-mv3-prod/      # Собранное расширение
│       ├── manifest.json
│       ├── contents.js
│       ├── contents.css
│       └── static/background/
├── package.json
├── tsconfig.json
└── README.md
```

## Как это работает

### Content Script

`src/content-script.js` - это весь код из `extension/content.js` + `extension/flags.js`, объединённые в один файл.

Этот файл импортируется через `src/contents/index.ts`, который добавляет Plasmo конфигурацию:

```typescript
import type { PlasmoCSConfig } from "plasmo"
import "../content-script.js"
import "../styles.css"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  all_frames: false,
  run_at: "document_idle"
}
```

### Background Service Worker

`src/background/index.js` - копия `extension/background.js` для обработки OAuth токенов.

### Стили

`src/styles.css` - точная копия `extension/styles.css` с премиум дизайном.

## Backend API

Расширение ожидает Flask backend на `http://localhost:5000`:

### POST /translate-line

Перевод одной строки субтитров

**Request:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "lineNumber": 0,
  "text": "Hello world",
  "prevContext": ["Previous line"],
  "lang": "ru"
}
```

**Response:**
```json
{
  "text": "Привет мир",
  "cached": false
}
```

### GET /api/plan

Получение тарифного плана (требует токен)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "ok",
  "plan": "Premium",
  "email": "user@example.com"
}
```

## Manifest V3

Расширение использует:

- **permissions**: `storage` - для сохранения токенов и языка
- **host_permissions**:
  - `https://www.youtube.com/*` - для работы на YouTube
  - `http://localhost:5000/*` - для запросов к backend
- **content_scripts**: один скрипт для youtube.com
- **background**: service worker для OAuth
- **web_accessible_resources**: логотип расширения

## Технологии

- **Plasmo Framework** 0.90.3 - без Parcel, без @parcel/watcher
- **Vanilla JavaScript** - чистый JS из extension/
- **TypeScript** 5.5.2 - только для Plasmo wrapper
- **Manifest V3** - современный стандарт

## Отличия от extension/

1. ✅ **Собирается через Plasmo** вместо ручной загрузки
2. ✅ **Автоматическая генерация manifest.json**
3. ✅ **Hot reload** в dev режиме
4. ✅ **Минификация** в production
5. ✅ **Автоматическое создание иконок** разных размеров
6. ❌ **Убраны**: auth.html, pricing.html (пока не нужны)

## Troubleshooting

### Панель не появляется

- Проверьте что вы на странице `/watch?v=...`
- Откройте DevTools → Console → посмотрите ошибки
- Убедитесь что расширение загружено в `chrome://extensions/`

### Субтитры не загружаются

- Проверьте что у видео есть субтитры (кнопка "Show transcript")
- Некоторые видео не имеют текста субтитров

### Перевод не работает

- Убедитесь что Flask backend запущен на `http://localhost:5000`
- Проверьте Network tab в DevTools
- Backend должен отвечать на `/translate-line`

### Ошибки сборки

Если видите ошибки @parcel/watcher:

```bash
rm -rf node_modules package-lock.json
npm install --ignore-scripts
```

## Следующие шаги

После проверки базовой работы:

1. Реализовать OAuth авторизацию
2. Добавить popup для управления аккаунтом
3. Вернуть pricing.html для выбора тарифа
4. Интегрировать проверку лимитов

## Лицензия

Proprietary - VideoReader Team
