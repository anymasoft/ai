# 📚 ПОЛНАЯ ДОКУМЕНТАЦИЯ LibreChat

**Версия:** v0.8.3-rc1
**Дата обновления:** Март 2026
**Язык:** Русский
**Источник:** Официальная документация https://librechat.ai/docs

---

## 📖 Содержание

1. [Обзор проекта](#обзор-проекта)
2. [Архитектура](#архитектура)
3. [Установка для разработки](#установка-для-разработки)
4. [Локальное тестирование](#локальное-тестирование)
5. [Стиль кода и соглашения](#стиль-кода-и-соглашения)
6. [Структура монорепо](#структура-монорепо)
7. [API дизайн](#api-дизайн)
8. [Frontend структура](#frontend-структура)
9. [Деплой](#деплой)
10. [Интеграции](#интеграции)
11. [Для контрибьюторов](#для-контрибьюторов)

---

## 🎯 Обзор проекта

### Что такое LibreChat?

**LibreChat** — это открытый, самостоятельно размещаемый AI чат платформа, объединяющая все основные поставщики AI в единый интерфейс, ориентированный на конфиденциальность.

### Основные возможности

✨ **UI в стиле ChatGPT** с улучшенным дизайном
🤖 **Мультимодельный выбор**: OpenAI, Anthropic (Claude), Google, Azure, AWS Bedrock, DeepSeek и другие
🔧 **Code Interpreter API**: безопасное выполнение кода (Python, Node.js, Go, C/C++, Java, PHP, Rust, Fortran)
🔦 **Агенты без кода**: создавайте специализированные AI помощники
🔍 **Веб-поиск**: поиск в интернете для улучшения контекста
🪄 **Generative UI**: артефакты кода (React, HTML, Mermaid)
🎨 **Генерация изображений**: GPT-Image-1, DALL-E, Stable Diffusion, Flux
💾 **Пресеты и управление контекстом**
🌎 **40+ языков** (включая русский)
🧠 **Reasoning UI** для моделей с цепью размышлений
🌊 **Resumable Streams** для восстановления при разрыве соединения
🗣️ **Speech & Audio**: голос в текст и текст в голос
📥 **Импорт/экспорт**: ChatGPT, markdown, JSON
👥 **Мультипользовательская безопасность**: OAuth2, LDAP, Email login
⚙️ **Полная конфигурируемость**: Docker, Kubernetes

---

## 🏗️ Архитектура

### Архитектура на уровне высокого уровня

```
┌─────────────────────────────────────────────────────┐
│         Frontend (React/TypeScript)                 │
│      /client и /packages/client                     │
│  (port 3090 dev, port 3080 production)              │
└──────────────────────────────────────────────────────┘
                          ↕ HTTP/WebSocket
┌──────────────────────────────────────────────────────┐
│          Backend (Node.js/Express)                   │
│       /api и /packages/api (TypeScript)              │
│                  (port 3080)                         │
└──────────────────────────────────────────────────────┘
                          ↕
┌──────────────────────────────────────────────────────┐
│         Shared Packages (TypeScript)                 │
│  • /packages/data-provider (API типы, endpoints)    │
│  • /packages/data-schemas (модели БД)               │
│  • /packages/api (переиспользуемые компоненты)      │
│  • /packages/client (UI компоненты)                 │
└──────────────────────────────────────────────────────┘
                          ↕
┌──────────────────────────────────────────────────────┐
│         Внешние сервисы и базы данных               │
│  • MongoDB (основное хранилище)                     │
│  • Redis (кеширование, resumable streams)           │
│  • LLM провайдеры (OpenAI, Anthropic и др.)         │
│  • Хранилище файлов (local, S3, Firebase)           │
│  • MCP Servers (инструменты и расширения)           │
└──────────────────────────────────────────────────────┘
```

### Монорепо структура

LibreChat использует **npm workspaces** для управления зависимостями:

| Пространство | Язык | Сторона | Назначение |
|---|---|---|---|
| `/api` | JS (legacy) | Backend | Express сервер — минимальные изменения |
| `/packages/api` | **TypeScript** | Backend | Новый backend код (только TS) |
| `/packages/data-schemas` | TypeScript | Backend | Модели БД, Mongoose схемы |
| `/packages/data-provider` | TypeScript | Shared | Типы API, endpoints, data-service |
| `/client` | TypeScript/React | Frontend | React SPA |
| `/packages/client` | TypeScript | Frontend | Переиспользуемые UI компоненты |

### Ключевые принципы

- ✅ **Весь новый backend код** должен быть на **TypeScript** в `/packages/api`
- ✅ `/api` остаётся тонкой **JS оболочкой**, вызывающей `/packages/api`
- ✅ **Общая БД логика** → `/packages/data-schemas`
- ✅ **Frontend/backend общий API код** → `/packages/data-provider`

---

## 🚀 Установка для разработки

### Требования

- **Git** (обязательно)
- **Node.js**: v20.19.0+ или ^22.12.0 или >= 23.0.0 (обязательно)
- **MongoDB**: для основного хранилища (обязательно)
- **Git LFS**: для больших файлов (рекомендуется)
- **VSCode**: рекомендуемый редактор

### Рекомендуемые расширения VSCode

```
- Prettier (esbenp.prettier-vscode)
- ESLint (dbaeumer.vscode-eslint)
- GitLens (eamodio.gitlens)
```

### Шаг 1: Подготовка GitHub

```bash
# Сделайте fork репозитория
# https://github.com/danny-avila/LibreChat/fork

# Создайте новую ветку на вашем fork и клонируйте
git clone -b branch-name https://github.com/username/LibreChat.git
cd LibreChat
```

### Шаг 2: Откройте в VSCode

```bash
code .
```

Откройте терминал в VSCode: `Ctrl+Shift+` или `Ctrl+J`

### Шаг 3: Установите зависимости

```bash
# Умная переустановка (только если lockfile изменился)
npm run smart-reinstall

# Или полная переустановка
npm run reinstall

# Или базовая установка
npm ci
```

### Шаг 4: Конфигурация .env

```bash
# Создайте .env файл
cp .env.example .env

# Отредактируйте .env и добавьте ваши API ключи
# Минимальные требования:
# - MONGO_URI (обязательно, укажите свой MongoDB)
# - OPENAI_API_KEY (хотя бы один LLM провайдер)
```

**⚠️ Важно**: Убедитесь, что MongoDB установлена и работает:
- Локально: MongoDB Community Server
- Облако: MongoDB Atlas (https://www.mongodb.com/cloud/atlas)

### Шаг 5: Сборка компилируемого кода

```bash
npm run build
```

### Шаг 6: Запуск для разработки

#### Способ 1: Раздельный запуск (рекомендуется)

```bash
# Терминал 1: Запустить backend
npm run backend:dev
# Доступен на http://localhost:3080/

# Терминал 2: Запустить frontend
npm run frontend:dev
# Доступен на http://localhost:3090/
```

#### Способ 2: Использование Bun (быстрее)

```bash
# Терминал 1
npm run b:api:dev

# Терминал 2
npm run b:client:dev
```

### Pro Tips

- Установите `DEBUG_CONSOLE=true` в `.env` для подробного вывода сервера
- Frontend dev server имеет Hot Module Replacement (HMR) для быстрого обновления
- Убедитесь, что backend работает перед запуском frontend в режиме разработки

---

## 🧪 Локальное тестирование

### Подготовка

Перед отправкой изменений убедитесь, что все тесты проходят:

```bash
# Создайте /api/.env из примера
cp .env.example ./api/.env

# Добавьте NODE_ENV=CI
echo "NODE_ENV=CI" >> ./api/.env

# Запустите тесты frontend
npm run test:client

# Запустите тесты API
npm run test:api
```

### Запуск тестов по workspace

```bash
# Frontend тесты
cd client && npm run test:ci

# API тесты
cd api && npm run test:ci

# Package API тесты
cd packages/api && npm run test:ci

# Data-provider тесты
cd packages/data-provider && npm run test:ci

# ВСЕ тесты
npm run test:all
```

### Запуск конкретных тестов

```bash
# Запустить тесты с паттерном
cd api && npx jest <pattern>
cd packages/api && npx jest <pattern>
cd client && npx jest <pattern>
```

### E2E тесты (Playwright)

```bash
# Локальные E2E тесты
npm run e2e

# С видимым окном браузера
npm run e2e:headed

# Debug режим
npm run e2e:debug

# Accessibility тесты
npm run e2e:a11y

# Обновить скриншоты
npm run e2e:update

# Просмотреть отчёт
npm run e2e:report
```

### Best Practices для тестов

✅ Покрывайте состояния loading, success, и error
✅ Mock данные для data-provider hooks
✅ Используйте `test/layout-test-utils` для рендера компонентов
✅ Проверяйте позитивные и негативные сценарии
✅ Используйте описательные имена тестов

---

## 📝 Стиль кода и соглашения

### Общие гайдлайны

✅ Используйте "clean code" принципы
✅ Держите функции и модули маленькими
✅ Придерживайтесь single responsibility principle
✅ Используйте значимые и описательные имена
✅ Приоритет: читаемость и поддерживаемость над краткостью
✅ Используйте предоставленные `.eslintrc` и `.prettierrc`
✅ Исправьте все ошибки форматирования: `npm run lint:fix && npm run format`

### Структура кода

#### Never-nesting: используйте ранние возвраты

```javascript
// ❌ Плохо: глубокая вложенность
function process(user) {
  if (user) {
    if (user.active) {
      if (user.email) {
        sendEmail(user.email);
      }
    }
  }
}

// ✅ Хорошо: ранние возвраты
function process(user) {
  if (!user) return;
  if (!user.active) return;
  if (!user.email) return;
  sendEmail(user.email);
}
```

#### Functional first: чистые функции, неизменяемость

```javascript
// ❌ Плохо: императивный стиль
const filtered = [];
for (const item of items) {
  if (item.active) {
    filtered.push(item.name.toUpperCase());
  }
}

// ✅ Хорошо: функциональный стиль
const filtered = items
  .filter(item => item.active)
  .map(item => item.name.toUpperCase());
```

#### DRY: не повторяй себя

```javascript
// ❌ Плохо: дублирование логики
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const checkEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ✅ Хорошо: единая функция
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateEmail = isValidEmail;
```

### Итерация и производительность

**Минимизируйте циклы:**
- Избегайте многократного итерирования одного массива
- Используйте Map/Set вместо Array.find() для поиска
- Объединяйте последовательные операции O(n) в один проход

```javascript
// ❌ Плохо: две итерации
const filtered = items.filter(item => item.active);
const uppercase = filtered.map(item => item.name.toUpperCase());

// ✅ Хорошо: одна итерация
const result = items
  .filter(item => item.active)
  .map(item => item.name.toUpperCase());
```

### Безопасность типов (TypeScript)

⚠️ **Никогда не используйте `any`**
⚠️ Ограничивайте использование `unknown`
⚠️ Не дублируйте типы — проверьте в `packages/data-provider` перед созданием нового типа
✅ Используйте union types, generics, interfaces
✅ Исправьте все TypeScript/ESLint ошибки

```typescript
// ❌ Плохо
const processData = (data: any) => data.value + 10;

// ✅ Хорошо
interface DataItem {
  value: number;
  name: string;
}

const processData = (data: DataItem): number => data.value + 10;
```

### Комментарии и документация

✅ Пишите самодокументирующийся код
✅ JSDoc только для сложной/неочевидной логики или публичных API
✅ Однострочный JSDoc для кратких объяснений
✅ Избегайте обычных `//` комментариев

```typescript
/**
 * Вычисляет стоимость сообщения на основе длины и модели
 * @param {string} message - Текст сообщения
 * @param {string} model - Название модели
 * @returns {number} Стоимость в токенах
 */
const calculateMessageCost = (message: string, model: string): number => {
  const tokenRatio = MODEL_TOKEN_COSTS[model] ?? 1;
  return (message.length * tokenRatio) / 4;
};
```

### Порядок импортов

Импорты организованы в три секции:

```typescript
// 1. Пакеты (от короткого к длинному)
import React from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

// 2. Type импорты (от длинного к короткому)
import type { User, Message } from '@types/index';
import type { ReactNode } from 'react';

// 3. Локальные импорты (от длинного к короткому)
import { useChatStore } from '../store/chatSlice';
import { formatDate } from '../utils/format';
import styles from './Component.module.css';
```

### Выбор циклов

- `for (let i = 0; ...)` для performance-critical или индекс-зависимых операций
- `for...of` для простой итерации массива
- `for...in` только для перечисления свойств объекта
- ⚠️ **Минимизируйте использование циклов вообще**

---

## 📂 Структура монорепо

### Граница рабочих пространств

```
LibreChat/
├── api/                          # Legacy Express backend (JS)
│   ├── app/                      # Основная логика
│   │   ├── clients/              # Клиенты для LLM
│   │   ├── cache/                # Кеширование
│   │   ├── db/                   # БД операции
│   │   └── models/               # Mongoose схемы
│   ├── server/                   # Express сервер
│   │   ├── controllers/          # Обработчики
│   │   ├── routes/               # Маршруты
│   │   ├── middleware/           # Middleware
│   │   ├── services/             # Бизнес-логика
│   │   └── utils/                # Утилиты
│   ├── strategies/               # Auth стратегии
│   ├── config/                   # Конфигурация
│   └── test/                     # Тесты
│
├── client/                       # React SPA (TypeScript)
│   ├── src/
│   │   ├── components/           # React компоненты
│   │   ├── hooks/                # Custom hooks
│   │   ├── store/                # Redux store
│   │   ├── routes/               # React Router
│   │   ├── data-provider/        # React Query
│   │   ├── locales/              # Переводы (40+ языков)
│   │   ├── utils/                # Утилиты
│   │   └── ...
│   └── test/                     # Тесты
│
├── packages/
│   ├── api/                      # TypeScript backend код
│   ├── data-schemas/             # Модели БД
│   ├── data-provider/            # Shared API типы
│   └── client/                   # UI компоненты
│
├── config/                       # Скрипты конфигурации
├── e2e/                          # Playwright E2E тесты
├── helm/                         # Kubernetes Helm чарты
└── ...
```

### Ключевые команды для монорепо

```bash
# Умная переустановка (если lockfile изменился)
npm run smart-reinstall

# Полная переустановка
npm run reinstall

# Собрать data-provider после изменений
npm run build:data-provider

# Полная сборка через Turborepo
npm run build

# Сборка отдельного пакета
cd packages/api && npm run build
```

---

## 🔧 API дизайн

### API принципы

✅ Следуйте RESTful принципам
✅ Используйте значимые имена для routes, controllers, services
✅ Используйте правильные HTTP методы (GET, POST, PUT, DELETE)
✅ Используйте правильные HTTP коды (2xx успех, 4xx клиент, 5xx сервер)
✅ Обрабатывайте исключения gracefully с try-catch
✅ Используйте JWT-based stateless authentication
✅ Используйте `requireJWTAuth` middleware для защиты

### Структура файлов

Новый backend код находится в `/packages/api` как TypeScript. Legacy `/api` следует этой структуре:

```
api/
├── server/
│   ├── controllers/     # Обработчики запросов (вызывают services)
│   ├── routes/          # Определение маршрутов
│   ├── middleware/      # Auth, logging, error handling
│   └── services/        # Бизнес-логика (в /packages/api)
├── app/
│   ├── clients/         # LLM провайдеры
│   ├── db/              # MongoDB операции
│   └── models/          # Mongoose схемы
└── utils/               # Вспомогательные функции
```

---

## 💻 Frontend структура

### React компоненты

✅ TypeScript для всех компонентов с правильной типизацией
✅ Семантический HTML с ARIA labels для доступности
✅ Группируйте связанные компоненты в feature директориях
✅ Используйте index файлы для чистого импорта

### Управление состоянием

- **Redux** для глобального состояния (Redux Slice pattern)
- **React Query** для API операций и кеширования
- **React Context** для провайдеров (i18n, theme и т.д.)

### Локализация (i18n)

✅ Все тексты для пользователя должны использовать `useLocalize()`
✅ Обновляйте только английские ключи (`client/src/locales/en/translation.json`)
✅ Другие языки обновляются автоматически
✅ Используйте семантические префиксы: `com_ui_`, `com_assistants_`, `com_chat_`

```typescript
import { useLocalize } from '@hooks';

export const MyComponent = () => {
  const localize = useLocalize();
  return <p>{localize('com_ui_hello_world')}</p>;
};
```

### React Query

```typescript
// /client/src/data-provider/Chat/queries.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export const useGetConversations = () =>
  useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations()
  });

export const useSendMessage = () =>
  useMutation({
    mutationFn: (data) => sendMessage(data),
    onSuccess: () => {
      // Инвалидировать кеш
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });
```

---

## 🐳 Деплой

### Docker Compose

```bash
# Запустить контейнеры
docker-compose up -d

# Логи
docker-compose logs -f

# Остановить
docker-compose down
```

### Kubernetes (Helm)

```bash
# Установить
helm install librechat librechat/librechat \
  --namespace librechat \
  --create-namespace \
  -f values.yaml

# Обновить
helm upgrade librechat librechat/librechat -f values.yaml

# Удалить
helm uninstall librechat --namespace librechat
```

### Переменные окружения для продакшена

```env
NODE_ENV=production
NO_INDEX=true
DEBUG_LOGGING=false

# Используйте переменные окружения, а не hardcoded значения
OPENAI_API_KEY=${OPENAI_API_KEY}
MONGO_URI=${MONGO_URI}
REDIS_URI=${REDIS_URI}
```

---

## 🔗 Интеграции

### Поддерживаемые LLM провайдеры

```yaml
# librechat.yaml
endpoints:
  openAI:
    apiKey: "${OPENAI_API_KEY}"
    models:
      default: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
      fetch: true

  anthropic:
    apiKey: "${ANTHROPIC_API_KEY}"
    models:
      default: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]

  google:
    apiKey: "${GOOGLE_API_KEY}"
    projectId: "${VERTEX_AI_PROJECT}"
    models:
      default: ["gemini-2.0-flash", "gemini-1.5-pro"]

  # Custom OpenAI-compatible endpoints
  custom:
    - name: "deepseek"
      apiKey: "${DEEPSEEK_API_KEY}"
      baseURL: "https://api.deepseek.com/v1"
      models:
        default: ["deepseek-chat", "deepseek-reasoner"]
        fetch: false
```

### Аутентификация

✅ OAuth2 (Google, GitHub, Discord и др.)
✅ LDAP интеграция
✅ JWT-based токены
✅ Email/пароль

### Хранилище файлов

```yaml
fileStrategy:
  avatar: "s3"        # Аватары → S3
  image: "firebase"   # Изображения → Firebase
  document: "local"   # Документы → Local
```

Доступные стратегии: local, s3, firebase

---

## 🤝 Для контрибьюторов

### Процесс контрибьюции

1. **Сделайте fork** и создайте новую ветку
2. **Установите зависимости** (см. выше)
3. **Сделайте изменения** в соответствии с style guide
4. **Напишите/обновите тесты**
5. **Запустите тесты локально** — все должно пройти
6. **Формат код**: `npm run lint:fix && npm run format`
7. **Сделайте коммит** с понятным описанием
8. **Создайте PR** с подробным описанием

### Commit сообщения

```
<type>(<scope>): <subject>

<body>

<footer>
```

Примеры:
```
feat(chat): add message reactions
fix(auth): resolve JWT token expiration bug
docs(setup): update installation instructions
refactor(components): improve Chat component structure
```

### Перед PR убедитесь

- ✅ Все тесты проходят: `npm run test:all`
- ✅ Нет лinting ошибок: `npm run lint`
- ✅ Код отформатирован: `npm run format`
- ✅ E2E тесты работают: `npm run e2e`
- ✅ Код следует style guide (см. выше)
- ✅ Типы TypeScript явные (нет `any`)
- ✅ Текст локализован (используйте `useLocalize()`)

---

## 📚 Дополнительные ресурсы

- **Официальный сайт**: https://librechat.ai
- **Документация**: https://docs.librechat.ai
- **GitHub репозиторий**: https://github.com/danny-avila/LibreChat
- **Discord сообщество**: https://discord.librechat.ai
- **YouTube канал**: https://www.youtube.com/@LibreChat
- **Блог**: https://librechat.ai/blog

---

## 📝 Лицензия

LibreChat выпускается под лицензией **ISC** (открытый исходный код).

---

**Документация составлена**: Март 2026
**Версия**: v0.8.3-rc1
**Источники**: Официальная документация librechat.ai, AGENTS.md, package.json, librechat.yaml, .env.example
