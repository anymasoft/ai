# 🔍 Диагностика ошибки "argument handler must be a function"

## Что произошло?

Ошибка `argument handler must be a function` означает что **какой-то middleware или route не является функцией** при использовании в `app.use()`.

## Как диагностировать

### 1️⃣ Способ 1: Запустить с обычным start.bat
```bash
start.bat
```

Посмотреть в логе что в последних строках ДО ошибки. Логирование показывает какие middleware регистрируются.

### 2️⃣ Способ 2: Запустить с debug логированием
```bash
run-debug.bat
```

Это добавляет:
- `--trace-uncaught` - показывает точную ошибку
- `--trace-warnings` - показывает все warnings

### 3️⃣ Способ 3: Проверить консоль браузера
После запуска сервера откройте http://localhost:3080 и посмотрите в консоль браузера (F12).

## Вероятные причины

### ✅ Проверено как КОРРЕКТНОЕ:
- ✅ `ErrorController` - экспортируется как функция
- ✅ `routes.payment` - экспортируется как function
- ✅ `routes.staticRoute` - экспортируется как express.Router()
- ✅ Node.js heap size - 2GB (установлен в package.json)
- ✅ Все middleware - регистрируются корректно

### ❓ Возможные проблемы:

1. **Файл не может быть загружен**
   - Проверить что все файлы существуют
   - Проверить права доступа на файлы

2. **Версия пакета неправильная**
   - Попробовать `npm install` еще раз
   - Удалить `node_modules` и пересобрать

3. **Кэш Node.js**
   - Удалить `.node-gyp` папку
   - Удалить `package-lock.json` и переустановить

## Шаги исправления

1. **Очистить всё:**
   ```bash
   rmdir /s /q node_modules  (Windows)
   rm -rf node_modules        (Linux/Mac)
   ```

2. **Переустановить:**
   ```bash
   npm install
   npm run build:packages
   npm run build:client
   ```

3. **Запустить:**
   ```bash
   start.bat
   ```

## Если всё ещё не работает

Запустить debug версию и показать **ПОЛНЫЙ лог ошибки**:

```bash
run-debug.bat 2>&1 | tee output.log
```

Файл `output.log` содержит полный лог для диагностики.

---

**Ошибка находится в процессе инициализации, когда Node.js пытается подключить middleware в Express.**
