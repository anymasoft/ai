"""
Интеграция YooKassa для приёма платежей
Система пакетов видео: Starter, Seller, Pro
"""

import os
import json
import uuid
import requests
import hashlib
import hmac
from typing import Optional, Dict
from datetime import datetime
from .db import create_payment as db_create_payment, get_or_create_user

# ========== КОНФИГ ==========

YOOKASSA_SHOP_ID = os.getenv("YOOKASSA_SHOP_ID")
YOOKASSA_API_KEY = os.getenv("YOOKASSA_API_KEY")
YOOKASSA_WEBHOOK_SECRET = os.getenv("YOOKASSA_WEBHOOK_SECRET", "secret")
BOT_USERNAME = os.getenv("BOT_USERNAME", "gptnexus_bot")  # БЕЗ @ в начале!

YOOKASSA_API_URL = "https://api.yookassa.ru/v3"

# Тарифы (должны совпадать с bot.py)
TARIFFS = {
    "starter": {"videos": 5, "price": 49000},      # В копейках! 490 ₽ = 49000 копеек
    "seller": {"videos": 20, "price": 149000},     # 1490 ₽ = 149000 копеек
    "pro": {"videos": 50, "price": 299000},        # 2990 ₽ = 299000 копеек
}


def log_payment(level: str, message: str, details: dict = None):
    """Логирование платежей"""
    extra = f" {details}" if details else ""
    print(f"[YOOKASSA] [{level}] {message}{extra}")


# ========== СОЗДАНИЕ ПЛАТЕЖА ==========

def create_payment(user_id: int, pack_id: str) -> Optional[Dict]:
    """
    Создать платёж в YooKassa

    Args:
        user_id: ID пользователя в Telegram
        pack_id: ID пакета (starter, seller, pro)

    Returns:
        {
            "payment_id": "...",
            "confirmation_url": "https://..."
        }
        или None если ошибка
    """

    if not YOOKASSA_SHOP_ID or not YOOKASSA_API_KEY:
        log_payment("ERROR", "YooKassa credentials not configured")
        return None

    if pack_id not in TARIFFS:
        log_payment("ERROR", f"Unknown pack_id: {pack_id}")
        return None

    tariff = TARIFFS[pack_id]
    idempotence_key = str(uuid.uuid4())

    # Убедимся что пользователь существует в БД
    get_or_create_user(user_id)

    # Формируем payload для YooKassa
    payload = {
        "amount": {
            "value": str(tariff["price"] / 100),  # Преобразуем копейки в рубли (49000 → 490.00)
            "currency": "RUB"
        },
        "capture": True,  # ОДНОСТАДИЙНЫЙ платёж - сразу succeeded после оплаты
        "payment_method_data": {
            "type": "bank_card"
        },
        "confirmation": {
            "type": "redirect",
            "return_url": f"https://t.me/{BOT_USERNAME}?start=payment_success"
        },
        "description": f"Nexus video pack: {tariff['videos']} videos",
        "metadata": {
            "user_id": str(user_id),
            "pack_id": pack_id,
            "videos_count": tariff["videos"]
        }
    }

    try:
        # Отправляем запрос к API YooKassa
        response = requests.post(
            f"{YOOKASSA_API_URL}/payments",
            json=payload,
            auth=(YOOKASSA_SHOP_ID, YOOKASSA_API_KEY),
            headers={
                "Idempotence-Key": idempotence_key,
                "Content-Type": "application/json"
            },
            timeout=10
        )

        if response.status_code != 200:
            log_payment(
                "ERROR",
                f"Payment creation failed: {response.status_code}",
                {"response": response.text, "user_id": user_id, "pack_id": pack_id}
            )
            return None

        data = response.json()
        payment_id = data.get("id")
        confirmation_url = data.get("confirmation", {}).get("confirmation_url")

        if not payment_id or not confirmation_url:
            log_payment("ERROR", "Invalid response from YooKassa", {"response": data})
            return None

        # Создаём запись платежа в БД (status=pending)
        db_result = db_create_payment(payment_id, user_id, pack_id, tariff["videos"], tariff["price"])
        if not db_result:
            log_payment("ERROR", "Failed to save payment to DB", {"payment_id": payment_id, "user_id": user_id})
            return None

        log_payment(
            "SUCCESS",
            f"Payment saved to DB",
            {"payment_id": payment_id, "user_id": user_id, "status": "pending"}
        )

        return {
            "payment_id": payment_id,
            "confirmation_url": confirmation_url
        }

    except Exception as e:
        log_payment("ERROR", f"Exception during payment creation: {str(e)}", {"user_id": user_id})
        return None


# ========== ПОЛУЧЕНИЕ СТАТУСА ПЛАТЕЖА ==========

def get_payment_status(payment_id: str) -> Optional[Dict]:
    """
    Получить статус платежа из YooKassa API

    Используется для polling вместо webhook'а

    ⚠️ ВАЖНО: возвращает ТОЛЬКО статус платежа, НЕ videos_count!
    videos_count ВСЕГДА берётся из таблицы payments в БД.

    Args:
        payment_id: ID платежа в YooKassa

    Returns:
        {
            "payment_id": ...,
            "status": "pending" | "succeeded" | "canceled" | "failed"
        }
        или None если ошибка
    """

    if not YOOKASSA_SHOP_ID or not YOOKASSA_API_KEY:
        log_payment("ERROR", "YooKassa credentials not configured")
        return None

    try:
        # GET запрос к YooKassa API
        print(f"[YOOKASSA-API] Fetching status for payment {payment_id}...")

        response = requests.get(
            f"{YOOKASSA_API_URL}/payments/{payment_id}",
            auth=(YOOKASSA_SHOP_ID, YOOKASSA_API_KEY),
            headers={
                "Content-Type": "application/json"
            },
            timeout=10
        )

        if response.status_code != 200:
            log_payment(
                "ERROR",
                f"Failed to get payment status: {response.status_code}",
                {"payment_id": payment_id, "response": response.text}
            )
            print(f"[YOOKASSA-API] ❌ Status {response.status_code} for {payment_id}")
            return None

        data = response.json()
        status = data.get("status")
        print(f"[YOOKASSA-API] Payment {payment_id} status: {status}")

        return {
            "payment_id": payment_id,
            "status": status
        }

    except Exception as e:
        log_payment("ERROR", f"Exception during payment status check: {str(e)}", {"payment_id": payment_id})
        return None


# ========== ОБРАБОТКА WEBHOOK ==========

def verify_webhook_signature(body: str, signature: str) -> bool:
    """
    Проверяет подпись webhook'а от YooKassa

    Args:
        body: Тело запроса (raw string)
        signature: HTTP header X-Yookassa-Signature

    Returns:
        True если подпись валидна, False иначе
    """
    try:
        # YooKassa подписывает следующим образом:
        # signature = base64(hmac-sha256(body + shop_id, webhook_secret))

        # Разбираем signature (формат: "algo=value")
        if "=" not in signature:
            return False

        algo, sig_value = signature.split("=", 1)

        if algo != "sha256":
            return False

        # Вычисляем HMAC
        message = body + YOOKASSA_WEBHOOK_SECRET
        computed_hmac = hmac.new(
            YOOKASSA_WEBHOOK_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

        # Сравниваем (constant-time для безопасности)
        return hmac.compare_digest(computed_hmac, sig_value)

    except Exception as e:
        log_payment("ERROR", f"Signature verification failed: {str(e)}")
        return False


def process_webhook(payload: dict) -> Optional[Dict]:
    """
    Обрабатывает webhook от YooKassa

    Args:
        payload: JSON payload из webhook'а

    Returns:
        {
            "user_id": ...,
            "videos_count": ...,
            "payment_id": ...,
            "status": "success"
        }
        или None если платёж не успешен или ошибка
    """

    try:
        # Проверяем тип события
        event = payload.get("type")

        if event != "payment.succeeded":
            log_payment("DEBUG", f"Ignored webhook event: {event}")
            return None

        # Получаем данные платежа
        payment = payload.get("object", {})
        payment_id = payment.get("id")
        status = payment.get("status")

        if status != "succeeded":
            log_payment("DEBUG", f"Payment not succeeded: {status}", {"payment_id": payment_id})
            return None

        # Извлекаем метаданные
        metadata = payment.get("metadata", {})
        user_id_str = metadata.get("user_id")
        videos_count = metadata.get("videos_count")
        pack_id = metadata.get("pack_id")

        if not user_id_str or not videos_count or not pack_id:
            log_payment("ERROR", "Missing metadata in webhook", {"payment_id": payment_id})
            return None

        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            log_payment("ERROR", "Invalid user_id in metadata", {"payment_id": payment_id})
            return None

        log_payment(
            "SUCCESS",
            "Payment webhook processed",
            {
                "payment_id": payment_id,
                "user_id": user_id,
                "videos_count": videos_count,
                "pack_id": pack_id
            }
        )

        return {
            "user_id": user_id,
            "videos_count": videos_count,
            "payment_id": payment_id,
            "pack_id": pack_id,
            "status": "success"
        }

    except Exception as e:
        log_payment("ERROR", f"Exception during webhook processing: {str(e)}", {"payload": str(payload)})
        return None
