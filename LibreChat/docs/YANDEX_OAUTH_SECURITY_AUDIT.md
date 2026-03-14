# 🔍 АУДИТ OAUTH АВТОРИЗАЦИИ YANDEX В LIBRECHAT

**Дата аудита:** 13 марта 2026
**Версия приложения:** v0.8.3-rc1 (RepliqAI)
**Статус:** ⚠️ КРИТИЧЕСКАЯ УЯЗВИМОСТЬ ОБНАРУЖЕНА

---

## 📌 РЕЗЮМЕ ПРОБЛЕМЫ

В базе данных LibreChat появляются пользователи с фиктивными email вида:
```
yandex_2031223018@librechat.local
yandex_1234567890@librechat.local
```

**Ожидается:** Реальный email Яндекса (напр. `user@yandex.ru`)
**Получается:** Служебный @librechat.local email

**Причина:** Наличие fallback логики, которая создает фиктивный email если Yandex не вернул настоящий email.

---

## 🎯 ШАГ 1: РЕАЛИЗАЦИЯ YANDEX OAUTH В КОДЕ

### Архитектура решения

Проект использует **собственную реализацию** Yandex OAuth **БЕЗ Passport.js**:

```
OAuth Flow (Без Passport):
┌─────────────────────────────────────────────────────────────┐
│ 1. GET /oauth/yandex                                        │
│    ↓ (yandexOAuthRedirect в yandex.js)                      │
│ 2. Генерируем state (криптографически стойкий)              │
│ 3. Сохраняем в httpOnly cookie (oauth_state_yandex)         │
│ 4. Redirect на https://oauth.yandex.ru/authorize            │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   Пользователь авторизуется на Yandex
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. GET /oauth/yandex/callback?code=...&state=...            │
│    ↓ (yandexOAuthCallback в yandex.js)                      │
│ 6. Проверяем state из cookie vs параметра (CSRF защита)     │
│ 7. Обмениваем code на access_token                          │
│ 8. Запрашиваем профиль через https://login.yandex.ru/info  │
│ 9. Создаем/находим пользователя                            │
│ 10. Устанавливаем auth tokens                               │
└─────────────────────────────────────────────────────────────┘
```

### Ключевые файлы

| Файл | Назначение | Проблема |
|------|-----------|---------|
| `/api/server/controllers/auth/yandex.js` | Основная логика OAuth callback | ⚠️ Строка 180 - fallback на @librechat.local |
| `/api/strategies/yandexStrategy.js` | Стратегия OAuth (не используется) | ❌ Мертвый код |
| `/api/server/routes/oauth.js` | Маршруты OAuth | ✅ Правильно настроен |
| `/api/server/socialLogins.js` | Конфигурация провайдеров | ✅ Только Yandex активен |

---

## 🔴 ШАГ 2: КРИТИЧЕСКАЯ ЛОГИКА - СОЗДАНИЕ @librechat.local EMAIL

### Точное место проблемы

**Файл:** `/api/server/controllers/auth/yandex.js`
**Строка:** 180

```javascript
// ❌ ПРОБЛЕМНАЯ ЛОГИКА
const userEmail = yandexUser.default_email || yandexUser.emails?.[0] || `yandex_${yandexUser.id}@librechat.local`;
```

### Анализ fallback логики

```
┌─ Проверить yandexUser.default_email
│  ├─ Найден? → Используем его
│  └─ Не найден? ↓
├─ Проверить yandexUser.emails?.[0]
│  ├─ Найден? → Используем его
│  └─ Не найден? ↓
└─ FALLBACK: Генерируем yandex_${yandexUser.id}@librechat.local
   ⚠️ ЗДЕСЬ ПРОБЛЕМА!
```

### Что происходит дальше (строки 206-210)

```javascript
user = await createUser({
  email: userEmail,              // ← Может быть yandex_2031223018@librechat.local
  username: username,            // ← yandex login из profile
  name: userName,
});
```

Пользователь создается с фиктивным email в базе данных.

---

## 📊 ШАГ 3: АНАЛИЗ ДАННЫХ ОТ YANDEX API

### Что должно возвращать Yandex API

При успешной авторизации Yandex возвращает профиль:

```json
{
  "id": "2031223018",
  "login": "username",
  "display_name": "User Name",
  "real_name": "Реальное Имя",
  "default_email": "user@yandex.ru",          // ← ОЖИДАЕМО
  "emails": [
    "user@yandex.ru",
    "alternate@yandex.ru"
  ],
  "default_avatar_id": "abc123",
  "birthday": "1990-01-01",
  "is_avatar_empty": false
}
```

### Почему email может отсутствовать

**Сценарий 1: Пользователь не верифицировал email в Яндексе**
- Yandex может вернуть профиль БЕЗ `default_email`
- Массив `emails` может быть пустым

**Сценарий 2: Неправильные scopes или разрешения**
- Приложение не запросило разрешение на доступ к email
- Yandex скрывает email в ответе

**Сценарий 3: Старый API или изменения в Yandex**
- API мог измениться, структура данных отличается

### Текущие scopes

В `yandexStrategy.js` (строка 43):
```javascript
// Не используем scope для Yandex - права конфигурируются при регистрации приложения
options.skipUserProfile = false;
```

**ПРОБЛЕМА:** Проект не явно запрашивает `login:email` scope!
В комментарии сказано "права конфигурируются при регистрации приложения", но это не гарантирует возврат email.

---

## 🔐 ШАГ 4: ПРОВЕРКА ПОЛУЧЕНИЯ EMAIL ОТ YANDEX

### Как LibreChat обрабатывает ответ

**В `/api/server/controllers/auth/yandex.js` (строки 160-177):**

```javascript
// Шаг 5: Получаем профиль пользователя
const userInfoResponse = await fetch('https://login.yandex.ru/info', {
  headers: {
    Authorization: `OAuth ${accessToken}`,    // ← Правильный формат Yandex
    'Content-Type': 'application/json',
  },
});

if (!userInfoResponse.ok) {
  // Обработка ошибки
  return res.redirect(...);
}

const yandexUser = await userInfoResponse.json();  // ← Получаем профиль
```

**Правильно ли? Да**, но:
- Не проверяется наличие email в ответе
- Нет валидации структуры данных
- Нет логирования того, какие поля присутствуют

---

## ⚠️ ШАГ 5: ПОЧЕМУ СОЗДАЕТСЯ @librechat.local

### Сценарий возникновения

```
1. Пользователь нажимает "Sign in with Yandex"
   ↓
2. LibreChat отправляет пользователя на oauth.yandex.ru
   ↓
3. Пользователь авторизуется
   ↓
4. Yandex редиректит на /oauth/yandex/callback?code=...&state=...
   ↓
5. LibreChat обменивает code на access_token
   ↓
6. LibreChat запрашивает профиль: GET https://login.yandex.ru/info
   ↓
7. ✅ Получает профиль, но:
   - default_email === undefined или null
   - emails === [] (пустой массив или undefined)
   ↓
8. ❌ FALLBACK СРАБАТЫВАЕТ:
   userEmail = `yandex_${yandexUser.id}@librechat.local`
   ↓
9. Создается пользователь в БД с фиктивным email
```

---

## 🚨 РИСКИ И ПОСЛЕДСТВИЯ

### 1. Невозможно связаться с пользователем
- Email `yandex_2031223018@librechat.local` не существует
- Невозможно отправить уведомления
- Невозможно восстановить пароль

### 2. Проблемы с нарушением регулирования
- GDPR требует идентификации пользователей
- Фиктивные email нарушают требования данных
- Невозможно удалить данные пользователя по email

### 3. Дублирование аккаунтов
- Пользователь может авторизоваться несколько раз
- Создается новый аккаунт с новым ID Yandex
- Прошлые данные теряются

### 4. Проблемы аудита и логирования
- Список пользователей неверен
- Невозможно отследить, какой пользователь владеет аккаунтом

---

## ✅ ШАГ 6: РЕКОМЕНДУЕМОЕ РЕШЕНИЕ

### Вариант 1: Требовать email (РЕКОМЕНДУЕТСЯ)

Если email отсутствует - прервать авторизацию:

```javascript
// Строка 179-181 в yandex.js
const userEmail = yandexUser.default_email || yandexUser.emails?.[0];

// ✅ ДОБАВИТЬ ПРОВЕРКУ
if (!userEmail) {
  logger.error(
    `[Yandex OAuth] User ${yandexUser.id} (${yandexUser.login}) has no email in profile`
  );
  return res.redirect(
    `${domains.client}/sign-in?error=yandex_no_email&provider=yandex`
  );
}

// УДАЛИТЬ FALLBACK:
// ❌ const userEmail = ... || `yandex_${yandexUser.id}@librechat.local`;
```

### Вариант 2: Запросить email явно

Изменить запрос профиля:

```javascript
// ДОБАВИТЬ ПАРАМЕТР ЗАПРОСА
const userInfoResponse = await fetch(
  'https://login.yandex.ru/info?format=json',  // ← format=json явно
  {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
);
```

### Вариант 3: Добавить валидацию структуры

```typescript
interface YandexProfile {
  id: string;
  login: string;
  default_email?: string;
  emails?: string[];
  display_name?: string;
  real_name?: string;
}

const isValidYandexProfile = (profile: any): profile is YandexProfile => {
  return typeof profile.id === 'string' && typeof profile.login === 'string';
};

// В коде:
if (!isValidYandexProfile(yandexUser)) {
  throw new Error('Invalid Yandex profile structure');
}

if (!yandexUser.default_email && (!yandexUser.emails || yandexUser.emails.length === 0)) {
  throw new Error('Yandex profile has no email');
}
```

---

## 🔧 ШАГ 7: РЕАЛИЗАЦИЯ ИСПРАВЛЕНИЯ

### Безопасная реализация

**Файл:** `/api/server/controllers/auth/yandex.js`

**БЫЛО (строки 179-181):**
```javascript
const userEmail = yandexUser.default_email || yandexUser.emails?.[0] || `yandex_${yandexUser.id}@librechat.local`;
const userName = yandexUser.display_name || yandexUser.real_name || yandexUser.login || 'Yandex User';
```

**СТАЛО:**
```javascript
// Проверяем наличие email - ОБЯЗАТЕЛЬНО
const userEmail = yandexUser.default_email || yandexUser.emails?.[0];

if (!userEmail) {
  console.error(`[Yandex OAuth] No email found in profile for user: ${yandexUser.id} (${yandexUser.login})`);
  console.error(`[Yandex OAuth] Profile data:`, {
    id: yandexUser.id,
    login: yandexUser.login,
    default_email: yandexUser.default_email,
    emails: yandexUser.emails,
  });

  logger.error(
    `[Yandex OAuth] Authentication failed - user has no email in Yandex profile. ` +
    `Please ensure email is verified in Yandex account settings.`,
  );

  return res.redirect(
    `${domains.client}/sign-in?error=yandex_profile_incomplete&provider=yandex&message=no_email`
  );
}

const userName = yandexUser.display_name || yandexUser.real_name || yandexUser.login || 'Yandex User';
```

### Места внесения изменений

| Место | Действие |
|-------|---------|
| Строка 179 | Удалить fallback на @librechat.local |
| Строка 180 (новая) | Добавить проверку email !== undefined && email !== null |
| Строка 181+ (новые) | Добавить логирование отсутствия email |
| Строка 185+ (новые) | Добавить redirect с ошибкой |

---

## 📋 ШАГ 8: МИГРАЦИЯ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ

### Найти пользователей с @librechat.local

```javascript
// Скрипт для поиска
db.users.find({ email: /@librechat\.local$/ })
```

Ожидается: несколько документов вида `yandex_*@librechat.local`

### Вариант 1: Удалить некорректные аккаунты (СТРОГИЙ)

```javascript
db.users.deleteMany({ email: /@librechat\.local$/ });
```

**Минусы:** Потеря данных истории чатов
**Плюсы:** Чистая база данных

### Вариант 2: Деактивировать аккаунты (МЯГКИЙ)

```javascript
db.users.updateMany(
  { email: /@librechat\.local$/ },
  {
    $set: {
      deactivated: true,
      deactivatedReason: 'librechat_local_email_cleanup',
      deactivatedDate: new Date(),
    }
  }
);
```

**Минусы:** Остаются неиспользуемые аккаунты
**Плюсы:** Возможность восстановления данных

### Вариант 3: Попытка восстановить email (СЛОЖНЫЙ)

Если у вас есть логи или дополнительная информация о пользователях:

```javascript
// Например, если есть связь с Yandex ID
db.users.updateMany(
  { email: /@librechat\.local$/ },
  [
    {
      $set: {
        email: {
          $concat: [
            { $substr: ["$email", 8, { $strLenCP: "$email" }] },  // Извлечь ID из yandex_ID@librechat.local
            "@yandex.ru"
          ]
        }
      }
    }
  ]
);
```

### Рекомендация

**Вариант 2 (Деактивировать)** является оптимальным:
- ✅ Безопасен (не теряются данные)
- ✅ Обратим (можно восстановить)
- ✅ Соответствует GDPR (сохраняет историю)

---

## 📝 ДЕЙСТВИЯ ДЛЯ ИСПРАВЛЕНИЯ

### Непосредственные действия

1. **Исправить код** (`/api/server/controllers/auth/yandex.js`)
   - Удалить fallback на @librechat.local
   - Добавить проверку email и выбросить ошибку если email отсутствует
   - Добавить логирование

2. **Протестировать**
   ```bash
   npm run frontend:dev
   # Попытаться авторизоваться через Yandex
   # Проверить логи
   ```

3. **Развернуть** в production

### Последующие действия

4. **Мониторинг**
   - Следить за логами ошибок `yandex_profile_incomplete`
   - Проверить что новые пользователи создаются с реальными email

5. **Миграция**
   ```javascript
   // Скрипт миграции
   db.users.updateMany(
     { email: /@librechat\.local$/ },
     { $set: { deactivated: true, deactivatedReason: 'librechat_local_email_cleanup' } }
   );
   ```

6. **Документирование**
   - Обновить документацию Yandex OAuth
   - Добавить требование верификации email в Яндексе

---

## 🔒 ДОПОЛНИТЕЛЬНЫЕ МЕРЫ БЕЗОПАСНОСТИ

### 1. Логирование всех OAuth операций

Добавить структурированное логирование:

```javascript
console.log(`[OAUTH_CHECKPOINT] YANDEX_PROFILE_RECEIVED`, {
  userId: yandexUser.id,
  login: yandexUser.login,
  hasDefaultEmail: !!yandexUser.default_email,
  emailsCount: yandexUser.emails?.length ?? 0,
  timestamp: new Date().toISOString(),
});
```

### 2. Добавить валидацию на уровне базы данных

```javascript
// В модели User
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Запретить @librechat.local для Yandex пользователей
        if (this.provider === 'yandex' && v.includes('@librechat.local')) {
          throw new Error('Yandex users must have valid email addresses');
        }
        return true;
      },
    },
  },
});
```

### 3. Мониторинг в production

```javascript
// Отправлять алерты если появляются @librechat.local пользователи
if (userEmail.includes('@librechat.local')) {
  sendAlert('Detected @librechat.local user creation', {
    email: userEmail,
    provider: 'yandex',
    timestamp: new Date(),
  });
}
```

---

## ✅ ИТОГОВЫЙ ЧЕКЛИСТ

| Пункт | Статус | Примечание |
|-------|--------|-----------|
| Найдена причина @librechat.local | ✅ | Fallback на строке 180 |
| Найдено место в коде | ✅ | `/api/server/controllers/auth/yandex.js` |
| Предложено решение | ✅ | Требовать email или ошибка |
| Предложена миграция | ✅ | Деактивировать старые аккаунты |
| Предложены меры безопасности | ✅ | Логирование и валидация |

---

## 📞 ЗАКЛЮЧЕНИЕ

**Проблема:** Fallback логика создает фиктивные email при их отсутствии в профиле Yandex.

**Решение:** Прервать авторизацию если email отсутствует вместо создания @librechat.local.

**Риск:** Высокий - нарушаются основные требования приложения (связь с пользователем).

**Статус:** Требует немедленного исправления.

---

**Аудит завершен:** 13.03.2026
**Тип:** Безопасность OAuth, управление пользователями
**Уровень серьезности:** 🔴 КРИТИЧЕСКИЙ
