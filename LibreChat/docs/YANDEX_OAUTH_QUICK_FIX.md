# ⚡ БЫСТРЫЙ СПРАВОЧНИК ИСПРАВЛЕНИЯ YANDEX OAUTH

**TL;DR** (Слишком длинно; не читал)

---

## 🎯 СУТЬ ПРОБЛЕМЫ

```
БЫЛО:  yandex_2031223018@librechat.local  ❌ Фиктивный email
НАДО:  user@yandex.ru                    ✅ Реальный email
```

**Почему произошло:**
- Yandex не вернул email в профиле
- LibreChat создал fallback email вместо прерывания авторизации

**Где это происходит:**
- Файл: `/api/server/controllers/auth/yandex.js`
- Строка: 180 (fallback логика)

---

## ⚙️ КОД ДЛЯ ИСПРАВЛЕНИЯ (3 ВАРИАНТА)

### Вариант 1: БЫСТРОЕ ИСПРАВЛЕНИЕ (1 минута)

**Файл:** `api/server/controllers/auth/yandex.js`

**Найти (строка 180):**
```javascript
const userEmail = yandexUser.default_email || yandexUser.emails?.[0] || `yandex_${yandexUser.id}@librechat.local`;
```

**Заменить на:**
```javascript
const userEmail = yandexUser.default_email || yandexUser.emails?.[0];

if (!userEmail) {
  logger.error(`[Yandex OAuth] User has no email: ${yandexUser.id}`);
  return res.redirect(`${domains.client}/sign-in?error=yandex_no_email&provider=yandex`);
}
```

---

## 🗄️ МИГРАЦИЯ БД (5 МИНУТ)

### Найти проблемные аккаунты

```bash
# Открыть MongoDB
mongo LibreChat

# Найти все @librechat.local аккаунты
db.users.find({ email: /@librechat\.local$/ }).count()
db.users.find({ email: /@librechat\.local$/ }).pretty()
```

### Деактивировать их

```javascript
// MongoDB shell
db.users.updateMany(
  { email: /@librechat\.local$/ },
  {
    $set: {
      deactivated: true,
      deactivatedReason: 'invalid_email_cleanup',
      deactivatedAt: new Date(),
    }
  }
);

// Проверить
db.users.find({ email: /@librechat\.local$/ }).count()  // Должно быть 0 (или старое число)
```

### Или удалить (ОСТОРОЖНО)

```javascript
// ❌ ОПАСНО - потеря данных!
db.users.deleteMany({ email: /@librechat\.local$/ });
```

---

## 🚀 РАЗВЕРТЫВАНИЕ (5 МИНУТ)

### 1. Исправить код

```bash
# Открыть файл
code api/server/controllers/auth/yandex.js

# Изменить строки 179-181 как описано выше
# Сохранить файл
```

### 2. Протестировать локально

```bash
npm run backend:dev          # В терминал 1
npm run frontend:dev         # В терминал 2

# Открыть http://localhost:3090
# Попытаться авторизоваться через Yandex
# Проверить что создается пользователь с РЕАЛЬНЫМ email
```

### 3. Создать commit

```bash
git add api/server/controllers/auth/yandex.js
git commit -m "fix: remove @librechat.local email fallback from Yandex OAuth

- Require valid email from Yandex profile
- Fail gracefully if email is missing
- Add error logging for debugging"
```

### 4. Развернуть

```bash
git push origin main
# На сервере:
npm install && npm run build && npm run start
```

### 5. Применить миграцию

```bash
mongo LibreChat < migration-deactivate-invalid-emails.js
```

---

## 📊 ПОСЛЕ ИСПРАВЛЕНИЯ (ПРОВЕРИТЬ)

```bash
# 1. Новые пользователи имеют корректный email
mongo LibreChat
db.users.find({ provider: 'yandex' }).pretty()
# Результат: все email должны быть user@*.ru (НЕ @librechat.local)

# 2. В логах нет ошибок
tail -f /var/log/librechat.log | grep "Yandex OAuth"

# 3. Авторизация работает
curl http://localhost:3080/oauth/yandex
# Должен быть redirect на https://oauth.yandex.ru/authorize
```

---

## 🆘 ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК

### Проблема: После исправления авторизация вообще не работает

```javascript
// Проверить что code правильно написан
// Убедиться что нет синтаксических ошибок

npm run lint -- api/server/controllers/auth/yandex.js
npm run build
```

### Проблема: Все еще создаются @librechat.local аккаунты

```bash
# 1. Проверить что исправление применено
git diff api/server/controllers/auth/yandex.js

# 2. Перезагрузить сервер
npm run backend:dev  # CTRL+C и заново

# 3. Проверить в браузере консоли (DevTools)
# Должно быть сообщение об ошибке если email отсутствует
```

### Проблема: Yandex все еще не возвращает email

```javascript
// Добавить временное логирование
console.log('Full Yandex profile:', JSON.stringify(yandexUser, null, 2));

// Проверить:
// - Верифицирован ли email в аккаунте Yandex?
// - Правильно ли заполнены YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET?
// - Какой scope установлен при регистрации приложения?
```

---

## 📈 МЕТРИКИ УСПЕХА

| Метрика | До исправления | После исправления |
|---------|---|---|
| Новых @librechat.local аккаунтов/день | 0+ | 0 |
| Ошибок "no email"/день | 0 | 0+ (кратко, потом стабилизация) |
| Авторизаций с корректным email | ? | 100% |
| Жалоб на email | 0+ | 0 |

---

## 🔐 ДВОЙНАЯ ПРОВЕРКА (ОБЯЗАТЕЛЬНО!)

### Перед деплоем

- [ ] Удалены ВСЕ fallback на `@librechat.local`
- [ ] Добавлена проверка `if (!userEmail) { return ... }`
- [ ] Локально протестирована авторизация
- [ ] Протестирована ошибка (нет email)
- [ ] Нет синтаксических ошибок (`npm run lint`)

### После деплоя

- [ ] Новые пользователи имеют корректный email
- [ ] Нет новых @librechat.local аккаунтов
- [ ] Авторизация работает без ошибок
- [ ] Логи показывают информацию о авторизациях
- [ ] Миграция БД применена

---

## 📞 БЫСТРЫЕ КОМАНДЫ

```bash
# Проверить статус исправления
git status

# Показать изменения
git diff api/server/controllers/auth/yandex.js

# Откатить если нужно
git checkout api/server/controllers/auth/yandex.js

# Проверить что нет синтаксических ошибок
npm run lint api/server/controllers/auth/yandex.js

# Построить проект
npm run build

# Запустить сервер (dev)
npm run backend:dev

# Запустить фронтенд (dev)
npm run frontend:dev

# Проверить БД (MongoDB)
mongo LibreChat
db.users.find({ email: /@librechat\.local$/ }).count()
```

---

## ✅ ИТОГОВЫЙ СПИСОК

**Что делать:**

1. ✏️ Исправить код (удалить fallback на @librechat.local) — 2 мин
2. 🧪 Протестировать локально — 5 мин
3. 📝 Создать commit — 1 мин
4. 🚀 Развернуть на сервер — 5 мин
5. 🗄️ Применить миграцию БД — 5 мин
6. ✅ Проверить результаты — 5 мин

**Итого:** ~25 минут от начала до конца

---

**Аудит и исправление готовы!** 🎉

Перейди к `YANDEX_OAUTH_SECURITY_AUDIT.md` для полного анализа.
Перейди к `YANDEX_OAUTH_FIX_IMPLEMENTATION.md` для подробных инструкций.
