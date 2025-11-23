# Анализ механизма получения субтитров YouTube

## Обзор

Расширение **YouTubeSummary** использует **робастную multi-fallback стратегию** с 4 различными методами получения субтитров от YouTube. Эта стратегия обеспечивает высокую надёжность: если один метод не работает, автоматически используется следующий.

---

## 🔑 Ключевые методы получения субтитров

### Метод 1️⃣: YouTube Internal API (ОСНОВНОЙ)

**Endpoint**: `https://www.youtube.com/youtubei/v1/get_transcript`

**Как это работает**:
1. Расширение делает POST-запрос к внутреннему YouTube API
2. Передаёт `params` (зашифрованный идентификатор транскрипта)
3. Получает JSON с полными данными транскрипта

**Пример запроса**:
```javascript
fetch("https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20241115.00.00"  // Случайная версия из последних 30 дней
      }
    },
    params: "ENCODED_PARAMS_STRING"  // Берется из ytInitialPlayerResponse
  })
})
```

**Структура ответа**:
```javascript
{
  "actions": [{
    "updateEngagementPanelAction": {
      "content": {
        "transcriptRenderer": {
          "content": {
            "transcriptSearchPanelRenderer": {
              "body": {
                "transcriptSegmentListRenderer": {
                  "initialSegments": [
                    {
                      "transcriptSegmentRenderer": {
                        "startMs": "0",         // Время начала в миллисекундах
                        "endMs": "3540",        // Время окончания
                        "snippet": {
                          "runs": [{
                            "text": "hello world"  // Текст субтитра
                          }]
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  }]
}
```

**Преимущества**:
- ✅ Самый быстрый метод
- ✅ Возвращает структурированные данные с точными временными метками
- ✅ Официальный API YouTube (меньше вероятность блокировки)

**Недостатки**:
- ❌ Требует получить `params` из HTML страницы
- ❌ Может не работать для некоторых видео

---

### Метод 2️⃣: Timedtext API с potoken (РЕЗЕРВНЫЙ #1)

**Endpoint**: `https://www.youtube.com/api/timedtext?v={VIDEO_ID}&...`

**Как это работает**:
1. Получает `baseUrl` для субтитров из `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks`
2. Добавляет специальный токен `pot` (potoken) для обхода защиты
3. Делает GET-запрос и получает XML с субтитрами

**Получение potoken** (уникальная техника):
```javascript
// 1. Программно кликает на кнопку субтитров в YouTube плеере
document.querySelector("#primary-button").click();

// 2. Мониторит сетевые запросы через Performance API
performance.getEntriesByType("resource")
  .filter(entry => entry.name.includes("/api/timedtext?"))
  .pop();

// 3. Извлекает pot токен из URL перехваченного запроса
const url = new URL(entry.name);
const potToken = url.searchParams.get("pot");
```

**Пример URL**:
```
https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=en&pot={POTOKEN}&c=WEB
```

**Структура XML ответа**:
```xml
<?xml version="1.0" encoding="utf-8"?>
<transcript>
  <text start="0" dur="3.54">hello world</text>
  <text start="3.54" dur="2.12">this is a test</text>
  <text start="5.66" dur="1.89">more text here</text>
</transcript>
```

**Преимущества**:
- ✅ Прямой доступ к субтитрам
- ✅ Простой XML формат
- ✅ Работает для большинства видео

**Недостатки**:
- ❌ Требует получение pot токена
- ❌ Может быть заблокирован YouTube

---

### Метод 3️⃣: DOM Парсинг (РЕЗЕРВНЫЙ #2)

**Как это работает**:
1. Программно кликает на кнопку "Show transcript" в YouTube UI
2. Ждёт загрузки элементов транскрипта в DOM
3. Парсит HTML элементы напрямую

**Код**:
```javascript
// 1. Клик на кнопку транскрипта
const button = document.querySelector(
  "#primary-button > ytd-button-renderer > yt-button-shape > button"
);
button.click();

// 2. Ждём загрузки элементов
await waitForElement("#segments-container > ytd-transcript-segment-renderer");

// 3. Парсим элементы
const segments = document.querySelectorAll(
  "#segments-container > ytd-transcript-segment-renderer"
);

segments.forEach(segment => {
  const timestamp = segment.querySelector("div.segment-timestamp")?.textContent?.trim();
  const text = segment.querySelector("yt-formatted-string")?.textContent?.trim();

  transcripts.push({
    start: convertTimestampToSeconds(timestamp),  // "0:00" -> 0
    text: text
  });
});
```

**Преимущества**:
- ✅ Не требует API запросов
- ✅ Работает всегда, если видео имеет субтитры
- ✅ Обходит любые ограничения API

**Недостатки**:
- ❌ Медленный (требует клики и ожидание)
- ❌ Зависит от структуры DOM YouTube (может сломаться при изменениях)
- ❌ Требует взаимодействие с UI

---

### Метод 4️⃣: Firestore Database (РЕЗЕРВНЫЙ #3)

**Как это работает**:
1. Отправляет запрос к background script расширения
2. Background script обращается к Firestore базе данных
3. Возвращает кэшированные субтитры, если они есть

**Код**:
```javascript
const response = await chrome.runtime.sendMessage({
  action: "get_yt_scripts",
  title: videoTitle,
  videoId: videoId,
  vssId: languageCode
});

const { transcripts, availLangs } = response.data;
```

**Преимущества**:
- ✅ Очень быстрый (кэшированные данные)
- ✅ Не зависит от YouTube API

**Недостатки**:
- ❌ Требует серверную инфраструктуру
- ❌ Данные могут быть устаревшими
- ❌ Не все видео закэшированы

---

## 📊 Где YouTube хранит информацию о субтитрах

### 1. В HTML странице: `ytInitialPlayerResponse`

YouTube встраивает глобальную переменную `ytInitialPlayerResponse` в HTML код каждой страницы видео:

```javascript
// Поиск в HTML
const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`).then(r => r.text());

// Метод 1: Regex парсинг
const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
const data = JSON.parse(match[1]);

// Метод 2: Split парсинг (используется в YouTubeSummary)
const parts = html.split('"captions":');
if (parts.length >= 2) {
  const captionsJson = parts[1].split(',"videoDetails')[0];
  const captions = JSON.parse(captionsJson);
}
```

### 2. Структура `captionTracks`

```javascript
{
  "captions": {
    "playerCaptionsTracklistRenderer": {
      "captionTracks": [
        {
          "baseUrl": "https://www.youtube.com/api/timedtext?v=VIDEO_ID&lang=en&...",
          "name": {
            "simpleText": "English"  // Название языка
          },
          "vssId": "en",            // Код языка (иногда ".en")
          "languageCode": "en",
          "kind": "asr",            // "asr" = автогенерированные
          "isTranslatable": true
        },
        {
          "baseUrl": "https://www.youtube.com/api/timedtext?v=VIDEO_ID&lang=ru&...",
          "name": {
            "simpleText": "Russian"
          },
          "vssId": ".ru",
          "languageCode": "ru"
        }
      ],
      "audioTracks": [...],
      "translationLanguages": [
        {"languageCode": "af", "languageName": {"simpleText": "Afrikaans"}},
        {"languageCode": "ar", "languageName": {"simpleText": "Arabic"}},
        // ... все доступные языки для перевода
      ]
    }
  }
}
```

### 3. Получение `params` для Internal API

```javascript
// Из того же HTML
const paramsMatch = html.split('"getTranscriptEndpoint":')[1]
  .split('"params":"')[1]
  .split('"')[0];

// params выглядит примерно так:
"CgtuNHM4VjVLSGl1WSoLCgtuNHM4VjVLSGl1WTACMAE"
```

---

## 🔄 Обработка полученных субтитров

### 1. Декодирование HTML сущностей

YouTube часто включает HTML entities в текст субтитров:

```javascript
function decodeHtmlEntities(text) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&laquo;": "«",
    "&raquo;": "»"
  };

  return text.replace(/&#\d+;|&\w+;/g, entity => {
    return entities[entity] || entity;
  });
}
```

### 2. Удаление HTML тегов

```javascript
function stripHtmlTags(text) {
  return text.replace(/<[^>]*>/g, "");
}
```

### 3. Форматирование времени

```javascript
// Из миллисекунд в секунды
const seconds = Number(startMs) / 1000;

// Форматирование для отображения
function formatTime(seconds) {
  const hasHours = seconds >= 3600;
  const format = hasHours ? 14 : 12;  // HH:MM:SS или MM:SS
  return new Date(seconds * 1000).toISOString().substring(format, 19);
}

// "0" -> "0:00"
// "3661" -> "1:01:01"
```

### 4. Группировка сегментов

YouTubeSummary группирует короткие сегменты для лучшей читаемости:

```javascript
function groupSegments(segments, maxPerGroup = 5) {
  const grouped = [];
  let currentGroup = [];
  let currentStart = 0;

  segments.forEach((segment, index) => {
    if (currentGroup.length === 0) {
      currentStart = segment.start;
    }

    currentGroup.push(segment.text);

    // Группируем по 5 сегментов или по концу предложения
    if (currentGroup.length >= maxPerGroup || segment.text.endsWith('.')) {
      grouped.push({
        start: currentStart,
        text: currentGroup.join(' ')
      });
      currentGroup = [];
    }
  });

  return grouped;
}
```

---

## 💾 Кэширование

YouTubeSummary активно использует кэширование для оптимизации:

```javascript
const CACHE_KEYS = {
  transcriptParams: "youtube-transcript-params",
  rawTranscript: "youtube-raw-transcript",
  captionTracks: "youtube-caption-tracks"
};

// Сохранение в localStorage
function cacheData(key, data, ttl = null) {
  const cacheKey = `${key}-${videoId}`;
  localStorage.setItem(cacheKey, JSON.stringify(data));

  if (ttl) {
    setTimeout(() => {
      localStorage.removeItem(cacheKey);
    }, ttl);
  }
}

// Чтение из кэша
function getCachedData(key) {
  const cacheKey = `${key}-${videoId}`;
  const cached = localStorage.getItem(cacheKey);
  return cached ? JSON.parse(cached) : null;
}
```

---

## 🎯 Алгоритм работы расширения

```
1. Пользователь открывает видео YouTube
   ↓
2. Content Script определяет videoId
   ↓
3. Проверка кэша (localStorage)
   ↓
4. Если в кэше - используем ✅
   ↓
5. Если нет - загружаем HTML страницу
   ↓
6. Парсим ytInitialPlayerResponse
   ↓
7. Извлекаем captionTracks и params
   ↓
8. ПОПЫТКА 1: YouTube Internal API (/youtubei/v1/get_transcript)
   ├─ Успех? → Сохраняем в кэш → Готово ✅
   └─ Ошибка? → Переходим к попытке 2
   ↓
9. ПОПЫТКА 2: Timedtext API с potoken
   ├─ Получаем potoken через Performance API
   ├─ Делаем запрос к baseUrl + pot
   ├─ Парсим XML
   ├─ Успех? → Сохраняем в кэш → Готово ✅
   └─ Ошибка? → Переходим к попытке 3
   ↓
10. ПОПЫТКА 3: DOM Парсинг
    ├─ Кликаем на кнопку субтитров
    ├─ Ждём загрузки элементов
    ├─ Парсим DOM
    ├─ Успех? → Сохраняем в кэш → Готово ✅
    └─ Ошибка? → Переходим к попытке 4
    ↓
11. ПОПЫТКА 4: Firestore Database
    ├─ Запрос к background script
    ├─ Получение из Firestore
    ├─ Успех? → Готово ✅
    └─ Ошибка? → Показываем сообщение об ошибке ❌
```

---

## 🛡️ Обход ограничений YouTube

### 1. Ротация версий клиента

```javascript
// Генерация случайной версии из последних 30 дней
const dates = Array.from({length: 30}, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - i);
  return date.toISOString().split("T")[0].replace(/-/g, "");
});

const randomVersion = `2.${dates[Math.floor(Math.random() * dates.length)]}.00.00`;
```

### 2. Использование potoken

Pot (Proof of Origin Token) - это токен, который YouTube использует для проверки, что запрос пришёл от легитимного браузера:

```javascript
// Хитрый способ получения pot токена:
// 1. Кликаем на кнопку субтитров
// 2. YouTube делает запрос к /api/timedtext с pot токеном
// 3. Перехватываем этот запрос через Performance API
// 4. Извлекаем pot токен из URL
// 5. Используем его для наших запросов

const potToken = await getPotToken(videoId);
const url = `${baseUrl}&pot=${potToken}&c=WEB`;
```

### 3. Fallback на DOM парсинг

Если все API методы не работают, расширение парсит UI напрямую - это невозможно заблокировать, пока существует интерфейс субтитров.

---

## 📋 Итоговая структура данных

После всей обработки, расширение создаёт унифицированную структуру:

```javascript
{
  videoId: "dQw4w9WgXcQ",
  title: "Rick Astley - Never Gonna Give You Up",
  transcripts: [
    {
      index: 0,
      start: 0,           // секунды (Number)
      end: 3.54,          // секунды (опционально)
      duration: 3.54,     // секунды (опционально)
      text: "hello world" // очищенный текст
    },
    {
      index: 1,
      start: 3.54,
      end: 5.66,
      duration: 2.12,
      text: "this is a test"
    }
  ],
  availLangs: [
    {
      link: "https://www.youtube.com/api/timedtext?v=...",
      language: "English",
      langCode: "en"
    },
    {
      link: "https://www.youtube.com/api/timedtext?v=...",
      language: "Russian",
      langCode: "ru"
    }
  ],
  selectedLang: "English",
  transcriptParams: "ENCODED_PARAMS"
}
```

---

## 🔍 Ключевые технологии

1. **Fetch API** - для HTTP запросов
2. **DOM API** - для парсинга HTML и взаимодействия с UI
3. **Performance API** - для перехвата сетевых запросов
4. **DOMParser** - для парсинга XML субтитров
5. **Regular Expressions** - для извлечения данных из HTML
6. **LocalStorage** - для кэширования
7. **Chrome Extension APIs** - runtime messaging, storage

---

## ⚠️ Важные замечания

1. **Метод с potoken** - самая уникальная техника, которая использует Performance API для перехвата реальных запросов YouTube плеера

2. **Split парсинг вместо regex** - расширение использует `.split()` для извлечения JSON из HTML, что быстрее и надёжнее regex на больших строках

3. **Множественные fallback методы** - обеспечивают ~99% надёжность получения субтитров

4. **Кэширование на каждом этапе** - минимизирует количество запросов и ускоряет работу

5. **Обработка HTML entities** - критически важна, так как YouTube часто кодирует спецсимволы

6. **vssId может начинаться с точки** - при парсинге нужно её удалять: `".en"` → `"en"`

---

## 📚 Полезные ссылки

- YouTube Internal API: `https://www.youtube.com/youtubei/v1/get_transcript`
- Timedtext API: `https://www.youtube.com/api/timedtext`
- Performance API: https://developer.mozilla.org/en-US/docs/Web/API/Performance_API
- DOMParser: https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
