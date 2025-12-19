# Архитектура VPN Manager

## 🏗️ Общий обзор

VPN Manager состоит из трёх основных компонентов:

```
┌─────────────────────────────────────────────────────────────┐
│                    Браузер пользователя                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │        VPN Manager Browser Extension                  │   │
│  │  (Popup, Background Worker, Content Scripts)          │   │
│  └────────────────┬─────────────────────────────────────┘   │
└─────────────────────┼──────────────────────────────────────┘
                      │ HTTPS API
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Backend Server (Flask)                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Authentication | Proxy Management | Statistics    │     │
│  │  Database | Logging | Admin Panel                  │     │
│  └────────────┬───────────────────┬────────────────────┘     │
└─────────────────┼──────────────────┼─────────────────────────┘
                  │                  │
                  ▼                  ▼
        ┌──────────────────┐  ┌──────────────────┐
        │   SQLite DB      │  │  Proxy Servers   │
        │  (Users, Logs)   │  │  (Tinyproxy,    │
        │                  │  │  Squid, etc.)    │
        └──────────────────┘  └──────────────────┘
```

---

## 📱 Frontend (Browser Extension)

### Структура:

```
extension/
├── manifest.json              # Конфигурация расширения
├── popup.html/css/js          # Главный интерфейс пользователя
├── background.js              # Service Worker (система управления)
├── content.js                 # Content Script (инжекция в страницы)
├── assets/
│   ├── logo.png
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
└── admin/
    ├── admin.html/css/js      # Админ-панель
    ├── admin-login.html/css/js # Вход админа
```

### Компоненты:

#### 1. **manifest.json**
- Определяет поведение расширения
- Запрашивает необходимые permissions
- Определяет иконки и метаинформацию

#### 2. **popup.html/js** (UI пользователя)
- Простой интерфейс для обычного пользователя
- Toggle для включения/выключения VPN
- Выбор локации из списка
- Показ текущего IP и статуса
- Кнопка для входа в админ-панель

**Поток данных:**
```
popup.js → API (GET /api/proxies)
         → API (POST /api/vpn/toggle)
         → API (POST /api/vpn/location)
         → chrome.storage.local (сохранение данных)
```

#### 3. **background.js** (Service Worker)
- Управляет proxy settings браузера
- Слушает сообщения от popup
- Применяет/удаляет прокси конфигурацию
- Ведёт здоровье-чек сервера
- Обработка автоподключения

**Основные функции:**
```javascript
- handleToggleVPN()      // Включить/выключить VPN
- connectVPN()           // Применить прокси
- disconnectVPN()        // Убрать прокси
- applyProxySettings()   // Установить параметры прокси в браузер
- removeProxySettings()  // Убрать параметры прокси
```

#### 4. **content.js** (Content Script)
- Инжектируется на все страницы
- Предоставляет API странице через window объект
- Уведомляет о смене статуса VPN

**API для веб-страниц:**
```javascript
window.VPNInfo = {
    isActive: boolean,
    getCurrentLocation: function()
}

window.addEventListener('vpnStatusChanged', function(e) {
    // e.detail.enabled - статус VPN
    // e.detail.location - текущая локация
})
```

#### 5. **admin.html/js** (Админ-панель)
- Полный контроль над системой
- Управление прокси (CRUD)
- Управление пользователями
- Просмотр статистики
- Просмотр логов

---

## 🖥️ Backend (Flask)

### Структура:

```
backend/
├── server.py          # Flask приложение и маршруты
├── database.py        # Работа с SQLite БД
├── config.py          # Конфигурация и переменные окружения
├── requirements.txt   # Python зависимости
└── .env              # Переменные окружения
```

### Компоненты:

#### 1. **server.py** - Flask приложение

**Группы маршрутов:**

```
1. Health Check
   GET /api/health

2. Аутентификация
   POST /api/admin/login
   GET  /api/admin/verify-token

3. VPN Operations
   POST /api/vpn/toggle
   POST /api/vpn/connect
   POST /api/vpn/location
   GET  /api/speed-test

4. Прокси (публичные)
   GET /api/proxies
   GET /api/proxies/<id>

5. Прокси (админ)
   GET    /api/admin/proxies
   POST   /api/admin/proxies
   GET    /api/admin/proxies/<id>
   PUT    /api/admin/proxies/<id>
   DELETE /api/admin/proxies/<id>

6. Пользователи (админ)
   GET /api/admin/users
   GET /api/admin/users/<id>
   PUT /api/admin/users/<id>

7. Статистика (админ)
   GET /api/admin/statistics

8. Параметры (админ)
   GET  /api/admin/settings
   POST /api/admin/settings

9. Логи (админ)
   GET    /api/admin/logs
   DELETE /api/admin/logs
```

#### 2. **database.py** - SQLite ORM

**Таблицы:**

```sql
-- Администраторы
admins (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT (sha256),
    name TEXT,
    email TEXT,
    created_at TIMESTAMP
)

-- Прокси
proxies (
    id TEXT PRIMARY KEY,
    name TEXT,
    country TEXT,
    host TEXT,
    port INTEGER,
    type TEXT (HTTP/HTTPS/SOCKS5),
    username TEXT (optional),
    password TEXT (optional),
    status TEXT (active/inactive),
    users_count INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)

-- Пользователи
users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    status TEXT (active/inactive/banned),
    selected_proxy_id TEXT,
    traffic_used INTEGER (bytes),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)

-- Логи
logs (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    admin_id TEXT,
    action TEXT,
    details TEXT,
    level TEXT (info/warn/error/debug),
    timestamp TIMESTAMP
)

-- Параметры системы
settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP
)
```

#### 3. **config.py** - Конфигурация

Поддерживает три окружения:
- **Development:** DEBUG=true
- **Production:** DEBUG=false
- **Testing:** In-memory БД

**Ключевые параметры:**
```python
JWT_SECRET_KEY          # Секретный ключ для JWT токенов
MAX_USERS_PER_PROXY     # Макс. пользователей на прокси
DEFAULT_PROXY_TIMEOUT   # Таймаут подключения
MAX_BANDWIDTH           # Ограничение пропускной способности
ENABLE_LOGGING          # Логирование
ENABLE_AUTO_BACKUP      # Автоматическое резервное копирование
```

---

## 🔐 Аутентификация и авторизация

### JWT (JSON Web Tokens)

```
1. Админ вводит username/password
   ↓
2. Backend проверяет в БД
   ↓
3. Если верно - создаёт JWT токен
   ↓
4. Токен отправляется клиенту
   ↓
5. Клиент сохраняет в localStorage
   ↓
6. В каждом запросе отправляет:
   Authorization: Bearer <token>
   ↓
7. Backend проверяет подпись токена
   ↓
8. Если валидный - обрабатывает запрос
```

**JWT структура:**
```
Header.Payload.Signature

Header:    { "alg": "HS256", "typ": "JWT" }
Payload:   { "sub": "admin_id", "role": "admin", "exp": 1234567890 }
Signature: HMACSHA256(base64(header) + base64(payload), SECRET)
```

---

## 🔗 Взаимодействие компонентов

### Сценарий 1: Подключение VPN

```
1. Пользователь нажимает toggle в popup
   ↓
2. popup.js отправляет POST /api/vpn/toggle {enabled: true}
   ↓
3. Background.js получает сообщение
   ↓
4. Запрашивает выбранный прокси из storage
   ↓
5. Отправляет POST /api/vpn/connect {locationId}
   ↓
6. Backend возвращает прокси детали
   ↓
7. Background.js применяет прокси в браузер
   ↓
8. chrome.proxy.settings.set() применяет конфиг
   ↓
9. Popup обновляет UI (status, IP)
   ↓
10. Все новые соединения идут через прокси
```

### Сценарий 2: Добавление нового прокси (админ)

```
1. Админ открывает админ-панель (admin.html)
   ↓
2. Вводит username/password
   ↓
3. admin-login.js отправляет POST /api/admin/login
   ↓
4. Backend проверяет учётные данные
   ↓
5. Возвращает JWT токен
   ↓
6. Токен сохраняется в localStorage
   ↓
7. Админ переходит в раздел "Прокси"
   ↓
8. Нажимает "+ Добавить прокси"
   ↓
9. Открывается модальное окно
   ↓
10. Админ заполняет форму (имя, хост, порт и т.д.)
    ↓
11. Нажимает "Сохранить"
    ↓
12. admin.js отправляет POST /api/admin/proxies
    с Authorization header содержащим JWT
    ↓
13. Backend проверяет JWT
    ↓
14. Если валидный - создаёт прокси в БД
    ↓
15. Логирует действие админа
    ↓
16. Возвращает ID нового прокси
    ↓
17. Админ-панель обновляет таблицу прокси
    ↓
18. Новый прокси доступен для пользователей
```

---

## 📊 Поток данных

### API запрос (пример):

```javascript
// Клиент отправляет:
fetch('/api/admin/proxies', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGc...'
    },
    body: JSON.stringify({
        name: 'US Proxy 1',
        country: 'US',
        host: '192.168.1.1',
        port: 8080,
        type: 'HTTP'
    })
})

// Сервер обрабатывает:
@app.route('/api/admin/proxies', methods=['POST'])
@jwt_required()
def admin_create_proxy():
    # 1. Проверить JWT
    # 2. Получить данные из request
    # 3. Валидировать данные
    # 4. Вставить в БД
    # 5. Залогировать действие
    # 6. Вернуть результат
    return jsonify({'status': 'created', 'id': proxy_id})
```

---

## 🗄️ Схема базы данных

```
┌─────────────────────────────────────────────────────────┐
│                    VPN Manager DB                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │    admins    │    │   proxies    │                  │
│  ├──────────────┤    ├──────────────┤                  │
│  │ id (PK)      │    │ id (PK)      │                  │
│  │ username     │    │ name         │                  │
│  │ password     │    │ country      │◄──────┐          │
│  │ name         │    │ host         │       │          │
│  │ email        │    │ port         │       │          │
│  │ created_at   │    │ type         │       │          │
│  │              │    │ username     │       │          │
│  │              │    │ password     │       │          │
│  │              │    │ status       │       │          │
│  │              │    │ users_count  │       │ FK       │
│  │              │    │ created_at   │       │          │
│  └──────────────┘    └──────────────┘       │          │
│                                              │          │
│  ┌──────────────┐    ┌──────────────┐      │          │
│  │    users     │    │    logs      │      │          │
│  ├──────────────┤    ├──────────────┤      │          │
│  │ id (PK)      │    │ id (PK)      │      │          │
│  │ name         │    │ user_id      │      │          │
│  │ email        │    │ admin_id     │      │          │
│  │ status       │    │ action       │      │          │
│  │ selected_    │────│ details      │      │          │
│  │ proxy_id(FK) │    │ level        │      │          │
│  │ traffic_used │    │ timestamp    │      │          │
│  │ created_at   │    └──────────────┘      │          │
│  └──────────────┘                           │          │
│                                              │          │
│  ┌──────────────────────┐                  │          │
│  │     settings         │                  │          │
│  ├──────────────────────┤                  │          │
│  │ key (PK)             │                  │          │
│  │ value                │                  │          │
│  │ updated_at           │                  │          │
│  └──────────────────────┘                  │          │
│                                              │          │
└──────────────────────────────────────────────┘──────────┘
```

---

## 🔄 Жизненный цикл прокси

```
1. CREATION (Создание)
   └─ Админ добавляет прокси через админ-панель
   └─ Записывается в БД с статусом "active"
   └─ Залогируется действие админа

2. AVAILABLE (Доступен)
   └─ Прокси появляется в списке доступных
   └─ Пользователи могут его выбрать
   └─ Счётчик users_count увеличивается

3. IN_USE (В использовании)
   └─ Когда пользователь подключился
   └─ Трафик отслеживается в таблице users
   └─ Логируются соединения

4. MAINTENANCE (Обслуживание)
   └─ Админ может отключить прокси
   └─ Статус меняется на "inactive"
   └─ Новые пользователи не могут подключиться
   └─ Существующие соединения продолжают работать

5. DELETION (Удаление)
   └─ Админ удаляет прокси
   └─ Удаляется из БД
   └─ Залогируется удаление
   └─ Пользователи должны переключиться на другой
```

---

## 🛡️ Безопасность

### Уровни защиты:

```
1. JWT Tokens
   ├─ Подписаны с SECRET_KEY
   ├─ Содержат expiration time
   └─ Невозможно подделать без ключа

2. Password Hashing
   ├─ SHA256 хеширование
   ├─ Пароли не хранятся в открытом виде
   └─ Одностороннее преобразование

3. HTTPS/TLS
   ├─ Шифрование трафика в пути
   ├─ Защита от MITM атак
   └─ Сертификаты SSL

4. CORS
   ├─ Контроль доступа между доменами
   ├─ Белый список origins
   └─ Защита от XSS

5. Input Validation
   ├─ Проверка типов данных
   ├─ Санитизация входных данных
   └─ Защита от SQL injection

6. Rate Limiting
   ├─ Ограничение количества запросов
   ├─ Защита от brute-force
   └─ DDoS mitigation
```

---

## 📈 Масштабируемость

### Текущая архитектура подходит для:
- До 1000 активных пользователей
- До 100 прокси
- До 10Mbps совокупной пропускной способности

### Для масштабирования:

```
1. БД
   └─ Миграция на PostgreSQL
   └─ Добавление индексов
   └─ Репликация для HA

2. Backend
   └─ Load balancing (Nginx, HAProxy)
   └─ Несколько инстансов Flask/Gunicorn
   └─ Redis кеширование
   └─ Async обработка (Celery)

3. Прокси
   └─ Собственная сеть прокси
   └─ Динамическое управление ресурсами
   └─ Auto-scaling при нагрузке

4. Логирование
   └─ ELK Stack (Elasticsearch, Logstash, Kibana)
   └─ Centralized logging
   └─ Real-time monitoring
```

---

## 🔧 Развитие и улучшения

### Планируемые функции:

1. **Multi-language поддержка** - UI на разных языках
2. **2FA для админа** - Двухфакторная аутентификация
3. **Traffic analytics** - Детальная аналитика
4. **Auto-rotation proxies** - Автоматическое чередование
5. **Custom rules** - Правила для селективного использования прокси
6. **API для интеграций** - SDK для разработчиков
7. **Mobile приложение** - iOS и Android приложения
8. **Encryption** - Полное шифрование трафика

---

## 📚 Ссылки на документацию

- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [JWT.io](https://jwt.io/)
- [OWASP Security](https://owasp.org/)
