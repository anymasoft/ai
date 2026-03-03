# 🚀 КАК ЗАПУСТИТЬ LIBRECHAT

## 📋 ДВА СПОСОБА ЗАПУСКА

Вам больше НЕ нужно открывать кучу терминалов! Выберите один из двух скриптов:

---

## 1️⃣ **PRODUCTION MODE** - Быстрый одиночный запуск

**Файл:** `start.bat`

**Что делает:**
1. ✅ Проверяет .env (создает если нет)
2. ✅ Проверяет MONGO_URI заполнена
3. ✅ Устанавливает зависимости если нужно
4. ✅ Собирает backend пакеты
5. ✅ Собирает frontend один раз
6. ✅ Запускает сервер на localhost:3080

**Как использовать:**
```bash
# Windows
double-click start.bat

# Или в командной строке
start.bat
```

**Результат:**
- ✅ Открывается одно окно с backend сервером
- ✅ Frontend уже собран и сервируется с backend
- ✅ Просто откройте http://localhost:3080 в браузере

**Когда использовать:**
- 👍 Для тестирования приложения
- 👍 Для production режима
- 👍 Когда не нужна горячая перезагрузка

---

## 2️⃣ **DEVELOPMENT MODE** - С горячей перезагрузкой

**Файл:** `start-dev.bat`

**Что делает:**
1. ✅ Проверяет .env (создает если нет)
2. ✅ Проверяет зависимости
3. ✅ Собирает пакеты
4. ✅ **Запускает BACKEND в отдельном окне** (с горячей перезагрузкой)
5. ✅ **Запускает FRONTEND в отдельном окне** (с горячей перезагрузкой)

**Как использовать:**
```bash
# Windows
double-click start-dev.bat

# Или в командной строке
start-dev.bat
```

**Результат:**
- ✅ Открывается **2 окна** (Backend + Frontend)
- ✅ Backend на http://localhost:3080
- ✅ Frontend dev server на http://localhost:5173 (если используется Vite)
- ✅ Любое изменение кода автоматически перезагружает страницу

**Когда использовать:**
- 👍 Для разработки и отладки
- 👍 Когда часто меняете код
- 👍 Для проверки изменений в реальном времени

---

## ⚠️ ВАЖНО: MONGO_URI

**ДО первого запуска** отредактируйте `.env` файл в корне проекта:

```bash
nano .env
# или
notepad .env
```

Найдите строку:
```
MONGO_URI=mongodb+srv://nazarovsoft_db_user:PASSWORD@cluster0.ciryont.mongodb.net/?appName=Cluster0
```

**Замените PASSWORD на ваш реальный пароль**

Полный URI должен выглядеть:
```
MONGO_URI=mongodb+srv://nazarovsoft_db_user:324...q@cluster0.ciryont.mongodb.net/?appName=Cluster0
```

---

## 🔍 ЧТО ПРОВЕРИТЬ ПОСЛЕ ЗАПУСКА

### Production Mode (start.bat):
```
✅ Откройте http://localhost:3080 в браузере
✅ Должна загрузиться главная страница чата
✅ Перейдите на http://localhost:3080/admin - админка должна работать
```

### Development Mode (start-dev.bat):
```
✅ Backend окно должно показать "Server listening on http://localhost:3080"
✅ Frontend окно должно показать "Local: http://localhost:5173"
✅ Откройте http://localhost:3080 в браузере
✅ Попробуйте отредактировать файл в клиенте - должна обновиться в реальном времени
```

---

## 🆘 ЕСЛИ ОШИБКА

### Ошибка: "MONGO_URI не заполнена"
```
⚠️ Отредактируйте .env файл и вставьте свой реальный MongoDB URI
```

### Ошибка: "Port 3080 already in use"
```
1. Закройте предыдущий запуск LibreChat
2. Или измените PORT в .env на другой (например PORT=3081)
3. Перезапустите скрипт
```

### Ошибка: "npm command not found"
```
1. Установите Node.js с https://nodejs.org/
2. Перезагрузитесь
3. Попробуйте снова
```

### Frontend не загружается
```
1. Проверьте что npm run build:client успешно завершилась
2. Проверьте что папка client/dist существует и содержит index.html
3. Перезапустите start.bat
```

---

## 📊 ФАЙЛЫ И ПАПКИ

```
LibreChat/
├── start.bat              ← Для production/простого запуска
├── start-dev.bat          ← Для development с горячей перезагрузкой
├── .env                   ← КОНФИГУРАЦИЯ (отредактируйте!)
├── api/                   ← Backend код
│   ├── server/
│   │   ├── index.js       ← Главный файл сервера
│   │   └── routes/        ← API маршруты
│   └── ...
├── client/                ← Frontend код
│   ├── src/               ← React компоненты
│   └── dist/              ← Собранный фронтенд
├── packages/              ← NPM пакеты
│   ├── api/
│   ├── client/
│   └── data-provider/
└── ...
```

---

## 🎯 БЫСТРЫЙ СТАРТ

### За 2 минуты:

1. **Отредактируйте .env:**
   ```bash
   notepad .env
   # Вставьте свой MONGO_URI
   ```

2. **Запустите start.bat:**
   ```bash
   double-click start.bat
   ```

3. **Откройте браузер:**
   ```
   http://localhost:3080
   ```

**✅ Готово! LibreChat работает!**

---

## 🚀 ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ

Если нужно что-то отдельное:

```bash
# Только установить зависимости
npm install

# Только собрать пакеты
npm run build:packages

# Только собрать фронтенд
npm run build:client

# Только запустить backend (dev с горячей перезагрузкой)
npm run backend:dev

# Только запустить frontend (dev с горячей перезагрузкой)
npm run frontend:dev

# Запустить в production режиме
npm run backend
npm run build && npm run backend
```

---

**Выберите скрипт и просто запустите! 🎉**
