"""YooKassa payment gateway integration (credits packages only)."""

import os
import uuid
from typing import Optional
import json

# Try to import yookassa, if not installed, will fail gracefully
try:
    from yookassa import Client, Payment
    YOOKASSA_AVAILABLE = True
except ImportError:
    YOOKASSA_AVAILABLE = False
    print("[BILLING] WARNING: yookassa not installed. Install with: pip install yookassa")

from backend.db.sqlite import get_conn

# ===========================
# CONFIGURATION
# ===========================

YOOKASSA_SHOP_ID = os.environ.get("YOOKASSA_SHOP_ID", "")
YOOKASSA_SECRET_KEY = os.environ.get("YOOKASSA_SECRET_KEY", "")

# Pricing packages (in kopeks - 100 kopek = 1 ruble)
PACKAGES = {
    "basic": {
        "name": "Basic",
        "credits": 100,
        "price_kopeks": 300000,  # 3000 rubles
        "description": "100 генераций",
    },
    "professional": {
        "name": "Professional",
        "credits": 500,
        "price_kopeks": 1400000,  # 14000 rubles
        "description": "500 генераций",
    },
}

# Initialize YooKassa client (if available)
if YOOKASSA_AVAILABLE and YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY:
    Client.auth(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY)
    print(f"[BILLING] YooKassa initialized with shop_id: {YOOKASSA_SHOP_ID}")
else:
    print(
        "[BILLING] WARNING: YooKassa not configured. Set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY"
    )


# ===========================
# PAYMENT CREATION
# ===========================


def create_payment(
    user_id: str, package: str, return_url: str
) -> Optional[dict]:
    """
    Create a payment in YooKassa for a credits package.

    Args:
        user_id: User ID
        package: Package name (basic or professional)
        return_url: URL to return after payment (e.g., http://localhost:5173/billing/return)

    Returns:
        {
            'payment_id': str (YooKassa payment ID),
            'confirmation_url': str (URL for payment),
            'db_payment_id': str (our internal payment ID)
        }
        or None if failed
    """

    if package not in PACKAGES:
        print(f"[BILLING] Invalid package: {package}")
        return None

    if not YOOKASSA_AVAILABLE:
        print("[BILLING] YooKassa SDK not available")
        return None

    package_info = PACKAGES[package]

    try:
        # Generate unique IDs
        payment_id = f"py_{uuid.uuid4().hex[:12]}"  # YooKassa internal
        db_payment_id = str(uuid.uuid4())  # Our DB reference

        # Create payment
        payment = Payment.create(
            {
                "amount": {
                    "value": f"{package_info['price_kopeks'] / 100:.2f}",
                    "currency": "RUB",
                },
                "confirmation": {
                    "type": "redirect",
                    "return_url": f"{return_url}?payment_id={db_payment_id}",
                },
                "receipt": {
                    "customer": {"email": user_id},
                    "items": [
                        {
                            "description": f"{package_info['description']} ({package_info['credits']} credits)",
                            "quantity": 1,
                            "amount": {
                                "value": f"{package_info['price_kopeks'] / 100:.2f}",
                                "currency": "RUB",
                            },
                            "vat_code": 1,  # No VAT
                        }
                    ],
                },
                "metadata": {
                    "user_id": user_id,
                    "package": package,
                    "credits": str(package_info["credits"]),
                },
                "description": f"Покупка пакета {package_info['name']}: {package_info['credits']} генераций",
            },
            uuid.uuid4()  # idempotency_key
        )

        # Save payment to DB
        _save_payment_to_db(
            db_payment_id=db_payment_id,
            user_id=user_id,
            package=package,
            credits_amount=package_info["credits"],
            amount_cents=package_info["price_kopeks"],
            payment_id=payment.id,
            status="pending",
        )

        return {
            "payment_id": payment.id,
            "confirmation_url": payment.confirmation.confirmation_url,
            "db_payment_id": db_payment_id,
        }

    except Exception as e:
        print(f"[BILLING] Error creating payment: {e}")
        return None


# ===========================
# PAYMENT STATUS CHECKING
# ===========================


def check_payment_status(payment_id: str) -> Optional[dict]:
    """
    Check payment status in YooKassa.

    Args:
        payment_id: YooKassa payment ID

    Returns:
        {
            'status': 'pending' | 'succeeded' | 'canceled',
            'payment_id': str
        }
        or None if not found
    """

    if not YOOKASSA_AVAILABLE:
        print("[BILLING] YooKassa SDK not available")
        return None

    try:
        payment = Payment.find_one(payment_id)
        if not payment:
            return None

        return {
            "status": payment.status,  # pending, succeeded, canceled
            "payment_id": payment.id,
            "amount": payment.amount.value,
            "created_at": payment.created_at,
        }

    except Exception as e:
        print(f"[BILLING] Error checking payment: {e}")
        return None


# ===========================
# DATABASE OPERATIONS
# ===========================


def _save_payment_to_db(
    db_payment_id: str,
    user_id: str,
    package: str,
    credits_amount: int,
    amount_cents: int,
    payment_id: str,
    status: str,
    idempotency_key: Optional[str] = None,
) -> bool:
    """Save payment to database."""

    conn = get_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT OR IGNORE INTO payments (
                id, user_id, payment_id, package, credits_amount,
                amount_cents, currency, status, idempotency_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                db_payment_id,
                user_id,
                payment_id,
                package,
                credits_amount,
                amount_cents,
                "RUB",
                status,
                idempotency_key or db_payment_id,
            ),
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"[BILLING] Error saving payment: {e}")
        return False
    finally:
        conn.close()


def get_payment_by_db_id(db_payment_id: str) -> Optional[dict]:
    """Get payment info from our DB by our payment ID."""

    conn = get_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, user_id, payment_id, package, credits_amount, status, created_at
            FROM payments WHERE id = ?
            """,
            (db_payment_id,),
        )
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "user_id": row[1],
                "payment_id": row[2],
                "package": row[3],
                "credits_amount": row[4],
                "status": row[5],
                "created_at": row[6],
            }
        return None
    finally:
        conn.close()


def update_payment_status(db_payment_id: str, status: str, completed_at: Optional[str] = None) -> bool:
    """Update payment status in our DB."""

    conn = get_conn()
    cursor = conn.cursor()

    try:
        if completed_at:
            cursor.execute(
                """
                UPDATE payments SET status = ?, completed_at = ? WHERE id = ?
                """,
                (status, completed_at, db_payment_id),
            )
        else:
            cursor.execute(
                """
                UPDATE payments SET status = ? WHERE id = ?
                """,
                (status, db_payment_id),
            )
        conn.commit()
        return True
    except Exception as e:
        print(f"[BILLING] Error updating payment: {e}")
        return False
    finally:
        conn.close()


# ===========================
# CREDITS OPERATIONS
# ===========================


def add_credits_to_user(user_id: str, credits: int, reason: str = "payment") -> bool:
    """
    Add credits to user account (idempotent).

    Args:
        user_id: User ID
        credits: Number of credits to add
        reason: Reason for adding credits (payment, support, etc)

    Returns:
        True if successful
    """

    conn = get_conn()
    cursor = conn.cursor()

    try:
        # Check if user exists and get current credits
        cursor.execute(
            "SELECT credits FROM users WHERE id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            print(f"[BILLING] User not found: {user_id}")
            return False

        current_credits = row[0] or 0

        # Add credits
        new_credits = current_credits + credits

        cursor.execute(
            """
            UPDATE users SET credits = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (new_credits, user_id),
        )
        conn.commit()

        print(
            f"[BILLING] Added {credits} credits to user {user_id} "
            f"({current_credits} → {new_credits}) reason={reason}"
        )
        return True

    except Exception as e:
        print(f"[BILLING] Error adding credits: {e}")
        return False
    finally:
        conn.close()


def get_user_credits(user_id: str) -> int:
    """Get user's current credits balance."""

    conn = get_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT credits FROM users WHERE id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        if row:
            return row[0] or 0
        return 0
    finally:
        conn.close()


def get_payments_list(user_id: Optional[str] = None, limit: int = 50) -> list:
    """Get list of payments (admin view)."""

    conn = get_conn()
    cursor = conn.cursor()

    try:
        if user_id:
            cursor.execute(
                """
                SELECT id, user_id, package, credits_amount, amount_cents, status, created_at
                FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
                """,
                (user_id, limit),
            )
        else:
            cursor.execute(
                """
                SELECT id, user_id, package, credits_amount, amount_cents, status, created_at
                FROM payments ORDER BY created_at DESC LIMIT ?
                """,
                (limit,),
            )

        rows = cursor.fetchall()
        return [
            {
                "id": row[0],
                "user_id": row[1],
                "package": row[2],
                "credits_amount": row[3],
                "amount_rubles": row[4] / 100,
                "status": row[5],
                "created_at": row[6],
            }
            for row in rows
        ]
    finally:
        conn.close()
