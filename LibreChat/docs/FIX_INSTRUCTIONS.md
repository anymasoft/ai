# 🔧 **ПОЛНАЯ ИНСТРУКЦИЯ ПО ИСПРАВЛЕНИЮ ОШИБКИ**

## Анализ проблемы

Ошибка `argument handler must be a function` происходит потому что **один из middleware при подключении в Express не является функцией**.

Это может быть:
1. ❌ Require не загружает модуль правильно
2. ❌ Модуль экспортирует не функцию
3. ❌ Пакет @librechat/api не был пересобран после изменений

## Решение: Полная пересборка

### **Шаг 1: Полная очистка**

```bash
# Удалить node_modules и cache
rmdir /s /q node_modules
del package-lock.json

# Удалить собранные пакеты
rmdir /s /q packages\api\dist
rmdir /s /q packages\api\node_modules
```

### **Шаг 2: Переустановка зависимостей**

```bash
# Установить все зависимости с нуля
npm install

# Очень важно! Пересобрать локальные пакеты
npm run build:packages

# Собрать клиентскую часть
npm run build:client
```

### **Шаг 3: Проверка перед запуском**

```bash
# Проверить что middleware загружаются как функции
node -e "const m = require('./api/server/middleware/ensureBalance'); console.log('ensureBalance:', typeof m);"
node -e "const m = require('./api/server/middleware/checkSubscription'); console.log('checkSubscription:', typeof m);"
node -e "const m = require('./api/server/middleware/checkSpecAllowedForPlan'); console.log('checkSpecAllowedForPlan:', typeof m);"
```

Все должны быть `'function'`.

### **Шаг 4: Запуск сервера**

```bash
# Запустить с DEBUG информацией
npm run backend:dev

# ИЛИ с полным логированием
start run-debug.bat
```

## Если после этого ВСЁ РАВНО ошибка

1. **Скопируй ПОЛНЫЙ лог ошибки** - от запуска до crash'а
2. **Проверь что выводится ДО ошибки:**
   - Загрузка конфига ✅
   - Логирование middleware
   - Точное сообщение об ошибке

3. **Скажи в каком точно middleware падает:**
   - convos.js?
   - messages.js?
   - agents/index.js?
   - Или кто-то другой?

## Файлы с диагностикой

✅ **Диагностические проверки добавлены в:**
- `api/server/routes/convos.js` - проверка типов middleware
- `api/server/routes/messages.js` - проверка типов middleware
- `api/server/routes/agents/index.js` - проверка типов middleware

Если проблема существует - сервер выведет ТОЧНУЮ ошибку какой именно middleware не функция.

---

**Попробуй шаги и дай мне полный лог ошибки!** 🚀
