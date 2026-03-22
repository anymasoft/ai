# Документация проекта dgdat2xlsx

## Общее описание

Конвейер обработки данных 2ГИС: бинарные файлы `.dgdat` → таблицы `.xlsx` → нормализованная база SQLite.

```
.dgdat (бинарный) ──→ convert.py ──→ .xlsx ──→ import_db.py ──→ SQLite
```

---

## 1. convert.py — Парсер dgdat → XLSX

**Расположение:** `dgdat2xlsx/convert.py`

### Назначение
Читает бинарные файлы формата 2ГИС (.dgdat), извлекает данные об организациях, формирует XLSX-таблицы.

### Запуск
```bash
# Все файлы из download/ → output/
python convert.py

# Один файл
python convert.py path/to/file.dgdat

# С указанием выходного файла
python convert.py input.dgdat output.xlsx
```

### Настройки (переменные в начале файла)
| Переменная | Значение по умолчанию | Описание |
|---|---|---|
| `DGDAT_DIR` | `./download` | Папка с входными .dgdat |
| `XLSX_DIR` | `./output` | Папка для выходных .xlsx |

### Ключевые классы и функции

#### `BinaryReader`
Низкоуровневое чтение бинарных данных из файла. Методы:
- `read_long()` — uint32 LE
- `read_short()` — uint16 LE
- `read_byte()` — один байт
- `read_string(length)` — строка в cp1251
- `seek(pos)`, `tell()`, `read(n)`

#### `parse_dgdat(filepath) → (dump, properties)`
Главная функция парсинга. Возвращает:
- `dump` — словарь с ключами: `rubrics`, `firms`, `building_names`, `building_purposes`, `phones`, `working_times`, `payment_types`
- `properties` — метаданные (name, version и пр.)

Подфункции парсинга (вызываются внутри `parse_dgdat`):
- `read_rubrics()` — дерево рубрик (ID → name/parent)
- `read_firms()` — организации
- `read_addresses()` — адреса зданий
- `read_building_info()` — названия/назначения строений
- `read_phones()` — телефоны и факсы
- `read_working_times()` — расписания
- `read_payment_types()` — типы оплаты
- `read_contacts()` — email, сайты, соцсети

#### `build_all_rows(dump) → list[list]`
Формирует плоский список строк (23 колонки каждая) для записи в XLSX. Одна организация может давать несколько строк (по количеству адресов/филиалов).

#### `write_xlsx(rows, output_path)`
Создаёт новый XLSX-файл с заголовками и стилями.

#### `xlsx_matches_rows(rows, xlsx_path) → bool`
Сравнивает существующий XLSX с новыми данными. Если количество строк и все ячейки совпадают — возвращает True.

#### `convert_file(input_file, output_file)`
Оркестратор: парсит dgdat → формирует строки → сравнивает с существующим xlsx → создаёт/перезаписывает при расхождении.

### Стратегия синхронизации
- dgdat — единственный источник истины
- При расхождении xlsx полностью перезаписывается (не инкрементальное обновление)
- Если данные идентичны — файл не трогается

### Формат выходных колонок (23 шт.)
| # | Колонка | Описание |
|---|---|---|
| 1 | ID | Числовой ID организации из 2ГИС |
| 2 | Название организации | Полное название |
| 3 | Населенный пункт | Город/посёлок |
| 4 | Раздел | Верхний уровень рубрикатора |
| 5 | Подраздел | Средний уровень |
| 6 | Рубрика | Нижний уровень (может содержать \n) |
| 7 | Телефоны | Номера через \n |
| 8 | Факсы | Факсы через \n |
| 9 | Email | Электронная почта |
| 10 | Сайт | URL |
| 11 | Адрес | Улица, дом |
| 12 | Почтовый индекс | 6 цифр |
| 13 | Типы платежей | Способы оплаты |
| 14 | Время работы | Расписание (многострочное) |
| 15 | Собственное название строения | Название здания |
| 16 | Назначение строения | Тип здания |
| 17–23 | Соцсети | VK, Facebook, Skype, Twitter, Instagram, ICQ, Jabber |

---

## 2. import_db.py — Импорт XLSX → SQLite

**Расположение:** `dgdat2xlsx/import_db.py`

### Назначение
Читает все XLSX из папки, создаёт нормализованную SQLite-базу. Идемпотентен — повторный запуск не создаёт дублей.

### Запуск
```bash
python import_db.py
```

### Настройки (переменные в начале файла)
| Переменная | Значение по умолчанию | Описание |
|---|---|---|
| `XLSX_FOLDER` | `./output` | Папка с .xlsx файлами |
| `DB_PATH` | `./data/local.db` | Путь к SQLite-базе |

### Схема БД (8 таблиц)

```
companies ──< branches ──< phones
    │
    ├──< company_aliases
    ├──< emails
    ├──< socials
    └──<> company_categories >──< categories (self-ref parent_id)
```

#### `companies`
| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | ID из XLSX (из 2ГИС) |
| name | TEXT | Название |
| city | TEXT | Город |
| website | TEXT | URL сайта |
| domain | TEXT | Домен (извлечён из URL) |
| created_at | TEXT | Дата создания |
| updated_at | TEXT | Дата обновления |

#### `company_aliases`
Альтернативные названия (если при повторном импорте name отличается).
UNIQUE(company_id, name).

#### `branches`
Филиалы компании. Идентифицируются по `branch_hash = MD5(company_id + normalized_address)`.

#### `phones`
Телефоны и факсы, привязаны к branch_id. UNIQUE(branch_id, phone).

#### `emails`
Email компании. UNIQUE(company_id, email).

#### `socials`
Соцсети. Типы: vk, facebook, skype, twitter, instagram, icq, jabber. UNIQUE(company_id, type, url).

#### `categories`
Дерево категорий (self-referencing через parent_id).
- Раздел → корневой узел (parent_id IS NULL)
- Подраздел → дочерний узел раздела
- Рубрика → дочерний узел подраздела

Разделители: `\n` — несколько значений, `/` — вложенность.

#### `company_categories`
Связь many-to-many. Компания привязывается к листовым категориям.

### Ключевые функции

#### `init_db(db_path) → Connection`
Создаёт БД и таблицы. Включает WAL-режим и foreign keys.

#### `process_file(conn, xlsx_path) → dict`
Обрабатывает один файл. Возвращает `{rows, companies_new, branches_new}`.

#### `process_row(cur, values, stats)`
Обрабатывает одну строку: upsert компании, филиала, телефонов, email, соцсетей, категорий.

#### `extract_domain(website) → str|None`
Извлекает домен: `http://www.example.com/page` → `example.com`.

#### `make_branch_hash(company_id, address) → str`
MD5-хеш для уникальной идентификации филиала.

#### `get_or_create_category(cur, name, parent_id) → int`
Находит или создаёт категорию, возвращает id.

#### `process_categories(cur, company_id, section, subsection, rubric)`
Строит дерево категорий из трёх полей и связывает с компанией.

### Идемпотентность
- Компании: SELECT → INSERT или UPDATE (COALESCE для пустых полей)
- Филиалы: поиск по branch_hash → INSERT или UPDATE
- Телефоны/email/соцсети/категории: INSERT OR IGNORE
- Повторный запуск: 0 новых записей, данные обновляются на месте
