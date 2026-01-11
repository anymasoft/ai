# Тестирование платежной системы ЮКасса

## Полный цикл платежа

### Шаг 1: Инициация платежа
1. Перейти на `/billing`
2. Нажать кнопку "Пополнить" на одном из пакетов (например, Basic - 990₽)
3. **Логи в терминале:**
   ```
   [YooKassa] Payment created: <paymentId> for user <userId>
   [YooKassa] Payment saved to DB: <paymentId>, status='pending'
   ```

### Шаг 2: Оплата в ЮКасса
1. Вы будете перенаправлены на форму ЮКасса
2. В режиме разработки (Sandbox):
   - Карта: `4111 1111 1111 1111`
   - Срок: `12/25`
   - CVC: `123`
   - Имя: `любое`
3. Нажать "Оплатить"

### Шаг 3: Возврат и polling
1. Вы вернетесь на `/billing?success=1`
2. Страница автоматически запустит **polling** (проверка каждую секунду)
3. **Логи в браузере (DevTools → Console):**
   ```
   [POLLING] Starting payment status check for paymentId: <paymentId>
   [POLLING] Attempt 1/60: Checking payment status...
   [POLLING] Check response: status=pending, success=false
   [POLLING] Attempt 2/60: Checking payment status...
   ...
   [POLLING] Check response: status=succeeded, success=true
   [POLLING] ✅ Payment succeeded! Fetching updated balance...
   [POLLING] Current balance: 50
   ```

### Шаг 4: Backend проверка статуса
**Логи в терминале сервера:**
```
[CHECK] Checking payment (userId: <userId>)
[CHECK] Found payment in DB: status=pending, userId=<userId>
[CHECK] Payment is pending, checking YooKassa API...
[CHECK] YooKassa response: status=succeeded, paid=true
[CHECK] ✅ YooKassa confirmed succeeded (status=succeeded, paid=true), applying payment...
[applySuccessfulPayment] Processing payment: <paymentId>
[applySuccessfulPayment] Found payment: userId=<userId>, packageKey=basic, status=pending
[applySuccessfulPayment] Adding 50 generations to user <userId>
[applySuccessfulPayment] Balance update for user <userId>: 0 + 50 = 50 (changes: 1)
[applySuccessfulPayment] Updated status for payment <paymentId> to succeeded
[applySuccessfulPayment] ✅ Success! Payment <paymentId> activated for user <userId>
[CHECK] applySuccessfulPayment result: success=true, reason=none
[CHECK] ✅ SUCCESS: Payment <paymentId> applied for user <userId>
[BALANCE] GET balance for user <userId>: balance=50, used=0
```

### Шаг 5: Обновление баланса на странице
1. Баланс на странице обновляется **без перезагрузки** на 50 кредитов
2. Сообщение об успехе: "✓ Платеж успешно выполнен! Кредиты добавлены. Баланс: 50"
3. URL очищается (убирается `?success=1` параметр)

---

## Что должно быть видно

### В браузере:
- ✅ Баланс обновляется без перезагрузки страницы
- ✅ Отображается успешное сообщение с новым балансом
- ✅ URL очищается от параметров успеха

### В терминале сервера:
- ✅ Логи создания платежа (create endpoint)
- ✅ Логи проверки статуса (check endpoint)
- ✅ Логи обновления баланса в БД (applySuccessfulPayment)
- ✅ Логи получения баланса (balance endpoint)

### В DevTools браузера:
- ✅ Логи polling попыток
- ✅ Финальное значение баланса после успеха

---

## Возможные проблемы

### Polling зависает на "pending"
- Проверьте, что ЮКасса действительно обработала платеж
- Максимум ждет 60 секунд (60 попыток × 1 сек)
- Если по-прежнему pending - платеж на стороне ЮКасса может быть не завершен

### Баланс не обновляется
1. Проверьте логи терминала - есть ли ошибка в `applySuccessfulPayment`?
2. Проверьте БД:
   ```bash
   sqlite3 vr_ai.db "SELECT id, generation_balance, generation_used FROM users LIMIT 5;"
   ```
3. Проверьте статус платежа в таблице payments:
   ```bash
   sqlite3 vr_ai.db "SELECT id, externalPaymentId, status FROM payments ORDER BY createdAt DESC LIMIT 5;"
   ```

### ЮКасса возвращает ошибку
- Проверьте переменные окружения: `YOOKASSA_SHOP_ID` и `YOOKASSA_API_KEY`
- Убедитесь, что используете Sandbox (для разработки)
- Проверьте формат запроса к API

---

## Команды для отладки БД

```bash
# Посмотреть последние платежи
sqlite3 vr_ai.db "SELECT id, userId, externalPaymentId, amount, status FROM payments ORDER BY createdAt DESC LIMIT 10;"

# Посмотреть баланс пользователя
sqlite3 vr_ai.db "SELECT id, email, generation_balance, generation_used FROM users WHERE email LIKE '%@%.%' LIMIT 10;"

# Сброс баланса для тестирования
sqlite3 vr_ai.db "UPDATE users SET generation_balance = 0 WHERE email = 'your-email@example.com';"

# Удалить последний платеж
sqlite3 vr_ai.db "DELETE FROM payments WHERE id = (SELECT id FROM payments ORDER BY createdAt DESC LIMIT 1);"
```

---

## Ожидаемое поведение

✅ **Успешный платеж:**
```
User делает платеж (990₽)
  → Баланс увеличивается на 50 кредитов (Basic пакет)
  → Без перезагрузки страницы
  → В реальном времени (polling)
```

✅ **Все логи видны:**
```
Терминал: Create → Check → Apply → Update
Браузер: Polling попытки → Успех → Обновление баланса
```
