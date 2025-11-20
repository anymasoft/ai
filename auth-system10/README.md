# Video Reader AI - Полная копия проекта

## Структура проекта

### Серверные файлы:
- `SERVER_TEMPLATE.py` - Основной сервер с полной функциональностью
- `SERVER_PRODUCTION.py` - Production версия сервера
- `server.py` - Ссылка/символическая ссылка на актуальный сервер
- `translations.db` - БД с переводами
- `users.db` - БД с пользователями и feedback

### Расширение (extension/):
- `manifest.json` - Манифест Chrome расширения
- `content.js` - Content script (внедряется в YouTube)
- `background.js` - Service worker
- `auth.html/js/css` - Страница авторизации
- `pricing.html/js/css` - Страница тарифов с формой feedback
- `styles.css` - Общие стили для расширения
- `flags.js` - Флаги языков
- `checkout_*.html` - Страницы оформления подписки
- `assets/logo.png` - Логотип

## Ключевые особенности текущей версии

### Feedback форма (pricing.html/js):
✅ Премиальные бледные toasts (без эмодзи)
  - Success: bg-green-50, text-green-800, border-green-200
  - Error: bg-rose-50, text-rose-800, border-rose-200
✅ Плавная анимация с requestAnimationFrame
✅ Автозаполнение email для авторизованных пользователей
✅ Отправка в БД через POST /api/feedback
✅ Удален элемент feedback-status (используется showNotification)

### Сервер:
✅ Роут /api/feedback для приема обратной связи
✅ Таблица feedback в users.db
✅ Полная OAuth авторизация через Google
✅ Cookie-based аутентификация для сайта
✅ Token-based для расширения

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
- Chrome -> Extensions -> Load unpacked -> выбрать папку `extension/`

## Дата создания копии
2025-11-20 10:43 UTC

## Актуальная ветка Git
claude/fix-text-truncation-013FZTgzigK5TZaTLthiQeY3
