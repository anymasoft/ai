# 📋 ПОЛНЫЙ АУДИТ ПОЛЬЗОВАТЕЛЬСКИХ НАСТРОЕК LibreChat

**Дата аудита:** 2026-03-04
**Статус:** Завершено
**Охват:** 8 вкладок Settings, 50+ отдельных настроек

---

## 📊 СВОДКА

| Категория | Количество | Статус |
|-----------|-----------|--------|
| **USER SETTINGS** | 42 | ✅ Рекомендуется оставить |
| **ADMIN SETTINGS** | 4 | ⚠️ Перенести в админку |
| **DANGEROUS SETTINGS** | 4 | 🚨 Скрыть или заблокировать |
| **TOTAL** | **50** | |

---

## 1️⃣ КАТЕГОРИЯ: USER SETTINGS (Пользовательские настройки)

Эти настройки БЕЗОПАСНЫ для обычного пользователя и должны быть доступны.

### GENERAL TAB (Общие)

| # | Название | Хранилище | Тип | Влияние | Безопасность | API Стоимость | Рекомендация |
|---|----------|-----------|-----|---------|--------------|---------------|--------------|
| 1 | **Theme** | React Context / DOM | `system\|dark\|light` | Влияет на оформление интерфейса | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 2 | **Language** | localStorage + Cookies | `en-US\|zh-Hans\|...` (39 языков) | Локализация интерфейса | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 3 | **enableUserMsgMarkdown** | localStorage (Recoil) | `boolean` | Разрешить markdown в сообщениях пользователя | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 4 | **autoScroll** | localStorage (Recoil) | `boolean` | Автоскролл к новым сообщениям | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 5 | **hideSidePanel** | localStorage (Recoil) | `boolean` | Скрыть боковую панель | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 6 | **keepScreenAwake** | localStorage (Recoil) | `boolean` | Не отключать экран во время чата | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 7 | **ArchivedChats** | API (Button компонент) | `action` | Просмотр архивированных чатов | ✅ Нет рисков | ❌ Нет | ✅ Оставить |

### CHAT TAB (Настройки чата)

| # | Название | Хранилище | Тип | Влияние | Безопасность | API Стоимость | Рекомендация |
|---|----------|-----------|-----|---------|--------------|---------------|--------------|
| 8 | **enterToSend** | localStorage (Recoil) | `boolean` | Enter отправляет сообщение (vs Ctrl+Enter) | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 9 | **maximizeChatSpace** | localStorage (Recoil) | `boolean` | Полный экран для чата | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 10 | **centerFormOnLanding** | localStorage (Recoil) | `boolean` | Центрировать форму на стартовой странице | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 11 | **showThinking** | localStorage (Recoil) | `boolean` | Показывать процесс мышления моделей (o1, o3, etc) | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 12 | **showCode** | localStorage (Recoil) | `boolean` | Показывать анализ кода в ответах | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 13 | **LaTeXParsing** | localStorage (Recoil) | `boolean` | Парсить LaTeX формулы | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 14 | **saveDrafts** | localStorage (Recoil) | `boolean` | Сохранять черновики сообщений | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 15 | **showScrollButton** | localStorage (Recoil) | `boolean` | Показывать кнопку скролла в конец | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 16 | **saveBadgesState** | localStorage (Recoil) | `boolean` | Сохранять состояние бэйджей | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 17 | **modularChat** | localStorage (Recoil) | `boolean` | Модульный интерфейс чата (beta feature) | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 18 | **chatDirection** | localStorage (Recoil) | `LTR\|RTL` | Направление текста (для RTL языков) | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 19 | **forkSetting** | localStorage (Recoil) | `DIRECT_PATH\|INCLUDE_BRANCHES\|TARGET_LEVEL` | Как форкировать (разветвлять) беседы | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 20 | **splitAtTarget** | localStorage (Recoil) | `boolean` | Разбивать беседы в целевой точке | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 21 | **rememberDefaultFork** | localStorage (Recoil) | `boolean` | Запомнить стандартный вариант форка | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 22 | **FontSize** | Component State | `number` | Размер шрифта (малый/обычный/большой) | ✅ Нет рисков | ❌ Нет | ✅ Оставить |

### COMMANDS TAB (Команды)

| # | Название | Хранилище | Тип | Влияние | Безопасность | API Стоимость | Рекомендация |
|---|----------|-----------|-----|---------|--------------|---------------|--------------|
| 23 | **atCommand** | localStorage (Recoil) | `boolean` | Включить @ команду (упоминание контекста) | ✅ Нет рисков | ❌ Нет | ✅ Оставить |
| 24 | **plusCommand** | localStorage (Recoil) | `boolean` | Включить + команду (мультиконверсация) | ✅ Требует разрешение MULTI_CONVO | ❌ Нет | ✅ Оставить (если доступно) |
| 25 | **slashCommand** | localStorage (Recoil) | `boolean` | Включить / команду (промпты) | ✅ Требует разрешение PROMPTS | ❌ Нет | ✅ Оставить (если доступно) |

### SPEECH TAB (Речь и аудио)

**STT (Speech To Text):**

| # | Название | Хранилище | Тип | Влияние | Безопасность | API Стоимость | Рекомендация |
|---|----------|-----------|-----|---------|--------------|---------------|--------------|
| 26 | **speechToText** | localStorage (Recoil) | `boolean` | Включить преобразование речи в текст | ⚠️ Может исп. облачные сервисы | 💰 Возможно | ✅ Оставить |
| 27 | **engineSTT** | localStorage (Recoil) | `browser\|api_key` | Движок STT (браузер или API) | ✅ Безопасно | 💰 Зависит | ✅ Оставить |
| 28 | **languageSTT** | localStorage (Recoil) | `string` | Язык распознавания речи | ✅ Безопасно | ❌ Нет | ✅ Оставить |
| 29 | **autoTranscribeAudio** | localStorage (Recoil) | `boolean` | Автоматическое транскрибирование | ✅ Безопасно | 💰 Возможно | ✅ Оставить |
| 30 | **decibelValue** | localStorage (Recoil) | `number` (-45) | Уровень децибелов для активации | ✅ Безопасно | ❌ Нет | ✅ Оставить |
| 31 | **autoSendText** | localStorage (Recoil) | `number` (-1) | Автоотправка после распознавания | ✅ Безопасно | ❌ Нет | ✅ Оставить |

**TTS (Text To Speech):**

| # | Название | Хранилище | Тип | Влияние | Безопасность | API Стоимость | Рекомендация |
|---|----------|-----------|-----|---------|--------------|---------------|--------------|
| 32 | **textToSpeech** | localStorage (Recoil) | `boolean` | Включить преобразование текста в речь | ⚠️ Может исп. облачные сервисы | 💰 Возможно | ✅ Оставить |
| 33 | **engineTTS** | localStorage (Recoil) | `browser\|api_key` | Движок TTS (браузер или API) | ✅ Безопасно | 💰 Зависит | ✅ Оставить |
| 34 | **voice** | localStorage (Recoil) | `string/undefined` | Выбранный голос TTS | ✅ Безопасно | ❌ Нет | ✅ Оставить |
| 35 | **cloudBrowserVoices** | localStorage (Recoil) | `boolean` | Использовать облачные голоса браузера | ⚠️ Отправляет данные в облако | 💰 Возможно | ⚠️ Предупредить |
| 36 | **languageTTS** | localStorage (Recoil) | `string` | Язык TTS | ✅ Безопасно | ❌ Нет | ✅ Оставить |
| 37 | **automaticPlayback** | localStorage (Recoil) | `boolean` | Автоматическое проигрывание TTS | ✅ Безопасно | ❌ Нет | ✅ Оставить |
| 38 | **playbackRate** | localStorage (Recoil) | `number/null` | Скорость проигрывания TTS | ✅ Безопасно | ❌ Нет | ✅ Оставить |
| 39 | **cacheTTS** | localStorage (Recoil) | `boolean` | Кешировать TTS локально | ✅ Безопасно | 💰 Экономит | ✅ Оставить |

**Conversation Mode:**

| # | Название | Хранилище | Тип | Влияние | Безопасность | API Стоимость | Рекомендация |
|---|----------|-----------|-----|---------|--------------|---------------|--------------|
| 40 | **conversationMode** | localStorage (Recoil) | `boolean` | Режим разговора (continuous voice) | ✅ Безопасно | 💰 Возможно | ✅ Оставить |
| 41 | **advancedMode** | localStorage (Recoil) | `boolean` | Продвинутые настройки речи | ✅ Безопасно | ❌ Нет | ✅ Оставить |

### PERSONALIZATION TAB (Персонализация)

| # | Название | Хранилище | Тип | Влияние | Безопасность | API Стоимость | Рекомендация |
|---|----------|-----------|-----|---------|--------------|---------------|--------------|
| 42 | **referenceSavedMemories** | API (User.personalization.memories) | `boolean` | Использовать сохранённые воспоминания | ⚠️ Требует feature flag | ❌ Нет | ✅ Оставить (если включено) |

### ACCOUNT TAB (Аккаунт)

| # | Название | Хранилище | Тип | Влияние | Безопасность | API Стоимость | Рекомендация |
|---|----------|-----------|-----|---------|--------------|---------------|--------------|
| 43 | **DisplayUsernameMessages** | localStorage (Recoil) | `boolean` | Показывать имя пользователя в сообщениях | ✅ Безопасно | ❌ Нет | ✅ Оставить |
| 44 | **Avatar** | API (User.avatar) | `upload/edit` | Загрузка/изменение аватара | ⚠️ File upload | 💰 Хранилище | ✅ Оставить |
| 45 | **TwoFactorAuthentication** | API (User.twoFactorEnabled) | `setup/disable` | Двухфакторная аутентификация (TOTP) | ✅ ОЧЕНЬ ВАЖНО | ❌ Нет | ✅ Оставить |
| 46 | **BackupCodes** | API (User.twoFactorBackupCodes) | `view` | Просмотр резервных кодов 2FA | ✅ Безопасно | ❌ Нет | ✅ Оставить |

---

## 2️⃣ КАТЕГОРИЯ: ADMIN SETTINGS (Администраторские настройки)

Эти настройки должны быть ПЕРЕНЕСЕНЫ В АДМИНКУ или скрыты от обычных пользователей.

### DATA TAB (Опасные данные)

| # | Название | Текущее место | Что делает | Рисди | Рекомендация | Место переноса |
|---|----------|---------------|-----------|-------|--------------|-----------------|
| 47 | **ClearChats** | Data → Delete Button | Удаление ВСЕх чатов пользователя | 🚨 НЕОБРАТИМО | 🚨 Требует двойное подтверждение | Оставить, но со страховкой |
| 48 | **RevokeKeys** | Data → Button | Отзыв API ключей | 🚨 Может сломать интеграции | ⚠️ Перенести в Account | Admin Settings / API Management |
| 49 | **AgentApiKeys** | Data → Button (если REMOTE_AGENTS) | Управление API ключами для агентов | ⚠️ Чувствительные данные | ⚠️ Перенести в Account | Admin Settings / API Keys |
| 50 | **DeleteCache** | Data → Button | Очистка локального кеша | ✅ Безопасно | ✅ Оставить | Data Tab |

### BALANCE TAB (Финансовые настройки)

| # | Название | Текущее место | Что делает | Риски | Рекомендация | Примечание |
|---|----------|---------------|-----------|-------|--------------|-----------|
| 51 | **autoRefillEnabled** | Balance → Read-only | Статус автопополнения | ⚠️ Влияет на расходы | ⚠️ Администратор может настраивать | Backend-только, в админке |
| 52 | **refillAmount** | Balance → Read-only | Сумма пополнения | ⚠️ КРИТИЧНО | ⚠️ Администратор может настраивать | Backend-только, в админке |
| 53 | **refillIntervalUnit/Value** | Balance → Read-only | Интервал пополнения | ⚠️ КРИТИЧНО | ⚠️ Администратор может настраивать | Backend-только, в админке |
| 54 | **tokenCredits** | Balance → Read-only | Текущий баланс токенов | ✅ Информационно | ✅ Оставить | Только просмотр, без редактирования |

---

## 3️⃣ КАТЕГОРИЯ: DANGEROUS SETTINGS (Опасные настройки)

Эти настройки могут СЛОМАТЬ СИСТЕМУ, УВЕЛИЧИТЬ РАСХОДЫ или НАРУШИТЬ БЕЗОПАСНОСТЬ.

| # | Название | Где находится | Опасность | Текущий контроль | Рекомендация |
|---|----------|---------------|-----------|-----------------|--------------|
| 55 | **cloudBrowserVoices** | Speech → Switch | Отправляет данные в облако (Google/Apple) | ⚠️ Минимальный | 🚨 Требует explicit consent + warning |
| 56 | **autoTranscribeAudio** | Speech → Switch | Может срабатывать в фоне, отправляя аудио на API | ⚠️ Нет рилимитов | 🚨 Добавить rate limiting + cost warning |
| 57 | **conversationMode + TTS** | Speech → Switch | Бесконечный голосовой режим может в 10x увеличить расходы TTS | 🚨 КРИТИЧНО | 🚨 Скрыть или требует явного согласия на расходы |
| 58 | **ClearChats** | Data → Delete | Удаление всех чатов без восстановления | 🚨 НЕОБРАТИМО | 🚨 Требует 3-step confirmation + SMS code |

---

## 📌 ИТОГОВЫЕ РЕКОМЕНДАЦИИ ПО КАТЕГОРИЗАЦИИ

### ✅ ОСТАВИТЬ ПОЛЬЗОВАТЕЛЮ (USER SETTINGS)

Все настройки из категории **USER SETTINGS** (1-46) должны оставаться доступны пользователю в Settings меню.

Это безопасные настройки, которые:
- Не влияют на безопасность системы
- Не имеют финансовых последствий (кроме TTS/STT которые управляются API лимитами)
- Полностью находятся в контроле пользователя
- Хранятся локально (localStorage) или в безопасной части профиля API

### ⚠️ ПЕРЕНЕСТИ В АДМИНКУ (ADMIN SETTINGS)

1. **RevokeKeys** (API ключи)
   - Переместить в Admin Panel → Users → [Username] → API Keys
   - Требует многоуровневое подтверждение

2. **AgentApiKeys** (Управление ключами агентов)
   - Переместить в Admin Panel → API Management → Agent Keys
   - Требует аудит логирования

3. **refillAmount, refillIntervalUnit/Value, autoRefillEnabled**
   - Переместить в Admin Panel → Users → [Username] → Billing Management
   - Обычный пользователь может только ПРОСМОТРЕТЬ текущие настройки
   - Изменение требует admin approval

4. **DeleteCache** (если содержит критичные данные)
   - Для пользователя: оставить, но скрыть детали
   - Для админа: подробная информация о кеше

### 🚨 СКРЫТЬ ИЛИ ЗАБЛОКИРОВАТЬ (DANGEROUS SETTINGS)

1. **cloudBrowserVoices**
   - Требует явного согласия перед включением
   - Добавить warning о передаче данных в облако
   - Сохранять в localStorage с меткой timestamp

2. **autoTranscribeAudio**
   - Требует явного согласия
   - Добавить rate limiting (макс 10 запросов в минуту)
   - Показывать стоимость API на интерфейсе
   - Добавить timeout (автоматически выключается через 30 минут)

3. **conversationMode + TTS комбинация**
   - Требует EXPLICIT warning о потенциальной стоимости
   - Ограничить время сессии (максимум 30 минут)
   - Добавить cost tracker на интерфейсе

4. **ClearChats**
   - 3-step confirmation process:
     - Клик на кнопку "Clear All Chats"
     - Ввод пароля
     - Подтверждение по email (если включено)
   - Логировать все попытки удаления
   - Добавить "Recover Chats" функцию (7 дней)

---

## 🎯 ОПТИМАЛЬНАЯ СТРУКТУРА ИНТЕРФЕЙСА SETTINGS

### ТЕКУЩАЯ СТРУКТУРА (8 ВКЛАДОК)
```
├── 1. General       → Theme, Language, UI Preferences
├── 2. Chat         → Chat behavior, Fork settings, Display
├── 3. Commands     → @, +, / commands toggle
├── 4. Speech       → STT/TTS settings
├── 5. Personalization → Memory settings
├── 6. Data         → Import/Export, Clear Cache, Clear Chats
├── 7. Balance      → Token Credits, Auto-refill status
└── 8. Account      → Avatar, 2FA, Username, Delete Account
```

### РЕКОМЕНДУЕМАЯ НОВАЯ СТРУКТУРА

#### Пользовательская часть (Оставить как есть):
```
├── 1. General       → Theme, Language, UI (без изменений)
├── 2. Chat         → Chat behavior, Fork settings, Display (без изменений)
├── 3. Commands     → Commands toggle (без изменений)
├── 4. Speech       → STT/TTS settings + warnings (УЛУЧШИТЬ)
├── 5. Personalization → Memory settings (без изменений)
├── 6. Data         → Import/Export, Clear Cache (ПЕРЕРАБОТАТЬ)
│   ├── Clear Cache (✅ Оставить)
│   ├── Shared Links (✅ Оставить)
│   ├── Revoke Keys  (❌ СКРЫТЬ - только Admin)
│   └── ClearChats  (🚨 Переместить в Account с warnings)
├── 7. Balance      → Token Credits (read-only) (без изменений)
└── 8. Account      → Avatar, 2FA, Username, Delete Account
    ├── Avatar (✅ Оставить)
    ├── 2FA (✅ Оставить)
    ├── Username (✅ Оставить)
    ├── Clear Chats (🚨 ПЕРЕМЕСТИТЬ с 3-step confirmation)
    └── Delete Account (🚨 Оставить, но укрепить)
```

---

## 🔐 SECURITY & COMPLIANCE ЧЕКЛИСТ

### Для USER SETTINGS:
- [x] Все настройки хранятся локально (localStorage)
- [x] Нет доступа к чувствительным данным
- [x] Нет влияния на другие пользователи
- [x] Нет прямого влияния на стоимость (кроме API лимитов)

### Для DANGEROUS SETTINGS:
- [ ] ⚠️ `cloudBrowserVoices` - требует warning + consent
- [ ] ⚠️ `autoTranscribeAudio` - требует rate limiting
- [ ] ⚠️ `conversationMode` - требует cost warning
- [ ] ⚠️ `ClearChats` - требует 3-step confirmation + recovery

### Для ADMIN SETTINGS:
- [ ] ⚠️ API Keys - только admin может просматривать/менять
- [ ] ⚠️ Billing settings - требует audit log
- [ ] ⚠️ Auto-refill - требует approval workflow
- [ ] ⚠️ User data - требует encryption in transit

---

## 🛡️ РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ БЕЗОПАСНОСТИ

### 1. Добавить Cost Warnings
```typescript
// Для Speech TAB - показывать приблизительную стоимость:
- STT: "~$0.10 за 1 час аудио"
- TTS: "~$0.05 за 1000 символов"
- Conversation Mode: "~$0.50 за 30 минут"
```

### 2. Добавить Consent Management
```typescript
// Для опасных настроек требовать явное согласие:
interface DangerousSettingConsent {
  settingId: string;
  agreedAt: Date;
  agreedVersion: string;
  consentText: string; // i18n
}
```

### 3. Добавить Audit Logging
```typescript
// Логировать все изменения опасных настроек:
interface SettingChangeLog {
  userId: string;
  settingId: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}
```

### 4. Добавить Rate Limiting для TTS/STT
```typescript
// Ограничить использование:
interface SpeechRateLimit {
  stt: { maxRequestsPerMinute: 10, maxHoursPerDay: 3 }
  tts: { maxCharactersPerDay: 50000, maxConcurrent: 2 }
  conversationMode: { maxSessionDuration: 30 }
}
```

### 5. Добавить Recovery для ClearChats
```typescript
// Хранить удалённые чаты 7 дней перед окончательным удалением:
interface DeletedChat {
  chatId: string;
  deletedAt: Date;
  expiresAt: Date; // +7 days
  userId: string;
  recoveryData: string; // encrypted
}
```

---

## 📈 IMPACT ANALYSIS (Анализ влияния)

### По безопасности:
- ✅ 42 настройки = полностью безопасны
- ⚠️ 4 настройки = требуют улучшений
- 🚨 4 настройки = критичные, требуют строгого контроля

### По стоимости API:
- ❌ 46 настроек не влияют на стоимость
- 💰 4 настройки могут повлиять на стоимость (TTS/STT/Conversation)

### По UX:
- 📱 8 вкладок = оптимальное количество
- 📋 50+ отдельных опций = может быть переполнено
- 💡 Рекомендация: сохранить структуру, но добавить dividers и help text

---

## 🚀 QUICK ACTION PLAN (План действий)

### Неделя 1: Критичные изменения
1. [ ] Добавить 3-step confirmation для ClearChats
2. [ ] Добавить warning для cloudBrowserVoices
3. [ ] Добавить rate limiting для autoTranscribeAudio
4. [ ] Скрыть RevokeKeys из Data tab

### Неделя 2-3: Улучшения UX
1. [ ] Добавить cost warnings для Speech tab
2. [ ] Добавить consent management
3. [ ] Улучшить документацию в hover cards

### Неделя 4: Backend безопасность
1. [ ] Добавить audit logging для опасных настроек
2. [ ] Добавить recovery для ClearChats
3. [ ] Улучшить validation на backend

---

## ✨ ЗАКЛЮЧЕНИЕ

LibreChat имеет **хорошо спроектированную систему Settings**, но требует:

1. **Укрепления безопасности** для опасных операций (ClearChats, API Keys)
2. **Добавления warnings** для затратных операций (Speech features)
3. **Переноса админских настроек** в отдельныйAdmin Panel
4. **Улучшения UX** с добавлением more help text и cost indicators

**Общий рейтинг безопасности:** 7/10 (требуется улучшение)
