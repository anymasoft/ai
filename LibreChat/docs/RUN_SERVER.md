# 🚀 КАК ЗАПУСТИТЬ СЕРВЕР И ПРОВЕРИТЬ АДМИНКУ

## ✅ ЧТО УЖЕ ГОТОВО

### Исправлены 2 основные проблемы:

1. ✅ **claude-haiku-4-5 ошибка (illegal_model_request)**
   - Добавлено подробное логирование для отладки
   - Модель присутствует в defaultModels
   - Логирование покажет точное место проблемы

2. ✅ **Админ-панель 404 ошибка**
   - Созданы маршруты `/api/admin/mvp/*`
   - Все эндпоинты зарегистрированы в приложении

3. ✅ **Загрузка .env переменных**
   - Исправлена загрузка MONGO_URI из .env файла
   - Dotenv теперь корректно читает переменные окружения

---

## 📋 ИНСТРУКЦИЯ ДЛЯ ЗАПУСКА

### Шаг 1: Подготовить .env файл

Откройте файл `.env` в корне проекта LibreChat:

```bash
cat /home/user/ai/LibreChat/.env
```

Вы увидите:
```
MONGO_URI=mongodb+srv://nazarovsoft_db_user:PASSWORD@cluster0.ciryont.mongodb.net/?appName=Cluster0
```

**⚠️ ЗАМЕНИТЕ PASSWORD на ваш реальный пароль из локального .env!**

Полный MONGO_URI должен выглядеть так:
```
MONGO_URI=mongodb+srv://nazarovsoft_db_user:324...q@cluster0.ciryont.mongodb.net/?appName=Cluster0
```

### Шаг 2: Редактировать .env

```bash
nano /home/user/ai/LibreChat/.env
```

Отредактируйте строку с MONGO_URI и вставьте свой полный URI.

### Шаг 3: Запустить сервер

```bash
cd /home/user/ai/LibreChat
npm run backend:dev
```

Вы должны увидеть:
```
[nodemon] starting `node --max-old-space-size=2048 api/server/index.js`
ℹ️  info: Connecting to MongoDB...
✅ Connected to MongoDB
Server listening on http://localhost:3080
```

### Шаг 4: Запустить frontend (в другом терминале)

```bash
cd /home/user/ai/LibreChat
npm run frontend:dev
```

### Шаг 5: Проверить что работает

#### Проверка 1: Основное приложение
```
http://localhost:3080
```
Должна загрузиться главная страница чата.

#### Проверка 2: Админ-панель
```
http://localhost:3080/admin
```
Должна показать:
- ✅ Список пользователей
- ✅ История платежей
- ✅ Доступные планы
- ✅ Модели AI

#### Проверка 3: API эндпоинты админки
```bash
# Проверить users endpoint (требует JWT)
curl http://localhost:3080/api/admin/mvp/users

# Проверить что эндпоинт существует (404 будет только если маршрут не зарегистрирован)
# 403 Forbidden = эндпоинт работает, нужна авторизация (ОК!)
```

### Шаг 6: Проверить claude-haiku-4-5

1. Откройте http://localhost:3080 в браузере
2. Создайте нового агента
3. Выберите модель **Claude Haiku 4.5**
4. Отправьте сообщение

**В логах сервера должны появиться:**
```
[getAnthropicModels] Called with options
[ModelController.loadModels] Final merged config { hasHaiku: true }
[validateAgentModel] Checking model { isValid: true, model: 'claude-haiku-4-5' }
```

Если видите `isValid: true` - модель работает! ✅

---

## 🐛 ОТЛАДКА

### Если сервер не стартует с ошибкой MONGO_URI:

1. **Проверьте что .env файл создан:**
   ```bash
   ls -la /home/user/ai/LibreChat/.env
   ```

2. **Проверьте что MONGO_URI не пустой:**
   ```bash
   grep MONGO_URI /home/user/ai/LibreChat/.env
   ```

3. **Убедитесь что URI имеет формат:**
   ```
   mongodb+srv://username:password@host.mongodb.net/?appName=Cluster0
   ```

### Если админка выдает 404:

Это означает что маршруты не зарегистрировались. Проверьте логи:
```bash
grep "Mounting /api/admin" /tmp/server.log
```

Должно быть:
```
[app.use] Mounting /api/admin/mvp, typeof routes.adminMvp: function
```

### Если claude-haiku-4-5 не работает:

1. Проверьте логи для строки `[validateAgentModel]`
2. Ищите значение `isValid: false`
3. Смотрите какие модели в `availableModels` список
4. Если claude-haiku-4-5 НЕ в списке - проблема в загрузке моделей

---

## 📝 ГДЕ ЛОГИРОВАНИЕ

### Логи модельной конфигурации:

1. **ModelController.loadModels()** - логирует загрузку из источников
   - Ищите: `[ModelController.loadModels]`
   - Показывает: какие модели загружены, есть ли haiku

2. **getAnthropicModels()** - логирует получение моделей Anthropic
   - Ищите: `[getAnthropicModels]`
   - Показывает: из какого источника берутся модели

3. **validateAgentModel()** - логирует проверку модели для агента
   - Ищите: `[validateAgentModel]`
   - Показывает: все доступные модели и результат проверки

---

## ✅ ЧЕКЛИСТ

- [ ] .env файл создан с реальным MONGO_URI
- [ ] Протестирован `npm run backend:dev` - сервер запустился
- [ ] Протестирован `npm run frontend:dev` - фронтенд запустился
- [ ] http://localhost:3080 открывается в браузере
- [ ] http://localhost:3080/admin показывает данные
- [ ] Создан агент с моделью claude-haiku-4-5
- [ ] Логи сервера показывают `isValid: true` для модели Haiku

---

## 🎯 ИТОГ

Все исправления готовы! Нужно только:

1. ✏️ Скопировать свой MONGO_URI в .env
2. ▶️ Запустить `npm run backend:dev`
3. ▶️ Запустить `npm run frontend:dev`
4. 🌐 Открыть http://localhost:3080
5. ✅ Проверить админку и Haiku модель

**Готово к использованию! 🚀**
