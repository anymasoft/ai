# 🔍 ДИАГНОСТИКА: Автоматический запуск диалога при возврате из админ-панели

## НАЙДЕННАЯ ПРИЧИНА ✓

Проблема в файле **useQueryParams.ts** - хук обрабатывает URL параметры:
- `prompt=...` — текст сообщения
- `submit=true` — флаг автоматической отправки

Когда параметры присутствуют, сообщение отправляется **автоматически без явного клика пользователя**.

---

## 📍 МЕСТА В КОДЕ

### 1️⃣ ГЛАВНОЕ МЕСТО: `/client/src/hooks/Input/useQueryParams.ts` (строка 306)

```typescript
// Строка 306
const shouldAutoSubmit = queryParams.submit?.toLowerCase() === 'true';

// Строка 336-338
if (!shouldAutoSubmit) {
  submissionHandledRef.current = true;
}

// Строка 371-395 - АВТОМАТИЧЕСКАЯ ОТПРАВКА!
if (shouldAutoSubmit && decodedPrompt) {
  if (Object.keys(validSettings).length > 0) {
    pendingSubmitRef.current = true;
    // ...отложенная отправка
  } else {
    methods.setValue('text', decodedPrompt, { shouldValidate: true });
    methods.handleSubmit((data) => {
      if (data.text?.trim()) {
        submitMessage(data);  // ← АВТОМАТИЧЕСКАЯ ОТПРАВКА!
      }
    })();
  }
}
```

**Проблема:** Если URL содержит `?prompt=текст&submit=true`, сообщение будет отправлено автоматически.

---

### 2️⃣ ВТОРИЧНОЕ МЕСТО: `/client/src/routes/AdminPanel.tsx` (строка 404)

```typescript
<button
  onClick={() => {
    clearAllConversations(true);
    navigate('/c/new');  // ← Простая навигация БЕЗ очистки параметров!
  }}
>
  ← Вернуться в чат
</button>
```

**Проблема:** При клике на кнопку:
1. Очищаются разговоры
2. Навигирует на `/c/new` БЕЗ очистки параметров query string

Если браузер сохранил в истории или сессии URL с параметрами, они могут остаться активными.

---

### 3️⃣ ТРИГГЕР: `/client/src/hooks/useNewConvo.ts` (строка 244-245)

```typescript
if (conversation.conversationId === Constants.NEW_CONVO && !modelsData) {
  const path = `/c/${Constants.NEW_CONVO}${getParams()}`;
  navigate(path, { state: { focusChat: true } });
  return;
}
```

**Проблема:** При переходе на новый чат (`/c/new`), функция `getParams()` добавляет параметры поиска, которые:
- Могли быть сохранены в памяти
- Переносятся на новый URL
- Триггерят `useQueryParams`

---

## 🎯 СЦЕНАРИЙ ВОСПРОИЗВЕДЕНИЯ

1. Пользователь открывает чат с параметром: `/c/new?prompt=Hello&submit=true` (может быть через ссылку)
2. Сообщение отправляется автоматически
3. Пользователь открывает админ-панель из меню аватара
4. Нажимает "Вернуться в чат" → `navigate('/c/new')`
5. **BUG:** Старые параметры `?prompt=Hello&submit=true` остаются в памяти/истории
6. При переходе на `/c/new`, useQueryParams опять видит эти параметры
7. **РЕЗУЛЬТАТ:** Сообщение отправляется СНОВА без явного запроса

---

## 🔧 ВАРИАНТЫ ИСПРАВЛЕНИЯ

### ВАРИАНТ 1: Очистить параметры в AdminPanel (РЕКОМЕНДУЕТСЯ) ✅

**Файл:** `/client/src/routes/AdminPanel.tsx` (строка 401-409)

```typescript
<button
  onClick={() => {
    clearAllConversations(true);
    // Очистить параметры перед навигацией
    window.history.replaceState({}, '', '/c/new');
    navigate('/c/new');
  }}
>
  ← Вернуться в чат
</button>
```

**Плюсы:**
- Простое исправление в одну строку
- Очищает историю браузера
- Защита от повторной отправки
- Работает сразу без побочных эффектов

**Минусы:**
- Очищает всю историю (может повлиять на back button поведение)

---

### ВАРИАНТ 2: Отслеживать обработку параметров (БОЛЕЕ НАДЕЖНО)

**Файл:** `/client/src/hooks/Input/useQueryParams.ts`

Добавить проверку: если параметры уже обработаны, не обрабатывать снова:

```typescript
// Добавить в начало useEffect (около строки 297)
const processedParamsRef = useRef<string>('');

// Затем в useEffect:
useEffect(() => {
  const processQueryParams = () => {
    const currentParamString = searchParams.toString();

    // ДОБАВИТЬ: Проверка дублирования
    if (currentParamString === processedParamsRef.current && currentParamString !== '') {
      console.log('[useQueryParams] Skipping duplicate parameter processing');
      return null;
    }

    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const decodedPrompt = queryParams.prompt || queryParams.q || '';
    const shouldAutoSubmit = queryParams.submit?.toLowerCase() === 'true';
    // ... остальной код

    // Сохраняем строку параметров
    processedParamsRef.current = currentParamString;

    return { decodedPrompt, validSettings, shouldAutoSubmit };
  };

  // ... продолжение кода
}, [searchParams, /* другие зависимости */]);
```

**Плюсы:**
- Очень надежная защита от дублирования
- Работает независимо от источника параметров
- Не повлияет на back button

**Минусы:**
- Требует изменения в более сложный хук
- Дополнительное состояние

---

### ВАРИАНТ 3: Добавить дополнительный флаг в sessionStorage

**Файл:** `/client/src/hooks/Input/useQueryParams.ts` (строка 275-295)

```typescript
const processSubmission = useCallback(() => {
  if (submissionHandledRef.current || !pendingSubmitRef.current || !promptTextRef.current) {
    return;
  }

  // ДОБАВИТЬ: Проверка, что это не повторная обработка
  const lastSubmitTime = sessionStorage.getItem('lastAutoSubmitTime');
  const lastSubmitText = sessionStorage.getItem('lastAutoSubmitText');
  const now = Date.now();

  if (
    lastSubmitTime &&
    lastSubmitText === promptTextRef.current &&
    now - parseInt(lastSubmitTime) < 5000
  ) {
    // Если менее 5 сек назад и тот же текст, это повторная обработка - пропустить
    console.log('Skipping duplicate auto-submit within 5s window');
    return;
  }

  submissionHandledRef.current = true;
  pendingSubmitRef.current = false;
  sessionStorage.setItem('lastAutoSubmitTime', String(now));
  sessionStorage.setItem('lastAutoSubmitText', promptTextRef.current);

  methods.setValue('text', promptTextRef.current, { shouldValidate: true });

  methods.handleSubmit((data) => {
    if (data.text?.trim()) {
      submitMessage(data);

      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      console.log('Message submitted with conversation state:', conversation);
    }
  })();
}, [methods, submitMessage, conversation]);
```

**Плюсы:**
- Работает с временным окном (5 сек)
- Учитывает содержимое сообщения
- Не влияет на back button

**Минусы:**
- Может заблокировать законный повторный отправок одного сообщения

---

## 📊 СРАВНЕНИЕ РЕШЕНИЙ

| Решение | Простота | Надежность | Побочные эффекты | Рекомендация |
|---------|----------|-----------|-----------------|--------------|
| Вариант 1 (очистка URL) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Может повлиять на back button | **НАЧНИТЕ ОТСЮДА** |
| Вариант 2 (отслеживание) | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Минимальные побочные эффекты | **ЕСЛИ 1 НЕ СРАБОТАЕТ** |
| Вариант 3 (sessionStorage) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Может заблокировать законные действия | **ПОСЛЕДНЯЯ ОПЦИЯ** |

---

## 🎬 РЕКОМЕНДУЕМАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ИСПРАВЛЕНИЙ

### ШАГ 1: Исправить AdminPanel (Вариант 1)
- **Файл:** `packages/client/src/routes/AdminPanel.tsx`
- **Изменение:** 1 строка кода
- **Риск:** НИЗКИЙ
- **Время:** 2 минуты

### ШАГ 2: Если остается проблема → Добавить отслеживание (Вариант 2)
- **Файл:** `packages/client/src/hooks/Input/useQueryParams.ts`
- **Изменение:** ~10 строк кода
- **Риск:** ОЧЕНЬ НИЗКИЙ
- **Время:** 10 минут

### ШАГ 3: Если нужна абсолютная защита → Добавить sessionStorage (Вариант 3)
- **Файл:** `packages/client/src/hooks/Input/useQueryParams.ts`
- **Изменение:** ~15 строк кода
- **Риск:** НИЗКИЙ (но требует тестирования)
- **Время:** 15 минут

---

## 📝 ТЕСТИРОВАНИЕ

После каждого исправления проверьте:

1. **Базовый сценарий:**
   - Откройте админ-панель
   - Нажмите "Вернуться в чат"
   - Убедитесь, что сообщение НЕ отправляется автоматически

2. **Сценарий с параметрами:**
   - Откройте URL с параметром: `/c/new?prompt=test&submit=true`
   - Убедитесь, что сообщение отправляется только ОДИН раз
   - Нажмите back и forward в браузере
   - Убедитесь, что сообщение не отправляется снова

3. **Сценарий с админ-панелью и параметрами:**
   - Откройте URL с параметром: `/c/new?prompt=test&submit=true`
   - Откройте админ-панель
   - Нажмите "Вернуться в чат"
   - Убедитесь, что сообщение не отправляется второй раз

---

## 🐛 ДОПОЛНИТЕЛЬНЫЕ ЗАМЕЧАНИЯ

### Потенциальный источник параметров:
1. **Прямые ссылки** - пользователь получил ссылку с параметрами
2. **История браузера** - параметры сохранены в истории
3. **Восстановление сессии** - браузер восстановил вкладку с параметрами
4. **Скрипты/расширения** - расширения браузера могут добавлять параметры

### Почему это происходит именно при возврате из админ-панели:
- `clearAllConversations(true)` очищает разговоры, но НЕ очищает параметры поиска
- `navigate('/c/new')` переходит на тот же URL но с новым состоянием
- `useQueryParams` запускается и видит старые параметры в URL bar браузера
- Результат: повторная автоматическая отправка

---

## ✅ КРАТКИЙ ИТОГ

**ГЛАВНАЯ ПРИЧИНА:** URL параметры `?prompt=...&submit=true` остаются активными при возврате из админ-панели, триггеря повторную автоматическую отправку.

**РЕШЕНИЕ:** Очистить URL параметры перед навигацией в AdminPanel.

**ФАЙЛ:** `packages/client/src/routes/AdminPanel.tsx`, строка 404

**КОД:** Добавить `window.history.replaceState({}, '', '/c/new');` перед `navigate('/c/new');`
