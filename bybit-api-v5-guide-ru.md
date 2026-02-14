# Полный гайд Bybit API v5 на русском языке

## Оглавление

1. [Введение и основные понятия](#введение)
2. [Аутентификация](#аутентификация)
3. [REST API — Структура запросов](#rest-api-структура)
4. [Market Data API — Получение данных о рынке](#market-data)
5. [Order Management API — Управление ордерами](#order-management)
6. [Position Management API — Управление позициями](#position-management)
7. [Account API — Операции с аккаунтом](#account-api)
8. [Asset API — Управление активами](#asset-api)
9. [WebSocket API — Real-time потоки данных](#websocket-api)
10. [Обработка ошибок и лучшие практики](#errors-and-best-practices)

---

## Введение {#введение}

Bybit API v5 — это унифицированный интерфейс для торговли различными продуктами:

- **Spot** — спот-торговля
- **Linear** — USDT перпетуальные контракты
- **Inverse** — инверсные контракты
- **Option** — опционы

Все API методы следуют единой структуре: `{хост}/{версия}/{продукт}/{модуль}`

**Основные хосты:**
- **Live**: `https://api.bybit.com`
- **Testnet**: `https://testnet.bybit.com`

**Версия**: `v5`

---

## Аутентификация {#аутентификация}

### Типы ключей

#### 1. System-generated API Keys (HMAC)
Сгенерированы Bybit, используют HMAC SHA256 для подписи.

#### 2. Auto-generated API Keys (RSA)
Вы генерируете публичный/приватный ключ через ПО, отправляете только публичный в Bybit.

### Создание API ключа

1. Зайти в Account Settings → API Management
2. Создать новый ключ
3. Выбрать разрешения (Spot trading, Derivatives, Asset transfer и т.д.)
4. Сохранить Secret Key (показывается один раз)

### Подпись запроса (HMAC)

Подпись создаётся по следующей формуле:

```
signature = HMAC_SHA256(secret_key, timestamp + api_key + recv_window + request_body)
```

**Параметры:**
- `timestamp` — текущее Unix время в миллисекундах
- `api_key` — ваш API ключ
- `recv_window` — окно времени валидности запроса (по умолчанию 5000 мс)
- `request_body` — тело запроса (для GET запросов это query string, для POST это JSON)

### Пример на Python

```python
import hmac
import hashlib
import requests
import json
from time import time

API_KEY = "your_api_key"
SECRET_KEY = "your_secret_key"
RECV_WINDOW = "5000"
ENDPOINT = "https://api.bybit.com/v5"

def generate_signature(timestamp, api_key, recv_window, payload):
    """Генерирует подпись для запроса"""
    param_str = str(timestamp) + api_key + recv_window + payload
    signature = hmac.new(
        SECRET_KEY.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature

def place_order(category, symbol, side, order_type, qty, price=None):
    """Пример: разместить ордер"""

    timestamp = str(int(time() * 1000))

    body = {
        "category": category,
        "symbol": symbol,
        "side": side,
        "orderType": order_type,
        "qty": str(qty),
    }

    if price:
        body["price"] = str(price)

    payload = json.dumps(body)
    signature = generate_signature(timestamp, API_KEY, RECV_WINDOW, payload)

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": API_KEY,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
        "Content-Type": "application/json"
    }

    url = f"{ENDPOINT}/order/create"
    response = requests.post(url, headers=headers, data=payload)

    return response.json()

# Использование
result = place_order(
    category="spot",
    symbol="BTCUSDT",
    side="Buy",
    order_type="Limit",
    qty=0.01,
    price=43000
)
print(result)
```

### Пример на JavaScript

```javascript
const crypto = require('crypto');
const axios = require('axios');

const API_KEY = "your_api_key";
const SECRET_KEY = "your_secret_key";
const RECV_WINDOW = "5000";
const ENDPOINT = "https://api.bybit.com/v5";

function generateSignature(timestamp, apiKey, recvWindow, payload) {
    const paramStr = timestamp + apiKey + recvWindow + payload;
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(paramStr)
        .digest('hex');
    return signature;
}

async function placeOrder(category, symbol, side, orderType, qty, price = null) {
    const timestamp = Date.now();

    const body = {
        category: category,
        symbol: symbol,
        side: side,
        orderType: orderType,
        qty: qty.toString(),
    };

    if (price) {
        body.price = price.toString();
    }

    const payload = JSON.stringify(body);
    const signature = generateSignature(
        timestamp,
        API_KEY,
        RECV_WINDOW,
        payload
    );

    const headers = {
        'X-BAPI-SIGN': signature,
        'X-BAPI-API-KEY': API_KEY,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': RECV_WINDOW,
        'Content-Type': 'application/json'
    };

    try {
        const response = await axios.post(
            `${ENDPOINT}/order/create`,
            body,
            { headers }
        );
        return response.data;
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

// Использование
placeOrder("spot", "BTCUSDT", "Buy", "Limit", 0.01, 43000);
```

---

## REST API — Структура запросов {#rest-api-структура}

### HTTP заголовки для приватных запросов

```
X-BAPI-SIGN: signature
X-BAPI-API-KEY: your_api_key
X-BAPI-TIMESTAMP: current_timestamp
X-BAPI-RECV-WINDOW: 5000
Content-Type: application/json
```

### Структура ответа

Все ответы возвращают JSON в следующем формате:

```json
{
  "retCode": 0,
  "retMsg": "success",
  "result": {
    // Данные ответа
  },
  "time": 1672987555152
}
```

**retCode:**
- `0` — успешный запрос
- `10001` — параметр недействителен
- `10002` — неверный API ключ
- `10003` — IP не в whitelist
- `20001` — ордер не найден
- `110027` — недостаточно баланса

---

## Market Data API — Получение данных о рынке {#market-data}

Все эндпоинты Market Data **публичные** и не требуют аутентификации.

### 1. Получить информацию об инструментах

**GET** `/v5/market/instruments-info`

Возвращает список всех торговых пар с информацией о минимальном размере ордера, комиссиях и т.д.

**Параметры:**
- `category` (string, required): spot / linear / inverse / option
- `symbol` (string, optional): торговая пара (например, BTCUSDT)
- `limit` (integer, optional): макс. 1000 записей
- `cursor` (string, optional): для пагинации

**Пример запроса:**

```python
import requests

url = "https://api.bybit.com/v5/market/instruments-info"
params = {
    "category": "spot",
    "symbol": "BTCUSDT"
}

response = requests.get(url, params=params)
data = response.json()
print(data)
```

**Пример ответа:**

```json
{
  "retCode": 0,
  "retMsg": "success",
  "result": {
    "category": "spot",
    "list": [
      {
        "symbol": "BTCUSDT",
        "baseCoin": "BTC",
        "quoteCoin": "USDT",
        "innovation": "0",
        "status": "Trading",
        "marginTrading": "both",
        "lotSizeFilter": {
          "basePrecision": "0.00001",
          "quotePrecision": "0.01",
          "minOrderQty": "0.00001",
          "maxOrderQty": "9000",
          "minOrderAmt": "10",
          "maxOrderAmt": "500000"
        },
        "priceFilter": {
          "tickSize": "0.01"
        }
      }
    ]
  }
}
```

### 2. Получить текущие котировки (Tickers)

**GET** `/v5/market/tickers`

Возвращает текущую цену, изменение за 24h, объём и другие метрики.

**Параметры:**
- `category` (required): spot / linear / inverse / option
- `symbol` (optional): торговая пара

**Пример:**

```python
import requests

url = "https://api.bybit.com/v5/market/tickers"
params = {
    "category": "linear",
    "symbol": "BTCUSDT"
}

response = requests.get(url, params=params)
ticker = response.json()['result']['list'][0]

print(f"Цена: {ticker['lastPrice']}")
print(f"24h изменение: {ticker['price24hPcnt']}")
print(f"24h объём: {ticker['volume24h']}")
```

### 3. Получить стаканы (Order Book)

**GET** `/v5/market/orderbook`

Возвращает текущий стакан (бид и аск).

**Параметры:**
- `category` (required)
- `symbol` (required)
- `limit` (optional): 1, 5, 10, 20, 50 (по умолчанию 25)

**Пример:**

```python
import requests

url = "https://api.bybit.com/v5/market/orderbook"
params = {
    "category": "spot",
    "symbol": "BTCUSDT",
    "limit": 10
}

response = requests.get(url, params=params)
book = response.json()['result']

print("Бид (покупка):")
for price, qty in book['b'][:5]:
    print(f"  {price} USDT x {qty} BTC")

print("Аск (продажа):")
for price, qty in book['a'][:5]:
    print(f"  {price} USDT x {qty} BTC")
```

### 4. Получить свечи (Klines)

**GET** `/v5/market/kline`

Возвращает исторические данные свечей (OHLCV).

**Параметры:**
- `category` (required)
- `symbol` (required)
- `interval` (required): 1, 3, 5, 15, 30, 60, 120, 240, 360, 720, D, W, M
- `start` (optional): Unix timestamp в миллисекундах (начало)
- `end` (optional): Unix timestamp в миллисекундах (конец)
- `limit` (optional): 1-1000 (по умолчанию 200)

**Пример:**

```python
import requests
from datetime import datetime, timedelta

url = "https://api.bybit.com/v5/market/kline"

# Получить свечи за последние 24 часа
end_time = int(datetime.now().timestamp() * 1000)
start_time = end_time - (24 * 60 * 60 * 1000)

params = {
    "category": "spot",
    "symbol": "BTCUSDT",
    "interval": "1",  # 1 минута
    "start": start_time,
    "end": end_time,
    "limit": 1000
}

response = requests.get(url, params=params)
candles = response.json()['result']['list']

for candle in candles[:5]:
    timestamp, open_price, high, low, close, volume, _ = candle
    dt = datetime.fromtimestamp(int(timestamp) // 1000)
    print(f"{dt}: O={open_price} H={high} L={low} C={close} V={volume}")
```

### 5. Последние сделки (Recent Trades)

**GET** `/v5/market/recent-trade`

Возвращает список последних завершённых сделок.

**Параметры:**
- `category` (required)
- `symbol` (required)
- `limit` (optional): по умолчанию 50

**Пример:**

```python
import requests

url = "https://api.bybit.com/v5/market/recent-trade"
params = {
    "category": "spot",
    "symbol": "BTCUSDT",
    "limit": 10
}

response = requests.get(url, params=params)
trades = response.json()['result']['list']

for trade in trades:
    print(f"Цена: {trade['price']}, Размер: {trade['size']}, Сторона: {trade['side']}")
```

---

## Order Management API — Управление ордерами {#order-management}

### 1. Разместить ордер

**POST** `/v5/order/create`

Создаёт новый ордер.

**Параметры основные:**
- `category` (required): spot / linear / inverse / option
- `symbol` (required): торговая пара
- `side` (required): Buy / Sell
- `orderType` (required): Limit / Market
- `qty` (required): размер ордера
- `price` (required для Limit): цена
- `timeInForce` (optional): GTC (Good Till Cancel, по умолчанию), IOC (Immediate Or Cancel), FOK (Fill Or Kill)
- `orderLinkId` (optional): ваш уникальный ID ордера для отслеживания

**Пример на Python:**

```python
import hmac
import hashlib
import requests
import json
from time import time

def create_order(
    api_key,
    secret_key,
    category,
    symbol,
    side,
    order_type,
    qty,
    price=None,
    order_link_id=None
):
    """Разместить лимит-ордер"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    body = {
        "category": category,
        "symbol": symbol,
        "side": side,
        "orderType": order_type,
        "qty": str(qty),
    }

    if price:
        body["price"] = str(price)

    if order_link_id:
        body["orderLinkId"] = order_link_id

    payload = json.dumps(body)

    param_str = timestamp + api_key + recv_window + payload
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
        "Content-Type": "application/json"
    }

    url = "https://api.bybit.com/v5/order/create"
    response = requests.post(url, headers=headers, data=payload)

    return response.json()

# Использование
result = create_order(
    api_key="your_api_key",
    secret_key="your_secret_key",
    category="spot",
    symbol="BTCUSDT",
    side="Buy",
    order_type="Limit",
    qty=0.01,
    price=43000,
    order_link_id="my_order_001"
)

if result['retCode'] == 0:
    order_id = result['result']['orderId']
    print(f"✓ Ордер размещён с ID: {order_id}")
else:
    print(f"✗ Ошибка: {result['retMsg']}")
```

### 2. Отменить ордер

**POST** `/v5/order/cancel`

Отменяет активный ордер.

**Параметры:**
- `category` (required)
- `symbol` (required)
- `orderId` или `orderLinkId` (required): ID ордера

**Пример:**

```python
def cancel_order(api_key, secret_key, category, symbol, order_id):
    """Отменить ордер"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    body = {
        "category": category,
        "symbol": symbol,
        "orderId": order_id
    }

    payload = json.dumps(body)

    param_str = timestamp + api_key + recv_window + payload
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
        "Content-Type": "application/json"
    }

    url = "https://api.bybit.com/v5/order/cancel"
    response = requests.post(url, headers=headers, data=payload)

    return response.json()

# Использование
result = cancel_order(
    api_key="your_api_key",
    secret_key="your_secret_key",
    category="spot",
    symbol="BTCUSDT",
    order_id="123456789"
)

if result['retCode'] == 0:
    print("✓ Ордер отменён")
else:
    print(f"✗ Ошибка: {result['retMsg']}")
```

### 3. Получить информацию об ордере

**GET** `/v5/order/history`

Возвращает историю ордеров (включая активные и завершённые).

**Параметры:**
- `category` (required)
- `symbol` (optional): торговая пара
- `orderId` (optional): ID конкретного ордера
- `orderLinkId` (optional): ваш ID ордера
- `orderStatus` (optional): Created / New / PartiallyFilled / Filled / Cancelled / Rejected
- `limit` (optional): 1-50 (по умолчанию 20)

**Пример:**

```python
def get_order_history(api_key, secret_key, category, symbol=None):
    """Получить историю ордеров"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    params = {
        "category": category,
    }

    if symbol:
        params["symbol"] = symbol

    query_string = "&".join([f"{k}={v}" for k, v in params.items()])

    param_str = timestamp + api_key + recv_window + query_string
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
    }

    url = f"https://api.bybit.com/v5/order/history?{query_string}"
    response = requests.get(url, headers=headers)

    return response.json()

# Использование
result = get_order_history(
    api_key="your_api_key",
    secret_key="your_secret_key",
    category="spot",
    symbol="BTCUSDT"
)

if result['retCode'] == 0:
    orders = result['result']['list']
    print(f"Найдено {len(orders)} ордеров")

    for order in orders[:5]:
        print(f"  {order['orderId']}: {order['side']} {order['qty']} @ {order['price']} ({order['orderStatus']})")
```

### 4. Редактировать ордер

**POST** `/v5/order/amend`

Изменяет цену или размер активного ордера.

**Параметры:**
- `category` (required)
- `symbol` (required)
- `orderId` или `orderLinkId` (required)
- `price` (optional): новая цена
- `qty` (optional): новый размер

**Пример:**

```python
def amend_order(api_key, secret_key, category, symbol, order_id, new_price):
    """Отредактировать ордер (изменить цену)"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    body = {
        "category": category,
        "symbol": symbol,
        "orderId": order_id,
        "price": str(new_price)
    }

    payload = json.dumps(body)

    param_str = timestamp + api_key + recv_window + payload
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
        "Content-Type": "application/json"
    }

    url = "https://api.bybit.com/v5/order/amend"
    response = requests.post(url, headers=headers, data=payload)

    return response.json()
```

---

## Position Management API — Управление позициями {#position-management}

*Применимо к linear и inverse контрактам.*

### 1. Получить открытые позиции

**GET** `/v5/position/list`

Возвращает все открытые позиции по лонгам и шортам.

**Параметры:**
- `category` (required): linear / inverse
- `symbol` (optional)
- `limit` (optional): по умолчанию 20

**Пример:**

```python
def get_positions(api_key, secret_key, category, symbol=None):
    """Получить открытые позиции"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    params = {
        "category": category,
    }

    if symbol:
        params["symbol"] = symbol

    query_string = "&".join([f"{k}={v}" for k, v in params.items()])

    param_str = timestamp + api_key + recv_window + query_string
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
    }

    url = f"https://api.bybit.com/v5/position/list?{query_string}"
    response = requests.get(url, headers=headers)

    return response.json()

# Использование
result = get_positions(
    api_key="your_api_key",
    secret_key="your_secret_key",
    category="linear",
    symbol="BTCUSDT"
)

if result['retCode'] == 0:
    positions = result['result']['list']

    for pos in positions:
        print(f"Пара: {pos['symbol']}")
        print(f"  Сторона: {pos['side']}")
        print(f"  Размер: {pos['size']}")
        print(f"  Цена входа: {pos['avgPrice']}")
        print(f"  Unrealized P&L: {pos['unrealisedPnl']}")
        print()
```

### 2. Установить стоп-лосс и тейк-профит

**POST** `/v5/position/trading-stop`

Устанавливает уровни стоп-лосса и тейк-профита для позиции.

**Параметры:**
- `category` (required): linear / inverse
- `symbol` (required)
- `takeProfit` (optional): цена тейк-профита
- `stopLoss` (optional): цена стоп-лосса
- `tpTriggerBy` (optional): LastPrice / IndexPrice / MarkPrice
- `slTriggerBy` (optional): LastPrice / IndexPrice / MarkPrice

**Пример:**

```python
def set_trading_stop(
    api_key,
    secret_key,
    category,
    symbol,
    take_profit=None,
    stop_loss=None
):
    """Установить SL и TP для позиции"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    body = {
        "category": category,
        "symbol": symbol,
    }

    if take_profit:
        body["takeProfit"] = str(take_profit)

    if stop_loss:
        body["stopLoss"] = str(stop_loss)

    payload = json.dumps(body)

    param_str = timestamp + api_key + recv_window + payload
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
        "Content-Type": "application/json"
    }

    url = "https://api.bybit.com/v5/position/trading-stop"
    response = requests.post(url, headers=headers, data=payload)

    return response.json()

# Использование
result = set_trading_stop(
    api_key="your_api_key",
    secret_key="your_secret_key",
    category="linear",
    symbol="BTCUSDT",
    take_profit=45000,
    stop_loss=41000
)

if result['retCode'] == 0:
    print("✓ SL/TP установлены")
else:
    print(f"✗ Ошибка: {result['retMsg']}")
```

---

## Account API — Операции с аккаунтом {#account-api}

### 1. Получить баланс кошелька

**GET** `/v5/account/wallet-balance`

Возвращает баланс кошелька (свободные средства и всё, что в ордерах).

**Параметры:**
- `accountType` (required): UNIFIED (основной счёт) или SPOT (спот счёт)
- `coin` (optional): конкретная монета

**Пример:**

```python
def get_wallet_balance(api_key, secret_key, account_type="UNIFIED", coin=None):
    """Получить баланс кошелька"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    params = {
        "accountType": account_type,
    }

    if coin:
        params["coin"] = coin

    query_string = "&".join([f"{k}={v}" for k, v in params.items()])

    param_str = timestamp + api_key + recv_window + query_string
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
    }

    url = f"https://api.bybit.com/v5/account/wallet-balance?{query_string}"
    response = requests.get(url, headers=headers)

    return response.json()

# Использование
result = get_wallet_balance(
    api_key="your_api_key",
    secret_key="your_secret_key",
    account_type="UNIFIED"
)

if result['retCode'] == 0:
    balances = result['result']['list'][0]['coin']

    print("Баланс кошелька:")
    for coin_data in balances:
        coin = coin_data['coin']
        walletBalance = coin_data['walletBalance']
        availableToWithdraw = coin_data['availableToWithdraw']

        print(f"  {coin}: {walletBalance} (свободно: {availableToWithdraw})")
```

### 2. Получить истории депозитов/выводов

**GET** `/v5/asset/deposit/query-history`

Возвращает историю депозитов.

**Параметры:**
- `coin` (optional)
- `limit` (optional): по умолчанию 50
- `offset` (optional): начиная с какого элемента

### 3. Получить комиссии

**GET** `/v5/account/fee-rate`

Возвращает размер комиссий для торговли.

**Параметры:**
- `category` (required): spot / linear / inverse / option

**Пример:**

```python
def get_fee_rate(api_key, secret_key, category):
    """Получить размер комиссий"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    params = {"category": category}

    query_string = "&".join([f"{k}={v}" for k, v in params.items()])

    param_str = timestamp + api_key + recv_window + query_string
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
    }

    url = f"https://api.bybit.com/v5/account/fee-rate?{query_string}"
    response = requests.get(url, headers=headers)

    return response.json()

# Использование
result = get_fee_rate(
    api_key="your_api_key",
    secret_key="your_secret_key",
    category="spot"
)

if result['retCode'] == 0:
    fees = result['result']
    print(f"Taker fee: {fees['takerFeeRate']}")
    print(f"Maker fee: {fees['makerFeeRate']}")
```

---

## Asset API — Управление активами {#asset-api}

### 1. Переводы между счётами

**POST** `/v5/asset/transfer/inter-transfer`

Позволяет переводить средства между Spot и Futures счётами.

**Параметры:**
- `from` (required): SPOT, FUTURE, OPTION, FUNDING
- `to` (required): SPOT, FUTURE, OPTION, FUNDING
- `coin` (required): монета
- `amount` (required): размер

**Пример:**

```python
def transfer_between_accounts(
    api_key,
    secret_key,
    from_account,
    to_account,
    coin,
    amount
):
    """Перевести средства между счётами"""

    timestamp = str(int(time() * 1000))
    recv_window = "5000"

    body = {
        "from": from_account,
        "to": to_account,
        "coin": coin,
        "amount": str(amount)
    }

    payload = json.dumps(body)

    param_str = timestamp + api_key + recv_window + payload
    signature = hmac.new(
        secret_key.encode(),
        param_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "X-BAPI-SIGN": signature,
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recv_window,
        "Content-Type": "application/json"
    }

    url = "https://api.bybit.com/v5/asset/transfer/inter-transfer"
    response = requests.post(url, headers=headers, data=payload)

    return response.json()

# Использование
result = transfer_between_accounts(
    api_key="your_api_key",
    secret_key="your_secret_key",
    from_account="SPOT",
    to_account="FUTURE",
    coin="USDT",
    amount=100
)

if result['retCode'] == 0:
    print(f"✓ Перевод выполнен")
else:
    print(f"✗ Ошибка: {result['retMsg']}")
```

---

## WebSocket API — Real-time потоки данных {#websocket-api}

WebSocket позволяет получать обновления данных в реальном времени.

**WSS хосты:**
- **Live**: `wss://stream.bybit.com/v5/public` (публичные) и `wss://stream.bybit.com/v5/private` (приватные)
- **Testnet**: `wss://stream-testnet.bybit.com/v5/public` и `wss://stream-testnet.bybit.com/v5/private`

### Типы подписок

#### 1. Публичные подписки

##### Tickers (котировки)

```
Канал: tickers.{symbol}
Пример: tickers.BTCUSDT
```

**Пример на Python:**

```python
import websocket
import json
from threading import Thread

class BybitWebSocket:
    def __init__(self):
        self.ws = None

    def on_message(self, ws, message):
        """Обработка сообщения"""
        data = json.loads(message)

        if data['topic'].startswith('tickers'):
            ticker = data['data']
            print(f"BTCUSDT: {ticker['lastPrice']} "
                  f"(24h изменение: {ticker['price24hPcnt']}%)")

    def on_error(self, ws, error):
        print(f"Ошибка: {error}")

    def on_close(self, ws):
        print("Соединение закрыто")

    def on_open(self, ws):
        """Подписаться на канал при открытии"""
        subscribe_msg = {
            "op": "subscribe",
            "args": ["tickers.BTCUSDT"]
        }
        ws.send(json.dumps(subscribe_msg))
        print("✓ Подписались на tickers.BTCUSDT")

    def start(self):
        """Запустить WebSocket"""
        websocket.enableTrace(False)

        self.ws = websocket.WebSocketApp(
            "wss://stream.bybit.com/v5/public",
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )

        self.ws.on_open = self.on_open
        self.ws.run_forever()

# Использование
if __name__ == "__main__":
    client = BybitWebSocket()
    client.start()
```

##### Kline (свечи)

```
Канал: kline.{interval}.{symbol}
Примеры:
  kline.1.BTCUSDT (1 минута)
  kline.60.BTCUSDT (1 час)
  kline.D.BTCUSDT (1 день)
```

**Пример:**

```python
def on_kline_message(self, ws, message):
    data = json.loads(message)

    if 'kline' in data['data']:
        kline = data['data']['kline'][0]

        print(f"Свеча BTCUSDT:")
        print(f"  Open:  {kline['o']}")
        print(f"  High:  {kline['h']}")
        print(f"  Low:   {kline['l']}")
        print(f"  Close: {kline['c']}")
        print(f"  Volume: {kline['v']}")

# При открытии соединения
subscribe_msg = {
    "op": "subscribe",
    "args": [
        "kline.1.BTCUSDT",   # 1-минутные свечи
        "kline.60.ETHUSD",    # 1-часовые свечи
    ]
}
ws.send(json.dumps(subscribe_msg))
```

##### Order Book

```
Канал: orderbook.{depth}.{symbol}
Глубина: 1, 5, 10, 20, 50, 100, 500, 1000
Пример: orderbook.20.BTCUSDT
```

**Пример:**

```python
def on_orderbook_message(self, ws, message):
    data = json.loads(message)

    book = data['data']

    print("Стакан BTCUSDT:")
    print("Бид (покупка):")
    for price, qty in book['b'][:5]:
        print(f"  {price} x {qty}")

    print("Аск (продажа):")
    for price, qty in book['a'][:5]:
        print(f"  {price} x {qty}")
```

##### Trades

```
Канал: publicTrade.{symbol}
Пример: publicTrade.BTCUSDT
```

#### 2. Приватные подписки (требуют аутентификации)

##### Order Updates

```
Канал: order
```

Получаете обновления при создании, изменении или отмене ордера.

**Пример структуры сообщения:**

```json
{
  "id": "5923240c6880ab-c9f3-42a2-9d30-78cdf90fffe8",
  "topic": "order",
  "creationTime": 1672987556000,
  "data": [
    {
      "orderId": "1234567890",
      "orderLinkId": "my_order_001",
      "blockTradeId": "",
      "symbol": "BTCUSDT",
      "price": "43000",
      "qty": "0.01",
      "side": "Buy",
      "isLeverage": "0",
      "positionIdx": 0,
      "orderStatus": "New",
      "cancelType": "UNKNOWN",
      "rejectReason": "",
      "avgPrice": "0",
      "leavesQty": "0.01",
      "cumExecQty": "0",
      "cumExecValue": "0",
      "cumExecFee": "0",
      "timeInForce": "GTC",
      "orderType": "Limit",
      "stopOrderType": "UNKNOWN",
      "orderIv": "",
      "triggerPrice": "0",
      "takeProfit": "0",
      "stopLoss": "0",
      "tpTriggerBy": "UNKNOWN",
      "slTriggerBy": "UNKNOWN",
      "triggerDirection": 0,
      "triggerBy": "UNKNOWN",
      "lastPriceOnCreated": "0",
      "closeOnTrigger": false,
      "createdTime": 1672987556000,
      "updatedTime": 1672987556000
    }
  ]
}
```

##### Position Updates

```
Канал: position
```

**Пример полной реализации с аутентификацией:**

```python
import websocket
import json
import hmac
import hashlib
from datetime import datetime
from time import time

class BybitPrivateWebSocket:
    def __init__(self, api_key, secret_key):
        self.api_key = api_key
        self.secret_key = secret_key
        self.ws = None

    def generate_auth_token(self):
        """Генерирует токен для приватных подписок"""
        expires = int(time() * 1000) + 10000

        signature = hmac.new(
            self.secret_key.encode(),
            f"GET/realtime{expires}".encode(),
            hashlib.sha256
        ).hexdigest()

        return {
            "op": "auth",
            "args": [self.api_key, expires, signature]
        }

    def on_message(self, ws, message):
        """Обработка сообщения"""
        data = json.loads(message)

        if 'topic' in data:
            topic = data['topic']

            if topic == 'order':
                self.on_order_update(data)
            elif topic == 'position':
                self.on_position_update(data)
            elif topic == 'execution':
                self.on_execution(data)

    def on_order_update(self, data):
        """Обновление ордера"""
        orders = data['data']

        for order in orders:
            print(f"Обновление ордера {order['orderId']}:")
            print(f"  Статус: {order['orderStatus']}")
            print(f"  Цена: {order['price']}")
            print(f"  Исполнено: {order['cumExecQty']} / {order['qty']}")

    def on_position_update(self, data):
        """Обновление позиции"""
        positions = data['data']

        for pos in positions:
            print(f"Обновление позиции {pos['symbol']}:")
            print(f"  Размер: {pos['size']}")
            print(f"  Цена входа: {pos['avgPrice']}")
            print(f"  Unrealized PnL: {pos['unrealisedPnl']}")

    def on_execution(self, data):
        """Исполнение ордера"""
        executions = data['data']

        for exec in executions:
            print(f"Ордер исполнен {exec['orderId']}:")
            print(f"  Размер: {exec['execQty']}")
            print(f"  Цена: {exec['execPrice']}")

    def on_error(self, ws, error):
        print(f"Ошибка: {error}")

    def on_close(self, ws):
        print("Соединение закрыто")

    def on_open(self, ws):
        """Аутентифицируемся и подписываемся"""
        # Отправляем токен аутентификации
        auth_msg = self.generate_auth_token()
        ws.send(json.dumps(auth_msg))

        # Подписываемся на приватные каналы
        subscribe_msg = {
            "op": "subscribe",
            "args": ["order", "position", "execution"]
        }
        ws.send(json.dumps(subscribe_msg))
        print("✓ Аутентифицировались и подписались на каналы")

    def start(self):
        """Запустить WebSocket"""
        websocket.enableTrace(False)

        self.ws = websocket.WebSocketApp(
            "wss://stream.bybit.com/v5/private",
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )

        self.ws.on_open = self.on_open
        self.ws.run_forever()

# Использование
if __name__ == "__main__":
    client = BybitPrivateWebSocket(
        api_key="your_api_key",
        secret_key="your_secret_key"
    )
    client.start()
```

---

## Обработка ошибок и лучшие практики {#errors-and-best-practices}

### Коды ошибок

| Код | Значение |
|---|---|
| 0 | Успех |
| 10001 | Параметр недействителен |
| 10002 | Неверный API ключ |
| 10003 | IP не в whitelist |
| 10004 | API ключ истёк |
| 20001 | Ордер не найден |
| 20002 | Ордер уже отменён |
| 20003 | Недостаточно баланса |
| 20004 | Количество меньше минимального |
| 110001 | Превышен лимит на количество ордеров |
| 110027 | Недостаточно баланса для маржинальной торговли |

### Обработка ошибок в коде

```python
def execute_with_retry(func, max_retries=3, delay=1):
    """Выполнить функцию с повторными попытками при ошибке"""

    for attempt in range(max_retries):
        try:
            result = func()

            if result['retCode'] == 0:
                return result

            # Некритичная ошибка — повторим
            if result['retCode'] in [10001, 10003]:
                print(f"Попытка {attempt + 1}: {result['retMsg']}")
                time.sleep(delay * (attempt + 1))
                continue

            # Критичная ошибка — прерываем
            raise Exception(result['retMsg'])

        except Exception as e:
            print(f"Ошибка: {e}")
            if attempt == max_retries - 1:
                raise
            time.sleep(delay * (attempt + 1))

    raise Exception("Не удалось выполнить операцию")

# Использование
result = execute_with_retry(
    lambda: place_order("spot", "BTCUSDT", "Buy", "Limit", 0.01, 43000)
)
```

### Rate Limiting

Bybit устанавливает лимиты на количество запросов. При превышении возвращается ошибка 429.

```python
import time
from collections import deque

class RateLimiter:
    def __init__(self, requests_per_second=10):
        self.requests_per_second = requests_per_second
        self.request_times = deque()

    def wait_if_needed(self):
        """Ожидает, если достигнут лимит"""
        now = time.time()

        # Удаляем запросы старше 1 секунды
        while self.request_times and self.request_times[0] < now - 1:
            self.request_times.popleft()

        # Если достигнут лимит, ждём
        if len(self.request_times) >= self.requests_per_second:
            wait_time = 1 - (now - self.request_times[0])
            if wait_time > 0:
                time.sleep(wait_time)

        self.request_times.append(now)

# Использование
limiter = RateLimiter(requests_per_second=10)

for i in range(100):
    limiter.wait_if_needed()
    # Выполняем API запрос
    result = place_order(...)
```

### Лучшие практики

1. **Никогда не жёстко кодируйте ключи.** Используйте переменные окружения:
```python
import os

API_KEY = os.getenv('BYBIT_API_KEY')
SECRET_KEY = os.getenv('BYBIT_SECRET_KEY')
```

2. **Используйте Testnet для тестирования:**
```python
ENDPOINT = "https://testnet.bybit.com/v5"  # Вместо api.bybit.com
```

3. **Логируйте все запросы и ответы для отладки:**
```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

logger.debug(f"Запрос к {url}")
logger.debug(f"Тело: {payload}")
logger.debug(f"Ответ: {response.json()}")
```

4. **Используйте orderLinkId для отслеживания:**
```python
import uuid

order_link_id = str(uuid.uuid4())
# Отправляем ордер с этим ID и потом можем найти его по этому ID
```

5. **Обрабатывайте сетевые ошибки:**
```python
import requests
from requests.exceptions import ConnectionError, Timeout

try:
    response = requests.get(url, timeout=10)
except ConnectionError:
    print("Ошибка подключения")
except Timeout:
    print("Timeout")
```

6. **Синхронизируйте время с сервером.** Используйте NTP для синхронизации системного времени.

---

## Заключение

Это полный гайд по основным возможностям Bybit API v5. Для получения дополнительной информации обратитесь к официальной документации:

- [Основная документация](https://bybit-exchange.github.io/docs/v5/)
- [API Explorer](https://bybit-exchange.github.io/docs/api-explorer/v5/category)
- [Помощь Bybit](https://www.bybit.com/en/help-center/)

**Удачи в торговле!**
