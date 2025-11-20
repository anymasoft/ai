# Video Reader AI - Основной проект

## Структура проекта

### Серверные файлы:
- `SERVER_TEMPLATE.py` - Основной production сервер с полной функциональностью
- `server.py` - Ссылка на актуальный сервер
- `translations.db` - БД с кешем переводов
- `users.db` - БД с пользователями и обратной связью

### Расширение (extension/):
- `manifest.json` - Манифест Chrome расширения
- `content.js` - Content script (внедряется в YouTube)
- `background.js` - Service worker
- `auth.html/js/css` - Страница авторизации OAuth
- `pricing.html/js/css` - Страница тарифов с формой обратной связи
- `styles.css` - Общие стили для расширения
- `flags.js` - Флаги языков
- `checkout_*.html` - Страницы оформления подписки
- `assets/logo.png` - Логотип

## Ключевые особенности актуальной версии

### Логика перевода (content.js):
✅ Фиксированный contextSize = 2 (стабильная логика перевода)
✅ Удалена функция getUserPlan() и динамический contextSize
✅ Лимиты 30% для Free, 100% для Pro/Premium
✅ Export только для Premium плана
✅ Построчный перевод через /translate-line endpoint

### Feedback форма (pricing.html/js):
✅ Премиальные toasts без эмодзи
  - Success: bg-green-50, text-green-800, border-green-200
  - Error: bg-rose-50, text-rose-800, border-rose-200
✅ Плавная анимация с requestAnimationFrame
✅ Автозаполнение email для авторизованных пользователей
✅ Отправка в БД через POST /api/feedback с полем plan
✅ Удален элемент feedback-status (используется showNotification)

### Сервер (SERVER_TEMPLATE.py):
✅ Роут /api/feedback для приема обратной связи
✅ Таблица feedback с полями: email, message, plan, timestamp
✅ Полная OAuth авторизация через Google
✅ Cookie-based аутентификация для сайта (pricing.html)
✅ Token-based для расширения (content.js)
✅ Лимиты 30%/100% на стороне сервера
✅ Export разрешён только для Premium

### Тарифные планы:

**Free ($0):**
- Translate up to 30% of video text
- Basic quality
- No export
- Great way to try the tool

**Pro ($9/month):**
- Translate 100% of subtitles
- Priority processing
- No export

**Premium ($19/month):**
- Translate 100%
- Export in SRT / VTT / TXT
- Priority resources

## Запуск

1. Установить зависимости:
```bash
pip install flask flask-cors openai python-dotenv requests
```

2. Создать .env файл с:
```
OPENAI_API_KEY=your-key
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

3. Запустить сервер:
```bash
python SERVER_TEMPLATE.py
```

4. Загрузить расширение в Chrome:
- Chrome -> Extensions -> Developer mode -> Load unpacked -> выбрать папку `extension/`

## Git ветка
claude/fix-text-truncation-013FZTgzigK5TZaTLthiQeY3

## Последнее обновление
2025-11-20 15:43 UTC

## Важные изменения

### 2025-11-20 15:35 - Восстановление стабильной логики перевода
- Удалена функция getUserPlan() из content.js
- Фиксированный contextSize = 2 для всех планов
- Обновлены тексты тарифов во всех местах
- prevContext.slice(-2) вместо динамического slice(-contextSize)

### 2025-11-20 12:56 - Улучшение feedback формы
- Добавлено сохранение плана пользователя в feedback
- Feedback сохраняется в БД вместо текстового файла
- Таблица feedback с полем plan

### 2025-11-20 - Улучшение лендинга
- Исправлена видимость логотипа "Video Reader AI"
- Обновлены тексты в premium SaaS стиле
- Короткие, конверсионные формулировки
