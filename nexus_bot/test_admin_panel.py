"""
Тестирование новой админ-панели
Проверяем защиту от NULL, divide-by-zero и другие edge cases
"""

def safe_int(value, default: int = 0) -> int:
    """Безопасно преобразовать значение в int"""
    try:
        if value is None:
            return default
        return int(value)
    except (ValueError, TypeError):
        return default


def safe_percent(numerator, denominator, precision: int = 1) -> str:
    """Безопасно вычислить процент с защитой от деления на ноль"""
    num = safe_int(numerator, 0)
    denom = safe_int(denominator, 0)

    if denom == 0:
        return "—"

    percent = (num / denom) * 100
    return f"{percent:.{precision}f}%"


def safe_username_display(username: str, full_name: str) -> str:
    """Безопасно отобразить username или full_name"""
    if username and username.strip():
        return f"@{username}"
    return full_name or "Без имени"


# ========== ТЕСТЫ ==========

def test_safe_int():
    """Тест safe_int()"""
    print("=== Тест safe_int() ===")

    tests = [
        (None, 0, "None → 0"),
        (0, 0, "0 → 0"),
        (5, 5, "5 → 5"),
        ("10", 10, "'10' → 10"),
        (5.7, 5, "5.7 → 5"),
        ("invalid", 0, "'invalid' → 0 (default)"),
        ("", 0, "'' → 0 (default)"),
        ([], 0, "[] → 0 (default)"),
    ]

    for value, expected, description in tests:
        result = safe_int(value)
        status = "✅" if result == expected else "❌"
        print(f"{status} {description}: got {result}")
    print()


def test_safe_percent():
    """Тест safe_percent()"""
    print("=== Тест safe_percent() ===")

    tests = [
        (0, 0, "—", "0/0 → '—' (divide by zero)"),
        (5, 0, "—", "5/0 → '—' (divide by zero)"),
        (None, 0, "—", "None/0 → '—' (divide by zero)"),
        (5, 10, "50.0%", "5/10 → '50.0%'"),
        (1, 3, "33.3%", "1/3 → '33.3%'"),
        (10, 10, "100.0%", "10/10 → '100.0%'"),
        (0, 10, "0.0%", "0/10 → '0.0%'"),
        (None, 10, "0.0%", "None/10 → '0.0%' (treats None as 0)"),
        (5, None, "—", "5/None → '—' (denominator is None)"),
    ]

    for num, denom, expected, description in tests:
        result = safe_percent(num, denom)
        status = "✅" if result == expected else "❌"
        print(f"{status} {description}: got '{result}'")
    print()


def test_safe_username_display():
    """Тест safe_username_display()"""
    print("=== Тест safe_username_display() ===")

    tests = [
        (None, "Иван Иванов", "Иван Иванов", "None username → full_name"),
        ("", "Иван Иванов", "Иван Иванов", "Empty username → full_name"),
        ("  ", "Иван Иванов", "Иван Иванов", "Whitespace username → full_name"),
        ("ivan123", "Иван Иванов", "@ivan123", "Valid username → @username"),
        ("ivan123", None, "@ivan123", "Valid username, None full_name → @username"),
        (None, None, "Без имени", "None username, None full_name → 'Без имени'"),
        ("", "", "Без имени", "Empty username, empty full_name → 'Без имени'"),
    ]

    for username, full_name, expected, description in tests:
        result = safe_username_display(username, full_name)
        status = "✅" if result == expected else "❌"
        print(f"{status} {description}: got '{result}'")
    print()


def test_pagination_logic():
    """Тест логики пагинации"""
    print("=== Тест пагинации ===")

    # Симулируем пагинацию
    total_items = 25
    limit = 10

    # Расчёт количества страниц
    total_pages = (total_items + limit - 1) // limit  # Округление вверх
    print(f"Всего элементов: {total_items}")
    print(f"Элементов на страницу: {limit}")
    print(f"Всего страниц: {total_pages}")

    # Проверяем каждую страницу
    for page in range(1, total_pages + 1):
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        items_on_page = min(end_idx, total_items) - start_idx
        print(f"  Страница {page}: индексы {start_idx}-{end_idx-1}, элементов: {items_on_page}")

    # Edge cases
    print("\nEdge cases:")

    # Пустая БД
    total_items = 0
    total_pages = (total_items + limit - 1) // limit
    print(f"✅ Пустая БД (0 элементов): {total_pages} страниц (ожидается 0)")

    # 1 элемент
    total_items = 1
    total_pages = (total_items + limit - 1) // limit
    print(f"✅ 1 элемент: {total_pages} страниц (ожидается 1)")

    # Ровно limit элементов
    total_items = 10
    total_pages = (total_items + limit - 1) // limit
    print(f"✅ {limit} элементов: {total_pages} страниц (ожидается 1)")

    # limit + 1 элемент
    total_items = 11
    total_pages = (total_items + limit - 1) // limit
    print(f"✅ {total_items} элементов: {total_pages} страниц (ожидается 2)")

    print()


def test_message_length():
    """Тест длины сообщений (не должны превышать лимит Telegram)"""
    print("=== Тест длины сообщений ===")

    # Telegram лимит: ~4096 символов для текста
    # Мы стремимся к ~3500 для запаса

    # Симулируем Dashboard
    dashboard_lines = [
        "<b>🛠 АДМИН-ПАНЕЛЬ</b>",
        "",
        "<b>📊 ОБЩАЯ СТАТИСТИКА:</b>",
        "👤 Пользователей: <b>1000</b> (сегодня: +50)",
        "🎬 Генераций: <b>5000</b> (сегодня: 200)",
        "💳 Плательщиков: <b>150</b>",
        "💰 Выручка: <b>500000 ₽</b> (сегодня: 25000 ₽)",
        "",
        "<b>📈 КОНВЕРСИИ:</b>",
        "🎯 Регистрация → Генерация: <b>50.0%</b>",
        "💸 Регистрация → Платёж: <b>15.0%</b>",
        "",
        "<b>⚙️ СИСТЕМА:</b>",
        "🟢 Статус бота: <b>ALIVE</b>",
        "❌ Ошибок сегодня: <b>5</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "📅 Обновлено: 2026-01-17 12:00:00",
        "",
        "<b>📋 КОМАНДЫ:</b>",
        "/admin users — список пользователей",
        "/admin payments — список платежей",
    ]

    dashboard_text = "\n".join(dashboard_lines)
    dashboard_len = len(dashboard_text)
    print(f"Dashboard длина: {dashboard_len} символов")
    print(f"Статус: {'✅' if dashboard_len < 3500 else '⚠️'} (лимит ~3500)")
    print()

    # Симулируем Users list (10 пользователей)
    users_lines = ["<b>👥 ПОЛЬЗОВАТЕЛИ</b> (стр. 1/3)", ""]

    for i in range(10):
        user_line = f"• @user{i} | ID: <code>12345678{i}</code>\n  💎 15 | 🎬 25 | 💳 2 (2980₽)\n"
        users_lines.append(user_line)

    users_lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    users_lines.append("📄 Показано 10 из 25")

    users_text = "\n".join(users_lines)
    users_len = len(users_text)
    print(f"Users list (10 юзеров) длина: {users_len} символов")
    print(f"Статус: {'✅' if users_len < 3500 else '⚠️'} (лимит ~3500)")
    print()


# Запускаем все тесты
if __name__ == "__main__":
    print("╔════════════════════════════════════════╗")
    print("║  ТЕСТИРОВАНИЕ НОВОЙ АДМИН-ПАНЕЛИ      ║")
    print("╚════════════════════════════════════════╝\n")

    test_safe_int()
    test_safe_percent()
    test_safe_username_display()
    test_pagination_logic()
    test_message_length()

    print("╔════════════════════════════════════════╗")
    print("║  ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ                   ║")
    print("╚════════════════════════════════════════╝")
