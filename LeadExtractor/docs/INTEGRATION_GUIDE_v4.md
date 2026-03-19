# 🔗 INTEGRATION GUIDE: RECALL-FIRST PIPELINE (v4.0)

## 📌 Для Frontend разработчиков

Backend теперь возвращает **ВСЕ** найденные контакты (нет ограничения `[:10]`).

### Что изменилось в API Response

#### БЫЛО (v3.0)
```json
{
  "emails": [
    {"email": "info@1cca.ru", "source_page": "https://1cca.ru"},
    {"email": "contact@1cca.ru", "source_page": "https://1cca.ru/contacts"}
  ],  // ← MAX 10 emails

  "phones": [
    {"phone": "+7 (383) 209-21-27", "source_page": "https://1cca.ru"},
    {"phone": "8-383-209-21-27", "source_page": "https://1cca.ru/contacts"}
  ],  // ← MAX 10 phones

  "sources": [
    "https://1cca.ru",
    "https://1cca.ru/contacts"
  ]  // ← MAX 10 sources
}
```

#### БУДЕТ (v4.0 — RECALL-FIRST)
```json
{
  "emails": [
    {"email": "info@1cca.ru", "source_page": "https://1cca.ru"},
    {"email": "contact@1cca.ru", "source_page": "https://1cca.ru/contacts"},
    {"email": "support@1cca.ru", "source_page": "https://1cca.ru/support"},
    {"email": "sales@1cca.ru", "source_page": "https://1cca.ru/about"},
    {"email": "hello@1cca.ru", "source_page": "https://1cca.ru/team"},
    ...  // ← NO LIMIT!!! (47 emails в этом примере)
  ],

  "phones": [
    {"phone": "+7 (383) 209-21-27", "source_page": "https://1cca.ru"},
    {"phone": "8-383-209-21-27", "source_page": "https://1cca.ru/contacts"},
    {"phone": "+7-383-262-16-42", "source_page": "https://1cca.ru/about"},
    {"phone": "(383) 209-21-27", "source_page": "https://1cca.ru/team"},
    {"phone": "383-209-21-27", "source_page": "https://1cca.ru/contacts"},
    ...  // ← NO LIMIT!!! (89 phones в этом примере)
  ],

  "sources": [
    "https://1cca.ru",
    "https://1cca.ru/about",
    "https://1cca.ru/contacts",
    "https://1cca.ru/team",
    "https://1cca.ru/support",
    ...  // ← NO LIMIT!!! (25 pages в этом примере)
  ]
}
```

### ⚠️ ВАЖНО: Больше Данных = Больше Ответственности

Теперь вернут **30-50+ контактов вместо 3-5**. Frontend должен готов обработать это.

---

## 🎨 React Component Изменения

### 1. ResultsTable.jsx

**ЗАДАЧА:** Обработать большое количество контактов красиво и эффективно.

#### Что нужно сделать

```jsx
// БЫЛО (v3.0): Просто отображали первые 10
const maxLen = Math.max(
  results[0].emails.length || 0,
  results[0].phones.length || 0,
  1  // ← MIN 1, even if empty!
)

// СТАЛО (v4.0): Обработать все контакты
const emails = result.emails || []
const phones = result.phones || []
const maxLen = Math.max(emails.length, phones.length, 1)

// ✅ Показать все (или implement pagination для больших списков)
```

#### Таблица должна поддерживать

```jsx
// Много контактов - может быть 30-50 в одной строке
// Solution 1: Pagination (разбить на страницы)
// Solution 2: Expandable rows (скрыть под "show more")
// Solution 3: Just scroll (если список не ОЧЕНЬ большой)

// Рекомендуемый подход: Expandable/Paginated внутри ячейки
<TableCell>
  {/* Show first 3, then "X more" button */}
  {emails.slice(0, 3).map(e => (
    <ContactLink key={e.email} type="email" value={e.email} />
  ))}
  {emails.length > 3 && (
    <ShowMoreButton
      count={emails.length - 3}
      onExpand={() => setExpanded(true)}
    />
  )}
</TableCell>
```

### 2. CSV Export (App.jsx)

**Изменение:** Export теперь содержит ВСЕ контакты.

```jsx
// handleExportCSV() должен обработать большие списки
const csv = results
  .filter(r => r.emails?.length > 0 || r.phones?.length > 0)
  .map(result => ({
    domain: parseDomain(result.emails[0]?.source_page || ''),
    emails: result.emails.map(e => e.email).join('; '),  // ← ALL!
    phones: result.phones.map(p => p.phone).join('; '),  // ← ALL!
    sources: [...new Set(
      [...(result.emails || []), ...(result.phones || [])]
        .map(c => c.source_page)
    )].join('; ')
  }))

// Рекомендация: Создать более структурированный CSV
// Вместо "emails: info@example.com; contact@example.com"
// Лучше: Отдельные строки для каждого контакта с source
```

### 3. Performance Considerations

```jsx
// ⚠️ БОЛЬШЕ ДАННЫХ = БОЛЬШЕ РЕНДЕРОВ

// БЫЛО: 3-5 контактов × 10-20 сайтов = быстро
// СТАЛО: 30-50 контактов × 10-20 сайтов = может быть медленнее

// Решения:
// 1. Virtualization (react-window, react-virtual)
// 2. Pagination (показать по 10 за раз)
// 3. Lazy loading (грузить на скролл)
// 4. Memoization (React.memo для List items)

// Рекомендуемый пример:
import { FixedSizeList as List } from 'react-window'

const ContactList = ({ contacts }) => (
  <List
    height={400}
    itemCount={contacts.length}
    itemSize={30}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        {contacts[index].email}
      </div>
    )}
  </List>
)
```

---

## 📊 Обработка Мусора в UI

### Проблема: Теперь больше false positives

Пример false positives:
```
- "123-456-7890" (может быть номер документа, не телефон)
- "info+tag@example.com" (plus addressing, тех адрес)
- "123456789" (номер счета, не телефон)
- "noreply@example.com" (автоматический адрес, не контакт)
```

### Решение 1: Confidence Scores (TODO)

Backend должен добавить score для каждого контакта:

```python
# FUTURE (v4.1):
all_phones[normalized] = {
    "original": phone_clean,
    "source": source_url,
    "confidence": 0.95,  # ← NEW!
    "source_type": "tel_link"  # ← NEW!
}
```

```json
{
  "phones": [
    {
      "phone": "+7 (383) 209-21-27",
      "source_page": "https://1cca.ru",
      "confidence": 0.99,  // ← tel: link (highest)
      "source_type": "tel_link"
    },
    {
      "phone": "123-456-7890",
      "source_page": "https://1cca.ru/about",
      "confidence": 0.45,  // ← LOW! Probably not a phone
      "source_type": "regex"
    }
  ]
}
```

### Решение 2: UI Filtering

Frontend может отфильтровать low-confidence контакты:

```jsx
const ConfidenceFilter = ({ contacts, minConfidence = 0.7 }) => {
  return contacts.filter(c => (c.confidence || 1.0) >= minConfidence)
}

// Usage
const highConfidencePhones = ConfidenceFilter(result.phones, 0.8)
const allPhones = result.phones  // Для экспорта
```

### Решение 3: Visual Indicators

```jsx
<ContactItem phone={phone}>
  <PhoneNumber>{phone.phone}</PhoneNumber>

  {phone.confidence && (
    <ConfidenceBadge confidence={phone.confidence}>
      {phone.confidence > 0.9 && '✓ High'}
      {phone.confidence > 0.7 && '? Medium'}
      {phone.confidence <= 0.7 && '⚠ Low'}
    </ConfidenceBadge>
  )}

  {phone.source_type && (
    <SourceBadge type={phone.source_type}>
      {/* tel_link → Tel link, regex → Regex found, etc. */}
    </SourceBadge>
  )}
</ContactItem>
```

---

## 🚀 Рекомендуемые Изменения Frontend (Priority)

### 🔴 CRITICAL (Do first)

- [ ] **ResultsTable.jsx**: Поддержать 30+ контактов
  - [ ] Implement pagination или expandable rows
  - [ ] Не ломаться при 50+ контактах

- [ ] **CSV Export**: Обработать все контакты
  - [ ] Export ВСЕ emails/phones (не only first 5)
  - [ ] Обязательно включить source_page для каждого

### 🟡 HIGH (Do soon)

- [ ] **Performance**: Оптимизировать для больших списков
  - [ ] Виртуализация (react-window) если список > 100 items
  - [ ] Мemoization для TableRow компонентов

- [ ] **Duplicate Handling**: Обработать дубликаты
  - [ ] Группировать одинаковые номера в разных форматах
  - [ ] Показать количество источников для каждого контакта

### 🟢 MEDIUM (Do later)

- [ ] **Confidence Scores**: Когда backend добавит
  - [ ] Отображать confidence indicator
  - [ ] Option to filter by confidence

- [ ] **Source Grouping**: Group контакты по source
  - [ ] "5 emails from /contacts page"
  - [ ] "8 phones from /about page"

---

## 📋 TESTING CHECKLIST

### Перед релизом на production

- [ ] Таблица не ломается с 50+ контактами
- [ ] CSV экспорт работает с 50+ контактами
- [ ] Скролл и pagination работают гладко
- [ ] Мобильная версия справляется (может потребоваться горизонтальный скролл)
- [ ] Дубликаты обработаны (или показаны красиво)
- [ ] Мусор не раздражает пользователя (или скрыт под "Low confidence")

### Test Cases

```
Test 1: Single website, 47 emails + 89 phones
- Should display all in table
- CSV should contain all
- No crashes or lag

Test 2: 20 websites, 500+ total contacts
- Performance should be acceptable
- Pagination/virtualization should work

Test 3: Many duplicates (same phone in different formats)
- Should be displayed or grouped clearly
- CSV should preserve all

Test 4: Low-confidence results (numbers from text)
- Should not confuse users
- Should be marked or filterable
```

---

## 🔗 API Response Versioning

### Backward Compatibility

Новые поля добавляются в response, но старые остаются:

```python
# v4.0 response (future)
{
  "emails": [
    {
      "email": "info@1cca.ru",
      "source_page": "https://1cca.ru",
      "confidence": 0.95,  # ← NEW (v4.1+)
      "source_type": "mailto_link"  # ← NEW (v4.1+)
    }
  ],
  "phones": [...],
  "sources": [...]
}

# Frontend should handle:
# 1. Old format (no confidence/source_type) → assume confidence 1.0
# 2. New format (with confidence/source_type) → use values

const getConfidence = (contact) => contact.confidence ?? 1.0
const getSourceType = (contact) => contact.source_type ?? 'unknown'
```

---

## 📝 QUICK REFERENCE

| Аспект | v3.0 | v4.0 |
|--------|------|------|
| **Max emails** | 10 | ∞ (no limit) |
| **Max phones** | 10 | ∞ (no limit) |
| **Typical values** | 3-5 | 30-50+ |
| **False positives** | Low (~5%) | Medium (~35%) |
| **Need confidence?** | No | **YES!** |
| **UI needs update** | No | **YES!** |
| **Performance impact** | None | Medium (> 100 items) |

---

## 🎯 Summary for Frontend Team

1. **More data coming**: 30-50 contacts per site instead of 3-5
2. **UI update needed**: Pagination/virtualization for large lists
3. **CSV handling**: All contacts will be exported
4. **Confidence filtering**: Will be added in v4.1 (prepare for it)
5. **Duplicate handling**: Group duplicates or show all (your choice)
6. **Performance**: Virtualize if > 100 items per page

**Status:** ✅ Backend ready, 🟡 Frontend needs update

---

**Questions?** Check `RECALL_FIRST_PIPELINE_v4.md` for detailed backend info.
