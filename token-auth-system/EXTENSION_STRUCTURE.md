# Chrome Extension Structure - Token Auth System

## Файлы расширения

### manifest.json
Манифест Chrome Extension v3 с настройками:
- `permissions: ["storage"]` - для сохранения токена в chrome.storage
- `host_permissions` - доступ к YouTube
- `content_scripts` - инжектим content.js, styles.css, flags.js на YouTube
- `background` - service worker для обработки OAuth

### content.js (ОБНОВЛЕН)
Главный файл расширения с добавленной токен-авторизацией:

**Добавлено:**
```javascript
// Слушаем postMessage от OAuth callback
window.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'AUTH_SUCCESS') {
    const token = event.data.token;
    await chrome.storage.local.set({ token });
    await fetchPlan();
  }
});

// Получаем план по Bearer токену
async function fetchPlan() {
  const storage = await chrome.storage.local.get(['token']);
  const token = storage.token;

  const response = await fetch('http://localhost:5000/api/plan', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  await chrome.storage.local.set({
    plan: data.plan,
    email: data.email
  });
}
```

**Основной функционал (без изменений):**
- Создание панели транскрипта
- Получение субтитров YouTube
- Перевод через API построчно
- Realtime highlighting (синхронизация с видео)
- Karaoke progress bar
- Экспорт в SRT/VTT/TXT
- Выбор языка перевода

### background.js
Service worker для обработки сообщений:
- Слушает `chrome.runtime.onMessage` для AUTH_SUCCESS
- Сохраняет токен в chrome.storage
- Может использоваться для фоновых задач

### styles.css
Премиум UI стили в стиле Linear/Notion:
- CSS переменные для light/dark mode
- Премиум заголовок с логотипом
- Native YouTube switch button
- Язык селектор с флагами
- Export dropdown
- Realtime highlighting с karaoke прогресс-баром
- Плавные анимации и transitions

### flags.js
SVG флаги для 9 языков:
- Inline SVG для обхода CSP ограничений
- Функция `getFlagSVG(countryCode)`
- Поддержка: ru, en, es, de, fr, ja, zh, it, pt

### assets/logo.png
Логотип расширения (32x32, 48x48, 128x128)

## Как это работает вместе

### Инициализация:
1. **content.js** инжектится на YouTube страницы
2. **styles.css** применяет премиум стили
3. **flags.js** загружает SVG флаги
4. При загрузке вызывается `fetchPlan()` для получения плана

### OAuth флоу:
1. Пользователь открывает OAuth popup → `/auth/callback`
2. Сервер возвращает HTML с `postMessage({ type: 'AUTH_SUCCESS', token })`
3. **content.js** ловит postMessage → сохраняет токен
4. Вызывается `fetchPlan()` → получает план по Bearer токену
5. План сохраняется в chrome.storage

### Работа расширения:
1. Пользователь нажимает "Translate Video"
2. content.js получает субтитры YouTube
3. Отправляет на `/translate-line` построчно
4. Обновляет UI в реальном времени
5. Запускает realtime highlighting
6. Пользователь может экспортировать в SRT/VTT/TXT

## Permissions

### storage
```json
"permissions": ["storage"]
```
Для сохранения:
- `token` - UUID токен авторизации
- `plan` - тарифный план (Free/Pro/Premium)
- `email` - email пользователя

### host_permissions
```json
"host_permissions": ["https://www.youtube.com/*"]
```
Для инжектирования content script на YouTube

## Content Security Policy

Расширение соблюдает CSP:
- Inline SVG флаги (не external URLs)
- Все скрипты локальные
- Нет eval() или опасных функций
- Web accessible resources для logo.png

## Debugging

### Chrome DevTools:
```javascript
// Проверить сохраненные данные
chrome.storage.local.get(['token', 'plan', 'email'], console.log)

// Очистить storage
chrome.storage.local.clear()

// Проверить токен
chrome.storage.local.get('token', (data) => {
  console.log('Token:', data.token)
})
```

### Background Service Worker:
1. Откройте `chrome://extensions/`
2. Найдите расширение
3. Нажмите "Service Worker" → откроется DevTools
4. Проверьте логи `[VideoReader Background]`

### Content Script:
1. Откройте YouTube
2. F12 → Console
3. Проверьте логи `[VideoReader]`

## Возможные проблемы

### Токен не сохраняется
- Проверьте permission "storage" в manifest.json
- Проверьте, что postMessage приходит (DevTools → Console)

### Стили не применяются
- Проверьте, что styles.css в content_scripts
- Проверьте селекторы (возможно YouTube изменил DOM)

### Флаги не отображаются
- Проверьте, что flags.js загружается перед content.js
- Проверьте функцию `getFlagSVG()` в консоли

### /api/plan возвращает 401
- Проверьте, что токен сохранен: `chrome.storage.local.get('token')`
- Проверьте заголовок Authorization в Network tab
- Проверьте, что токен есть в БД users.db
