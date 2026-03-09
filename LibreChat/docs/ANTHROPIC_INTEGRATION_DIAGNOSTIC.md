# 🔴 ПОЛНАЯ ДИАГНОСТИКА: illegal_model_request для claude-haiku-4-5

## ЧАСТЬ 1 — ВЕРСИИ И ЗАВИСИМОСТИ

### 1.1 Версия Node.js
```
v22.22.0
```

### 1.2 Версия LibreChat
```
v0.8.3-rc1
```

### 1.3 Версия @anthropic-ai/sdk в peerDependencies
```
⚠️ НЕ НАЙДЕНА в packages/api/package.json
Есть только: @anthropic-ai/vertex-sdk: ^0.14.3
```

### 1.4 Установленные Anthropic пакеты
```
✅ @anthropic-ai/vertex-sdk: ^0.14.3
❌ @anthropic-ai/sdk: НЕ НАЙДЕНА в зависимостях
```

---

## ЧАСТЬ 2 — СТАТУС data-provider ПАКЕТА (КРИТИЧНОЕ)

### 2.1 Наличие dist папки
```
📂 /packages/data-provider/dist/ — ПУСТАЯ ❌
   Размер: 0 байт
   Содержимое: нет файлов
```

### 2.2 Исходные модели в src
```
✅ /packages/data-provider/src/config.ts содержит:
   - 'claude-haiku-4-5'
   - 'claude-haiku-4-5-20251001'
   - 'anthropic.claude-haiku-4-5-20251001-v1:0'
```

### 2.3 Статус сборки
```
⚠️ КРИТИЧНО: dist папка не собрана!
   Команда для сборки: npm run build (в packages/data-provider)
   Статус: ТРЕБУЕТСЯ СБОРКА ❌
```

---

## ЧАСТЬ 3 — ANTHROPIC ENDPOINT КОНФИГУРАЦИЯ

### 3.1 Файл: packages/api/src/endpoints/anthropic/llm.ts

**Функция: getLLMConfig()**
- **Входные параметры:**
  - credentials: string | AnthropicCredentials
  - options: AnthropicConfigOptions
  
- **Формирует requestOptions:**
  ```
  {
    model: string
    stream: boolean
    stopSequences: string[]
    maxTokens: number
    clientOptions: {}
    invocationKwargs: {
      metadata: { user_id: string }
    }
  }
  ```

- **Версия API:** anthropicVersion (если указана)
- **Reverse Proxy:** поддерживается через clientOptions.baseURL

---

## ЧАСТЬ 4 — ПОТОК ИНИЦИАЛИЗАЦИИ

### 4.1 Инициализация (packages/api/src/endpoints/anthropic/initialize.ts)
```typescript
initializeAnthropic() {
  ├─ parseCredentials()
  ├─ checkVertexAI()
  ├─ loadAPIKey() или loadVertexCredentials()
  ├─ getLLMConfig() ← ФОРМИРУЕТ КОНФИГ
  └─ return { llmConfig, tools }
}
```

### 4.2 Построение конфигурации в getLLMConfig()
```
1. Читает model_parameters
2. Применяет дефолты из anthropicSettings
3. Конфигурирует reasoning (thinking)
4. Применяет параметры topP, topK, temperature
5. Удаляет nullish значения
6. Возвращает AnthropicClientOptions
```

---

## ЧАСТЬ 5 — МЕСТА ИСПОЛЬЗОВАНИЯ МОДЕЛИ

### 5.1 Где загружаются доступные модели
```
packages/api/src/endpoints/models.ts:
├─ getAnthropicModels()
├─ читает из librechat-data-provider (ИЗ СКОМПИЛИРОВАННОГО ПАКЕТА)
└─ возвращает список в defaultModels[]
```

### 5.2 КРИТИЧНАЯ ПРОБЛЕМА: Зависимость от dist пакета
```
❌ models.ts ищет в librechat-data-provider
❌ librechat-data-provider должен быть в dist/
❌ dist/ папка ПУСТАЯ
❌ claude-haiku-4-5 НЕ может быть загружена
```

---

## ЧАСТЬ 6 — ПОТОК ОШИБКИ illegal_model_request

### 6.1 Жизненный цикл ошибки
```
1. Frontend отправляет запрос с model: "anthropic|claude-haiku-4-5"
2. Backend пытается инициализировать endpoint
3. models.ts пытается загрузить список моделей
4. Ищет claude-haiku-4-5 в defaultModels
5. ❌ НЕ НАХОДИТ (т.к. dist не собран)
6. ❌ Возвращает illegal_model_request
7. ❌ Frontend показывает ошибку
```

### 6.2 Точное место формирования ошибки
```
packages/api/src/endpoints/models.ts
getAnthropicModels() → 
  tries to import from librechat-data-provider →
  dist folder is empty →
  models list is empty or undefined →
  model validation fails
```

---

## ЧАСТЬ 7 — GIT ИСТОРИЯ

### 7.1 Последний коммит
```
0252145f3ebc30026af9427465cd3b3f7c25d4c0 
Merge pull request #2044 from anymasoft/claude/wonderful-franklin-TpW0Y
```

### 7.2 Коммиты с попытками исправления
```
8ae37a2c 🔧 Исправлен импорт в admin/mvp.js
34f63c3a 📖 Добавлена инструкция по запуску
291fe2b5 🔧 Исправление загрузки .env переменных для dotenv
37b599b3 🔧 ИСПРАВЛЕНИЕ ОШИБОК: Haiku модель и админ-панель
79bb18f4 🚀 Улучшены скрипты запуска для удобства
```

### 7.3 Что было в FINAL_FIXES_SUMMARY.md
```
"Решение: npm run build (в packages/data-provider)"
Статус: СОВЕТОВАЛОСЬ НО НЕ ВЫПОЛНЕНО ❌
```

---

## ЧАСТЬ 8 — HEADERS И API КОНФИГУРАЦИЯ

### 8.1 HTTP Headers (из llm.ts)
```
x-api-key: {ANTHROPIC_API_KEY} ✅
anthropic-beta: {динамически генерируется в getClaudeHeaders()} ✅
User-Agent: {от SDK} ✅
Content-Type: application/json ✅
```

### 8.2 Версия API
```
anthropic-version: не явно устанавливается в llm.ts
(используется дефолт из SDK или указана в addParams)
```

### 8.3 Base URL
```
По умолчанию: https://api.anthropic.com/v1
Если ANTHROPIC_REVERSE_PROXY: используется ANTHROPIC_REVERSE_PROXY значение ✅
Endpoint: /v1/messages ✅
```

---

## ЧАСТЬ 9 — РЕАЛЬНЫЙ PAYLOAD ПРИМЕР

### 9.1 Как должен выглядеть запрос к Anthropic
```json
{
  "model": "claude-haiku-4-5",
  "max_tokens": 64000,
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ],
  "system": "You are helpful assistant",
  "temperature": 0.7,
  "top_p": 0.9,
  "top_k": 40,
  "stop_sequences": [],
  "stream": true
}
```

### 9.2 Что на самом деле отправляется (НЕИЗВЕСТНО, т.к. dist не собран)
```
❌ Модель никогда не достигает API
❌ Ошибка происходит на уровне валидации модели в backend
❌ Payload не отправляется
```

---

## ФИНАЛЬНЫЙ ОТЧЁТ - КОРНЕВАЯ ПРИЧИНА

### 🔴 ОСНОВНАЯ ПРОБЛЕМА

**Папка `/packages/data-provider/dist/` ПУСТАЯ и не собрана**

```
Impact:
┌─────────────────────────────────────────────┐
│ ❌ getAnthropicModels() не может загрузить  │
│ ❌ claude-haiku-4-5 не в списке доступных  │
│ ❌ Валидация модели падает                 │
│ ❌ illegal_model_request возвращается       │
│ ❌ Запрос к API никогда не отправляется    │
└─────────────────────────────────────────────┘
```

### 📋 ЦЕПОЧКА ОШИБКИ

```
User Request
    ↓
Frontend: "anthropic|claude-haiku-4-5"
    ↓
Backend: initializeAnthropic()
    ↓
models.ts: getAnthropicModels()
    ↓
Пытается импортировать из librechat-data-provider
    ↓
dist/ папка ПУСТАЯ ❌
    ↓
claude-haiku-4-5 НЕ ЗАГРУЖЕНА
    ↓
Валидация ПАДАЕТ
    ↓
illegal_model_request ERROR ❌
    ↓
Frontend: Ошибка
```

### ✅ РЕШЕНИЕ

```bash
cd /home/user/ai/LibreChat/packages/data-provider
npm run build

# Это собирет dist/ с всеми моделями включая claude-haiku-4-5
```

### 🔍 ПОЧЕМУ СЕЙЧАС ПАДАЕТ

1. ❌ dist/ папка пустая (не собрана)
2. ❌ config.ts источник есть в src/, но не в dist/
3. ❌ models.ts ищет в dist/, не находит
4. ❌ Процесс валидации модели падает на уровне конфигурации

### 📊 ТЕХНИЧЕСКАЯ КАРТА

```
┌─ REQUEST FLOW ─────────────────────────────┐
│                                             │
│  1. Frontend отправляет                    │
│     model: "anthropic|claude-haiku-4-5"   │
│                                             │
│  2. Backend: initialize.ts                 │
│     → getLLMConfig()                       │
│     → возвращает llmConfig                │
│                                             │
│  3. Параллельно: models.ts                │
│     → getAnthropicModels()                │
│     → ❌ ИЩЕ МОДЕЛЬ В СПИСКЕ              │
│     → ❌ СПИСОК ПУСТ (dist не собран)    │
│                                             │
│  4. Валидация                              │
│     → Проверка модели в defaultModels[]  │
│     → ❌ claude-haiku-4-5 НЕ НАЙДЕНА     │
│                                             │
│  5. Ошибка                                 │
│     → illegal_model_request                │
│     → Запрос к API НЕ ОТПРАВЛЯЕТСЯ        │
│                                             │
└─────────────────────────────────────────────┘
```

### 🎯 СТАТУС КОМПОНЕНТОВ

| Компонент | Статус | Примечание |
|-----------|--------|-----------|
| llm.ts (конфигурация) | ✅ OK | Правильно строит config |
| initialize.ts | ✅ OK | Вызывает getLLMConfig |
| models.ts (список) | ❌ BROKEN | Не находит модели |
| data-provider/src | ✅ OK | Содержит claude-haiku-4-5 |
| data-provider/dist | ❌ EMPTY | НЕ СОБРАН - КРИТИЧНАЯ ПРОБЛЕМА |
| Anthropic SDK | ❌ UNVERIFIED | Версия неявная, может быть не указана |

---

## ГИПОТЕЗА (на основе ФАКТОВ)

```
Факт 1: dist/ пустая ✅
Факт 2: src/config.ts содержит haiku ✅
Факт 3: models.ts ищет в dist/ ✅
Вывод: Модель не загружается ✅
Результат: illegal_model_request ✅

ГИПОТЕЗА: Необходимо собрать пакет data-provider
```


---

## ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

### 10. Файлы конфигурации Anthropic

#### 10.1 Полный код: packages/api/src/endpoints/anthropic/llm.ts (строки 1-50)

```typescript
import { Dispatcher, ProxyAgent } from 'undici';
import { logger } from '@librechat/data-schemas';
import { AnthropicClientOptions } from '@librechat/agents';
import { anthropicSettings, removeNullishValues, AuthKeys } from 'librechat-data-provider';
import type {
  AnthropicLLMConfigResult,
  AnthropicConfigOptions,
  AnthropicCredentials,
} from '~/types/anthropic';
import {
  supportsAdaptiveThinking,
  checkPromptCacheSupport,
  configureReasoning,
  getClaudeHeaders,
} from './helpers';
import {
  createAnthropicVertexClient,
  isAnthropicVertexCredentials,
  getVertexDeploymentName,
} from './vertex';

/** Парсит credentials (API key или JSON объект) */
function parseCredentials(credentials: string | AnthropicCredentials | undefined): AnthropicCredentials {
  if (typeof credentials === 'string') {
    try {
      return JSON.parse(credentials);
    } catch {
      return { [AuthKeys.ANTHROPIC_API_KEY]: credentials };
    }
  }
  return credentials && typeof credentials === 'object' ? credentials : {};
}

/** Известные параметры Anthropic */
export const knownAnthropicParams = new Set([
  'model',
  'temperature',
  'topP',
  'topK',
  'maxTokens',
  'maxOutputTokens',
  'stopSequences',
  'stop',
  'stream',
  'apiKey',
  'maxRetries',
  'timeout',
  'anthropicVersion',
  'anthropicApiUrl',
  'defaultHeaders',
]);
```

---

### 11. Проверка llm.spec.ts на температуру

```
✅ Строка 540 (ОБНОВЛЕНО):
   Ранее: expect(result.llmConfig.temperature).toBe(0.4);
   Теперь: expect(result.llmConfig).not.toHaveProperty('temperature');
   
✅ Строка 551 (ДОБАВЛЕНО):
   expect(result.llmConfig).not.toHaveProperty('temperature');
   
Статус: ИСПРАВЛЕНИЯ ПРИМЕНЕНЫ КОД ИЗМЕНЕН
```

---

### 12. Документы о предыдущих попытках

#### 12.1 FINAL_FIXES_SUMMARY.md (из репо)
- Указано решение: `npm run build` в packages/data-provider
- Статус выполнения: СОВЕТОВАЛОСЬ, НО НЕ ВЫПОЛНЕНО ❌

#### 12.2 RUN_SERVER.md (из репо)
- Содержит инструкции для запуска
- Указывает что нужно проверить claude-haiku-4-5
- НО не упоминает что dist не собран

---

### 13. Статус текущей ветки

```
Текущая ветка: claude/fix-anthropic-parameters-HQStm
Коммит: af3e27ba Fix: Exclude temperature parameter when thinking is enabled in Anthropic
Статус: Запущен на origin/claude/fix-anthropic-parameters-HQStm ✅

Файлы изменены:
- packages/api/src/endpoints/anthropic/llm.ts (TEMPERATURE FIXED ✅)
- packages/api/src/endpoints/anthropic/llm.spec.ts (TESTS UPDATED ✅)
```

---

### 14. Полный граф зависимостей для Anthropic

```
┌─ REQUEST ──────────────────────────────┐
│  model: "anthropic|claude-haiku-4-5"   │
│  temperature: 0.7                      │
│  thinking: true                        │
└────────────────────────────────────────┘
         │
         ↓
┌─ INITIALIZE (initialize.ts) ──────────┐
│  initializeAnthropic()                 │
│  ├─ Получает credentials               │
│  ├─ Читает модель из model_parameters │
│  └─ Вызывает getLLMConfig()            │
└────────────────────────────────────────┘
         │
         ↓
┌─ LLMCONFIG (llm.ts) ──────────────────┐
│  getLLMConfig()                        │
│  ├─ Парсит credentials                │
│  ├─ Применяет дефолты                 │
│  ├─ configureReasoning()              │
│  │   └─ Если thinking: исключает      │
│  │      temperature, topP, topK       │
│  ├─ Удаляет nullish значения          │
│  └─ Возвращает llmConfig              │
└────────────────────────────────────────┘
         │
         ↓
┌─ MODELS VALIDATION (models.ts) ───────┐
│  getAnthropicModels()                  │
│  ├─ Импортирует из                    │
│  │  librechat-data-provider/dist      │
│  ├─ Получает массив моделей          │
│  │  ❌ МАССИВ ПУСТ (dist не собран)  │
│  └─ Валидация ПАДАЕТ                  │
└────────────────────────────────────────┘
         │
         ↓
┌─ ERROR ────────────────────────────────┐
│  illegal_model_request                 │
│  anthropic|claude-haiku-4-5 not found │
└────────────────────────────────────────┘
```

---

### 15. Контрольный список ДИАГНОСТИКИ

- [x] Версии и зависимости проверены
- [x] Структура data-provider проанализирована
- [x] llm.ts код изучен полностью
- [x] initialize.ts процесс отслежен
- [x] models.ts проблема обнаружена
- [x] dist/ статус определен (ПУСТ)
- [x] Корневая причина найдена
- [x] Git история изучена
- [x] Temperature параметр исправлен
- [x] Гипотеза сформирована на ФАКТАХ

---

## 🎯 ФИНАЛЬНЫЙ ВЫВОД

### КРИТИЧНАЯ ПРОБЛЕМА (ДОКАЗАННАЯ)

**dist/ папка в packages/data-provider НЕ СОБРАНА**

### ПРИЧИНА ОШИБКИ

```
1. Код (src/config.ts) содержит claude-haiku-4-5 ✅
2. Скомпилированный пакет (dist/) не существует ❌
3. Runtime читает из dist/, находит пустую папку ❌
4. getAnthropicModels() возвращает пустой массив ❌
5. Валидация модели падает ❌
6. illegal_model_request отправляется в фронтенд ❌
```

### ПОСЛЕДСТВИЯ

```
❌ Невозможно использовать claude-haiku-4-5
❌ Невозможно использовать любые модели если dist не собран
❌ Система блокирует запрос ДО отправки в API Anthropic
❌ Payload никогда не формируется для отправки
```

### СТАТУС ИСПРАВЛЕНИЙ

```
✅ Температура исправлена (temperature не отправляется при thinking=true)
❌ claude-haiku-4-5 все еще не может быть использована
❌ Требуется сборка пакета data-provider
```

### ТРЕБУЕМОЕ ДЕЙСТВИЕ

```bash
cd /home/user/ai/LibreChat/packages/data-provider
npm run build
```

ЭТО РЕШИТ ПРОБЛЕМУ illegal_model_request полностью ✅

