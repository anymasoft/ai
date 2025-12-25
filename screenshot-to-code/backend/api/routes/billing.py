"""Billing routes for YooKassa payments (credits packages only)."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import os

from api.routes.auth import get_current_user
from api.admin_auth import get_admin_user
from api.billing.yookassa import (
    create_payment,
    check_payment_status,
    add_credits_to_user,
    deduct_credits,
    get_user_credits,
    get_payment_by_db_id,
    update_payment_status,
    get_payments_list,
    PACKAGES,
)

router = APIRouter()

# Get the frontend return URL from environment
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
RETURN_URL = f"{FRONTEND_URL}/billing"


# ===========================
# MODELS
# ===========================


class CheckoutRequest(BaseModel):
    """Request for creating a payment."""

    package: str  # basic or professional


class CheckoutResponse(BaseModel):
    """Response with payment details."""

    db_payment_id: str
    confirmation_url: str
    package: str
    credits_amount: int
    amount_rubles: float


class BillingUsageResponse(BaseModel):
    """Billing usage response for authenticated users."""

    credits: int  # current credits balance
    is_free: bool  # True if credits == 0


class PaymentStatusResponse(BaseModel):
    """Payment status response."""

    status: str  # pending, succeeded, canceled
    credits: Optional[int] = None
    message: str


class AddCreditsRequest(BaseModel):
    """Request to add credits (admin only)."""

    user_id: str
    credits: int
    reason: str = "support"


class PaymentsListItem(BaseModel):
    """Payment item in list."""

    id: str
    user_id: str
    package: str
    credits_amount: int
    amount_rubles: float
    status: str
    created_at: str


# ===========================
# ENDPOINTS
# ===========================


@router.post("/api/billing/checkout", response_model=CheckoutResponse)
async def checkout(request: CheckoutRequest, user: dict = Depends(get_current_user)):
    """
    Инициирует платёж в YooKassa для пакета генераций.

    Требует аутентификацию пользователя.

    Args:
        request: Пакет для покупки (basic или professional)
        user: Текущий сеанс пользователя

    Returns:
        Данные платежа с URL подтверждения

    Raises:
        400: Неверный пакет или ошибка создания платежа
    """

    # Extract user from session data
    user_data = user.get("user")
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found in session")

    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Не авторизирован")

    # Validate package
    if request.package not in PACKAGES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_package",
                "message": f"Неверный пакет. Доступные: {list(PACKAGES.keys())}",
            },
        )

    # Create payment in YooKassa
    print(f"[BILLING] POST /api/billing/checkout user_id={user_id}, package={request.package}, RETURN_URL={RETURN_URL}")
    payment_result = create_payment(user_id, request.package, RETURN_URL)

    if not payment_result:
        print(f"[BILLING] ERROR: payment_result is None!")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "payment_creation_failed",
                "message": "Не удалось создать платёж. Попробуйте позже.",
            },
        )

    print(f"[BILLING] payment_result: {payment_result}")
    package_info = PACKAGES[request.package]

    response = CheckoutResponse(
        db_payment_id=payment_result["db_payment_id"],
        confirmation_url=payment_result["confirmation_url"],
        package=request.package,
        credits_amount=package_info["credits"],
        amount_rubles=package_info["price_kopeks"] / 100,
    )
    print(f"[BILLING] returning: {response}")
    return response


@router.get("/api/billing/status")
async def payment_status(
    payment_id: str, user: dict = Depends(get_current_user)
) -> PaymentStatusResponse:
    """
    Проверяет статус платежа и начисляет кредиты при успехе (IDEMPOTENT).

    Требует аутентификацию пользователя.

    Args:
        payment_id: ID платежа из нашей БД
        user: Текущий сеанс пользователя

    Returns:
        Статус платежа и начисленные кредиты (если успешно)

    Raises:
        404: Платёж не найден
        403: Платёж не принадлежит пользователю
    """

    print(f"[BILLING] >>>>>> /api/billing/status called with payment_id={payment_id}")

    # Extract user from session data
    user_data = user.get("user")
    if not user_data:
        print(f"[BILLING] ERROR: user not found in session. session data: {user}")
        raise HTTPException(status_code=401, detail="User not found in session")

    user_id = user_data.get("id")
    if not user_id:
        print(f"[BILLING] ERROR: user_id not found in user data: {user_data}")
        raise HTTPException(status_code=401, detail="Не авторизирован")

    print(f"[BILLING] >>>>>> /api/billing/status user_id={user_id}, payment_id={payment_id}")

    # Get payment from our DB
    payment = get_payment_by_db_id(payment_id)
    if not payment:
        print(f"[BILLING] ERROR: payment not found in DB. payment_id={payment_id}")
        raise HTTPException(
            status_code=404,
            detail={
                "error": "payment_not_found",
                "message": "Платёж не найден",
            },
        )

    print(f"[BILLING] found payment in DB: {payment}")

    # Verify payment belongs to this user
    if payment["user_id"] != user_id:
        print(f"[BILLING] ERROR: payment user_id mismatch. payment.user_id={payment['user_id']}, current user_id={user_id}")
        raise HTTPException(
            status_code=403,
            detail={
                "error": "forbidden",
                "message": "Это не ваш платёж",
            },
        )

    # If already processed, return cached result
    if payment["status"] in ("succeeded", "canceled"):
        return PaymentStatusResponse(
            status=payment["status"],
            credits=payment["credits_amount"] if payment["status"] == "succeeded" else None,
            message="Статус уже обновлен" if payment["status"] == "succeeded" else "Платёж отменён",
        )

    # Check status in YooKassa
    yookassa_payment = check_payment_status(payment["payment_id"])
    if not yookassa_payment:
        return PaymentStatusResponse(
            status="pending",
            message="Платёж в процессе обработки",
        )

    # Process based on status
    if yookassa_payment["status"] == "succeeded":
        # IDEMPOTENT: Add credits only if status is pending (not already succeeded)
        print(f"[BILLING] payment succeeded in YooKassa. payment_status={payment['status']}")
        if payment["status"] != "succeeded":
            print(f"[BILLING] adding {payment['credits_amount']} credits to user {user_id}")
            success = add_credits_to_user(
                user_id,
                payment["credits_amount"],
                reason=f"payment:{payment['package']}",
            )
            if success:
                print(f"[BILLING] credits added successfully, marking payment as succeeded")
                update_payment_status(payment_id, "succeeded")
                return PaymentStatusResponse(
                    status="succeeded",
                    credits=payment["credits_amount"],
                    message=f"Успешно! Добавлено {payment['credits_amount']} генераций",
                )
            else:
                # Error adding credits, but mark payment as attempted
                update_payment_status(payment_id, "pending")
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "credits_add_failed",
                        "message": "Платёж получен, но ошибка добавления кредитов. Обратитесь в поддержку.",
                    },
                )
        else:
            # Already processed
            return PaymentStatusResponse(
                status="succeeded",
                credits=payment["credits_amount"],
                message="Кредиты уже добавлены на вашу учетную запись",
            )

    elif yookassa_payment["status"] == "canceled":
        update_payment_status(payment_id, "canceled")
        return PaymentStatusResponse(
            status="canceled",
            message="Платёж отменён",
        )

    else:  # pending
        return PaymentStatusResponse(
            status="pending",
            message="Платёж в процессе обработки. Пожалуйста, подождите.",
        )


@router.post("/api/billing/add-credits")
async def admin_add_credits(
    request: AddCreditsRequest, admin: dict = Depends(get_admin_user)
) -> dict:
    """
    Добавить кредиты пользователю вручную (только для админов).

    Для поддержки клиентов и компенсаций.

    Args:
        request: user_id, количество credits, причина
        admin: Текущий админ из сессии

    Returns:
        Результат операции
    """

    success = add_credits_to_user(
        request.user_id, request.credits, reason=f"admin:{admin.get('email')}:{request.reason}"
    )

    if not success:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "add_credits_failed",
                "message": "Не удалось добавить кредиты",
            },
        )

    return {
        "success": True,
        "message": f"Добавлено {request.credits} кредитов пользователю {request.user_id}",
        "credits_added": request.credits,
    }


@router.get("/api/billing/usage", response_model=BillingUsageResponse)
async def get_billing_usage(user: dict = Depends(get_current_user)):
    """
    Get billing usage information for authenticated user.

    Returns ONLY the source of truth: credits from users table.

    Args:
        user: Current session data from cookies

    Returns:
        BillingUsageResponse with credits and is_free
    """

    # Extract user from session data
    user_data = user.get("user")
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found in session")

    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in session")

    # Get current credits balance - ONLY SOURCE OF TRUTH
    current_credits = get_user_credits(user_id)

    print(f"[BILLING] GET /api/billing/usage user_id={user_id}, credits={current_credits}")

    return BillingUsageResponse(
        credits=current_credits,
        is_free=current_credits == 0,
    )


@router.get("/api/billing/balance")
async def get_balance(user: dict = Depends(get_current_user)):
    """
    Получить текущий баланс кредитов пользователя.

    Args:
        user: Текущий сеанс пользователя

    Returns:
        Текущий баланс кредитов
    """

    # Extract user from session data
    user_data = user.get("user")
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found in session")

    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Не авторизирован")

    credits = get_user_credits(user_id)

    return {
        "user_id": user_id,
        "credits": credits,
        "message": f"У вас {credits} генераций" if credits > 0 else "У вас нет генераций",
    }


@router.post("/api/billing/deduct-credits")
async def deduct_credits_endpoint(request: dict, user: dict = Depends(get_current_user)):
    """
    Deduct credits after successful generation.

    Requires authentication. Called by frontend after generation completes.

    Args:
        request: { format: "html_tailwind" | "html_css" | "react_tailwind" | "vue_tailwind" }
        user: Current session data

    Returns:
        New credits balance or error if insufficient credits
    """

    # Extract user from session data
    user_data = user.get("user")
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found in session")

    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Не авторизирован")

    # Get format from request
    format_type = request.get("format", "html_tailwind")

    # Calculate cost based on format
    format_costs = {
        "html_tailwind": 1,
        "html_css": 1,
        "react_tailwind": 2,
        "vue_tailwind": 2,
    }

    cost = format_costs.get(format_type, 1)

    # Deduct credits
    success = deduct_credits(user_id, cost)

    if not success:
        # Check current balance to provide better error message
        current_credits = get_user_credits(user_id)
        raise HTTPException(
            status_code=402,
            detail={
                "error": "insufficient_credits",
                "message": f"Недостаточно кредитов. У вас {current_credits}, требуется {cost}.",
                "current_credits": current_credits,
                "required_credits": cost,
            },
        )

    # Get new balance
    new_credits = get_user_credits(user_id)

    return {
        "success": True,
        "credits_deducted": cost,
        "remaining_credits": new_credits,
        "message": f"Списано {cost} кредит(ов). Осталось: {new_credits}",
    }


@router.get("/api/billing/payments")
async def list_payments(admin: dict = Depends(get_admin_user)):
    """
    Получить список всех платежей (только для админов).

    Args:
        admin: Текущий админ из сессии

    Returns:
        Список платежей с деталями
    """

    payments = get_payments_list()

    return {
        "payments": payments,
        "total": len(payments),
    }
