# VideoReader - YouTube AI Translator Extension

> **⚠️ ВАЖНО ДЛЯ AI-АССИСТЕНТОВ: ВСЕГДА ДУМАТЬ И ОТВЕЧАТЬ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ!!!**

## 📋 Описание проекта

Chrome Extension для извлечения и перевода субтитров YouTube видео с использованием AI (GPT-4o-mini). Расширение работает на клиенте, извлекает субтитры напрямую из YouTube DOM, отправляет их на Flask-сервер для построчного перевода и отображает переведенные субтитры в реальном времени с Netflix-подобной подсветкой текущей строки.

## 🎯 Ключевые особенности

### ✅ Реализовано

1. **Realtime subtitle highlighting** - Netflix-уровень синхронизации:
   - Подсветка текущей строки в реальном времени (requestAnimationFrame, 60fps)
   - Karaoke-style progress bar с плавным заполнением (CSS custom properties)
   - Автоматический scroll к активной строке с throttling (800ms)
   - Плавные переходы и градиенты для визуального эффекта

2. **Line-by-line перевод через AI**:
   - Построчный перевод через GPT-4o-mini для избежания token limits
   - SQLite кеширование на сервере для быстрых повторных запросов
   - Контекстный перевод (передаются 1-2 предыдущие строки для accuracy)
   - Немедленное обновление UI по мере получения переводов

3. **Экспорт субтитров**:
   - Три формата: SRT, VTT, TXT
   - Экспорт переведенных субтитров (читает из DOM, не из исходного состояния)
   - Премиум dropdown с иконками форматов
   - Disabled состояние пока перевод не завершен

4. **Multi-language поддержка**:
   - 9 языков: RU, EN, ES, DE, FR, JA, ZH, IT, PT
   - Премиум selector с флагами (SVG inline)
   - localStorage для сохранения выбранного языка
   - Динамическое позиционирование dropdown (сверху/снизу)

5. **Native YouTube UI integration**:
   - Кнопка "Translate Video" в стиле YouTube switch (Эпизоды/Расшифровка)
   - Точная копия нативных кнопок: черный фон (#0f0f0f), белый текст, font-weight 600
   - Состояния: active (черная) → inactive (серая при обработке) → active
   - Hover/active opacity transitions (0.9 / 0.75)

6. **Premium UI/UX**:
   - Минималистичный дизайн в стиле Linear/Notion/Raycast
   - Collapse/expand панели (по умолчанию свернута)
   - Премиум градиенты и тени
   - Smooth animations и transitions
   - Responsive positioning

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    YouTube Page (DOM)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Content Script (content.js)                        │   │
│  │  - Извлекает субтитры из ytd-transcript-segment     │   │
│  │  - Управляет UI панелью                              │   │
│  │  - Realtime highlighting с requestAnimationFrame     │   │
│  │  - Экспорт субтитров (client-side, Blob API)        │   │
│  └──────────────────┬──────────────────────────────────┘   │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      │ HTTP POST /translate-line
                      ▼
         ┌────────────────────────────┐
         │  Flask Server (Python)     │
         │  - Line-by-line translation│
         │  - SQLite cache (per line) │
         │  - GPT-4o-mini API         │
         │  - Context management      │
         └────────────────────────────┘
```

### Почему line-by-line?

**Проблема:** YouTube видео могут иметь 300+ строк субтитров. Отправка всех сразу приведет к:
- Token limit exceeded (GPT-4o-mini max tokens)
- Долгое ожидание (весь перевод одним запросом)
- Невозможность кеширования частичных результатов

**Решение:**
- Переводим каждую строку отдельно
- Передаем 1-2 предыдущие строки как контекст для точности
- Кешируем каждую строку отдельно (videoId + lineNumber + lang)
- Немедленно показываем перевод в UI (streaming-like UX)

## 📁 Структура проекта

```
/home/user/ai/
├── extension/                    # Chrome Extension
│   ├── manifest.json            # Manifest V3
│   ├── content.js               # Основная логика (1137 строк)
│   ├── styles.css               # Премиум UI стили (791 строк)
│   ├── flags.js                 # SVG флаги стран (inline)
│   ├── assets/
│   │   └── logo.png            # Логотип VideoReader
│   └── README.md               # Этот файл
│
├── SERVER_TEMPLATE.py           # Flask сервер для перевода
├── server_requirements.txt      # Python зависимости
└── translations.db              # SQLite кеш (создается автоматически)
```

## 🔧 Установка и запуск

### 1. Установка расширения

```bash
# 1. Открыть Chrome -> chrome://extensions/
# 2. Включить "Developer mode"
# 3. "Load unpacked" -> выбрать папку /home/user/ai/extension/
```

### 2. Запуск сервера перевода

```bash
# Установить зависимости
cd /home/user/ai
pip3 install -r server_requirements.txt

# Установить OpenAI API key
export OPENAI_API_KEY='your-api-key-here'

# Запустить сервер
python3 SERVER_TEMPLATE.py

# Сервер запустится на http://localhost:5000
```

### 3. Использование

1. Открыть любое YouTube видео с субтитрами
2. Справа от видео появится панель VideoReader (свернута по умолчанию)
3. Развернуть панель (кнопка-стрелка)
4. Выбрать язык перевода (RU по умолчанию)
5. Нажать "Translate Video" (черная кнопка)
6. Дождаться перевода (строки обновляются в реальном времени)
7. Экспортировать субтитры через кнопку экспорта (SRT/VTT/TXT)

## 🎨 UI/UX детали

### Кнопка "Translate Video"

**Требования:** Точная копия YouTube переключателя "Эпизоды / Расшифровка видео"

**Спецификация:**
```css
height: 32px
padding: 0 12px
border-radius: 8px
font-size: 14px
font-weight: 600 (жирный!)
```

**Состояния:**
- **Active** (изначально): `background: #0f0f0f`, `color: #ffffff`
- **Inactive** (во время loading/translating): `background: #f2f2f2`, `color: #0f0f0f`
- **Hover**: `opacity: 0.9`
- **Click**: `opacity: 0.75`

**Критически важно:**
- Используются уникальные классы `.yt-native-switch-btn` (НЕ generic YouTube классы!)
- Иначе стили расширения будут влиять на ВСЕ кнопки YouTube (было исправлено в коммитах)

### Karaoke Progress Bar

**Эффект:** Плавное заполнение активной строки слева направо с moving edge glow

**Реализация:**
```css
.yt-transcript-item.active-subtitle::before {
  width: var(--karaoke-progress, 0%);  /* Динамически из JS */
  background: linear-gradient(90deg, rgba(99,102,241,0.12), ...);
  transition: width 80ms linear;
}

.yt-transcript-item.active-subtitle::after {
  left: var(--karaoke-progress, 0%);  /* Moving edge */
  width: 2px;
  background: rgba(168,85,247,0.6);
  box-shadow: 0 0 8px rgba(168,85,247,0.3);
}
```

**JS обновление:**
```javascript
updateKaraokeProgress(index, currentTime) {
  const progress = (elapsed / duration) * 100;
  element.style.setProperty('--karaoke-progress', `${progress}%`);
}
```

**Performance:**
- requestAnimationFrame loop (60fps)
- Throttling updates: 120ms между обновлениями
- Scroll throttling: 800ms (не скроллим слишком часто)

### Realtime Highlighting

**Система:**
```javascript
const realtimeHighlighter = {
  video: HTMLVideoElement,
  subtitles: Array,
  currentIndex: number,
  throttleDelay: 120,

  start(subtitles) {
    // Запускает requestAnimationFrame loop
    // Синхронизирует с video.currentTime
  },

  update() {
    // Находит активную строку (оптимизация: ищет в узком диапазоне сначала)
    // Обновляет класс .active-subtitle
    // Обновляет karaoke progress
  }
}
```

**Оптимизации:**
- Начинаем поиск с currentIndex - 1 до currentIndex + 10
- Только если не нашли - ищем по всему массиву
- Scroll только если элемент не виден в viewport

## 🚨 Критические проблемы и решения

### 1. Экспорт загружал английские субтитры вместо переведенных

**Проблема:**
```javascript
// ❌ НЕПРАВИЛЬНО
function handleExportFormat(format) {
  const subtitles = transcriptState.subtitles;  // Это ОРИГИНАЛЬНЫЕ!
}
```

**Решение:**
```javascript
// ✅ ПРАВИЛЬНО
function collectTranslatedSubtitles() {
  const items = document.querySelectorAll('.yt-transcript-item');
  items.forEach(item => {
    const text = item.querySelector('.yt-transcript-item-text').textContent;
    // Читаем из DOM - там уже переведенный текст!
  });
}
```

### 2. CSS расширения влиял на ВСЕ кнопки YouTube

**Проблема:**
```css
/* ❌ НЕПРАВИЛЬНО - generic YouTube класс */
.yt-spec-button-shape-next {
  background-color: #065fd4 !important;
}
```

**Результат:** ВСЕ кнопки YouTube на странице стали синими!

**Решение:**
```css
/* ✅ ПРАВИЛЬНО - уникальные классы */
.yt-native-switch-btn {
  /* Наши стили не влияют на YouTube */
}
```

### 3. Karaoke эффект слишком яркий

**Было:**
```css
rgba(99, 102, 241, 0.35)  /* Слишком насыщенно */
```

**Стало:**
```css
rgba(99, 102, 241, 0.12)  /* Мягко и subtle */
```

## 📝 История разработки

### Фаза 1: Базовая функциональность
- Извлечение субтитров из YouTube DOM
- Отправка на Flask сервер
- Line-by-line перевод через GPT-4o-mini
- SQLite кеширование

### Фаза 2: Realtime highlighting
- requestAnimationFrame sync с видео
- Netflix-style подсветка активной строки
- Karaoke progress bar с CSS custom properties
- Оптимизация производительности (throttling)

### Фаза 3: UI/UX полировка
- Премиум дизайн в стиле Linear/Notion
- Collapse/expand панели
- Multi-language selector с флагами
- Экспорт субтитров (SRT/VTT/TXT)

### Фаза 4: Интеграция с YouTube
- Нативные стили кнопок
- Исправление CSS bleeding в YouTube UI
- Точная копия YouTube switch button
- Состояния active/inactive с transitions

## 🔑 Ключевые файлы и секции

### content.js

**Строки 10-201:** Realtime highlighting system
```javascript
const realtimeHighlighter = {
  start(), stop(), update(), updateKaraokeProgress(), scrollToActive()
}
```

**Строки 264-379:** Создание панели UI
```javascript
function createTranscriptPanel() {
  // HTML структура с logo, controls, language selector
}
```

**Строки 541-719:** Экспорт субтитров
```javascript
collectTranslatedSubtitles()  // Читает из DOM!
generateSRT(), generateVTT(), generateTXT()
downloadFile()
```

**Строки 721-826:** Обработчик кнопки перевода
```javascript
async function handleGetTranscript() {
  // Состояния: active → inactive (loading) → inactive (translating) → active
}
```

**Строки 828-895:** Line-by-line перевод
```javascript
async function translateSubtitles(videoId, subtitles) {
  for (let i = 0; i < subtitles.length; i++) {
    // POST /translate-line для каждой строки
    // Немедленное обновление UI
  }
}
```

### styles.css

**Строки 258-313:** Native YouTube switch button
```css
.yt-native-switch-btn.active { background: #0f0f0f; color: #fff; }
.yt-native-switch-btn.inactive { background: #f2f2f2; color: #0f0f0f; }
```

**Строки 619-662:** Karaoke progress bar
```css
.yt-transcript-item.active-subtitle::before { /* filling bar */ }
.yt-transcript-item.active-subtitle::after { /* moving edge */ }
```

**Строки 694-706:** Native YouTube timestamp style
```css
.yt-transcript-item-time {
  color: var(--yt-spec-call-to-action);
  background: var(--yt-spec-suggested-action);
}
```

## 🎯 Git workflow

**Текущая ветка:** `claude/simple-extension-button-011CV6BtZXNEKv446PgLW6KJ`

**Важные коммиты:**
```
7899f46 - fix: invert button states (black by default, grey when processing) + bold font
827b7e3 - refactor: native YouTube switch button style (Episodes/Transcript clone)
0fdee27 - fix: white text color on hover for button visibility
770d5a8 - fix: use unique chip button classes to avoid YouTube CSS conflicts
ece6e8a - fix: button always visible with blue background
```

**При коммитах:**
```bash
git add -A
git commit -m "descriptive message"
git push -u origin claude/simple-extension-button-011CV6BtZXNEKv446PgLW6KJ
```

## 🔍 Debugging tips

### Content script не загружается
```javascript
// Проверить в DevTools Console:
console.log('VideoReader loaded');

// Проверить manifest.json matches:
"matches": ["*://*.youtube.com/*"]
```

### Сервер не отвечает
```bash
# Проверить запущен ли:
ps aux | grep python

# Проверить логи:
python3 SERVER_TEMPLATE.py
# Должно быть: "Server running on http://localhost:5000"

# Тест endpoint:
curl http://localhost:5000/health
```

### Karaoke не синхронизирован
```javascript
// Проверить video element:
const video = document.querySelector('video');
console.log(video.currentTime);

// Проверить subtitles timing:
console.log(realtimeHighlighter.subtitles);
// Каждый элемент должен иметь start и end в секундах
```

### Экспорт показывает английский текст
```javascript
// ВСЕГДА используй collectTranslatedSubtitles()!
// Никогда не используй transcriptState.subtitles для экспорта
const translated = collectTranslatedSubtitles();  // ✅ Читает из DOM
```

## 📊 Метрики производительности

- **Realtime sync:** 60fps (requestAnimationFrame)
- **Update throttle:** 120ms между обновлениями позиции
- **Scroll throttle:** 800ms между автоскроллами
- **Translation speed:** ~50ms задержка между строками (для плавности)
- **Cache hit:** Мгновенно (SQLite SELECT)
- **Translation (no cache):** ~1-3s на строку (GPT-4o-mini)

## 🌟 Будущие улучшения (если потребуется)

1. **Offline mode:** LocalStorage кеш на клиенте
2. **Batch translation:** Группировка строк для ускорения
3. **Custom AI providers:** Поддержка Claude, Gemini
4. **Video-to-text:** Извлечение субтитров из видео без текста
5. **Real-time translation:** WebSocket для streaming переводов
6. **Browser sync:** Синхронизация настроек между устройствами

## ⚠️ Важные замечания

1. **ВСЕГДА** проверяйте, что стили расширения не влияют на YouTube UI
2. **НИКОГДА** не используйте generic YouTube классы (`.yt-spec-*`)
3. **ВСЕГДА** читайте переведенные субтитры из DOM для экспорта
4. **ПОМНИТЕ** о throttling для производительности
5. **ПРОВЕРЯЙТЕ** уникальность классов CSS

## 📞 Контакты и поддержка

Этот проект разработан как Chrome Extension для личного использования.
Server template предоставлен для self-hosting с вашим OpenAI API key.

---

**Последнее обновление:** 2025-01-14
**Версия:** 3.4.0
**Статус:** ✅ Production Ready
