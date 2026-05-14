"""YooKassa billing routes for paid course access."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.payment import Payment
from app.models.user import User
from app.schemas.billing import CheckoutCreateIn, CheckoutCreateOut, LatestPaymentSyncOut, PaymentHistoryItem, PaymentStatusOut

router = APIRouter(prefix="/billing", tags=["billing"])

COURSE_PRODUCTS = {
    "summer": {
        "amount": Decimal("990.00"),
        "description": "Летний курс подготовки к ЕГЭ",
        "access_days": 120,
    },
    "year": {
        "amount": Decimal("990.00"),
        "description": "Годовой курс подготовки к ЕГЭ, 1 месяц",
        "access_days": 31,
    },
}


def _ensure_yookassa_configured() -> None:
    if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YooKassa is not configured",
        )


def _product_or_400(plan: str) -> dict:
    product = COURSE_PRODUCTS.get(plan)
    if not product:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown course plan")
    return product


def _amount_value(amount: Decimal) -> str:
    return f"{amount:.2f}"


async def _request_yookassa(method: str, path: str, **kwargs) -> dict:
    _ensure_yookassa_configured()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.request(
            method,
            f"{settings.YOOKASSA_API_URL.rstrip('/')}{path}",
            auth=(settings.YOOKASSA_SHOP_ID, settings.YOOKASSA_SECRET_KEY),
            **kwargs,
        )
    if response.status_code >= 400:
        detail = response.text
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"YooKassa error: {detail}")
    return response.json()


async def _activate_paid_access(payment: Payment, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == payment.user_id))
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if user is None:
        payment.status = "succeeded"
        payment.paid_at = payment.paid_at or now
        return

    product = _product_or_400(payment.plan)
    base_date = user.subscription_expires_at
    if base_date is not None and base_date.tzinfo is None:
        base_date = base_date.replace(tzinfo=timezone.utc)
    if base_date is None or base_date < now or user.subscription_plan != payment.plan:
        base_date = now

    user.subscription_plan = payment.plan
    user.subscription_expires_at = base_date + timedelta(days=int(product["access_days"]))
    payment.status = "succeeded"
    payment.paid_at = payment.paid_at or now


async def _sync_payment_from_yookassa(payment: Payment, db: AsyncSession) -> Payment:
    if not payment.yookassa_payment_id:
        return payment

    data = await _request_yookassa("GET", f"/payments/{payment.yookassa_payment_id}")
    yookassa_status = str(data.get("status") or payment.status)
    amount = data.get("amount") or {}
    metadata = data.get("metadata") or {}

    if str(metadata.get("internal_payment_id")) != str(payment.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment metadata mismatch")
    if str(amount.get("value")) != payment.amount_value or str(amount.get("currency")) != payment.currency:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount mismatch")

    if yookassa_status == "succeeded" and data.get("paid") is True:
        await _activate_paid_access(payment, db)
    elif yookassa_status in {"pending", "waiting_for_capture", "canceled"}:
        payment.status = yookassa_status

    await db.commit()
    await db.refresh(payment)
    return payment


def _payment_status_out(payment: Payment, user: User) -> PaymentStatusOut:
    return PaymentStatusOut(
        payment_id=payment.id,
        status=payment.status,
        plan=payment.plan,
        subscription_plan=user.subscription_plan,
        subscription_expires_at=user.subscription_expires_at,
    )


@router.post("/checkout", response_model=CheckoutCreateOut)
async def create_checkout(
    body: CheckoutCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = _product_or_400(body.plan)
    amount_value = _amount_value(product["amount"])
    idempotence_key = str(uuid4())

    payment = Payment(
        user_id=user.id,
        plan=body.plan,
        amount_value=amount_value,
        currency="RUB",
        status="created",
        idempotence_key=idempotence_key,
    )
    db.add(payment)
    await db.flush()

    payload = {
        "amount": {"value": amount_value, "currency": "RUB"},
        "capture": True,
        "confirmation": {
            "type": "redirect",
            "return_url": f"{settings.PAYMENT_RETURN_URL}?payment_id={payment.id}",
        },
        "description": product["description"],
        "metadata": {
            "internal_payment_id": str(payment.id),
            "user_id": str(user.id),
            "plan": body.plan,
        },
    }

    data = await _request_yookassa(
        "POST",
        "/payments",
        headers={"Idempotence-Key": idempotence_key, "Content-Type": "application/json"},
        json=payload,
    )
    confirmation = data.get("confirmation") or {}
    confirmation_url = confirmation.get("confirmation_url")
    yookassa_payment_id = data.get("id")
    if not confirmation_url or not yookassa_payment_id:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="YooKassa did not return confirmation URL")

    payment.yookassa_payment_id = yookassa_payment_id
    payment.confirmation_url = confirmation_url
    payment.status = str(data.get("status") or "pending")
    await db.commit()
    await db.refresh(payment)

    return CheckoutCreateOut(
        payment_id=payment.id,
        yookassa_payment_id=yookassa_payment_id,
        status=payment.status,
        confirmation_url=confirmation_url,
    )


@router.get("/payments/{payment_id}", response_model=PaymentStatusOut)
async def get_payment_status(
    payment_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Payment).where(Payment.id == payment_id, Payment.user_id == user.id))
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    payment = await _sync_payment_from_yookassa(payment, db)
    await db.refresh(user)
    return _payment_status_out(payment, user)


@router.get("/payments", response_model=list[PaymentHistoryItem])
async def list_payments(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user.id)
        .order_by(Payment.id.desc())
        .limit(50)
    )
    return [
        PaymentHistoryItem(
            id=payment.id,
            plan=payment.plan,
            amount_value=payment.amount_value,
            currency=payment.currency,
            status=payment.status,
            yookassa_payment_id=payment.yookassa_payment_id,
            confirmation_url=payment.confirmation_url,
            paid_at=payment.paid_at,
            created_at=payment.created_at,
        )
        for payment in result.scalars().all()
    ]


@router.post("/latest-payment/sync", response_model=LatestPaymentSyncOut)
async def sync_latest_payment(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user.id, Payment.yookassa_payment_id.is_not(None))
        .order_by(Payment.id.desc())
        .limit(5)
    )
    payments = result.scalars().all()
    for payment in payments:
        try:
            synced = await _sync_payment_from_yookassa(payment, db)
        except HTTPException as exc:
            if exc.status_code != status.HTTP_400_BAD_REQUEST:
                raise
            continue
        await db.refresh(user)
        if synced.status == "succeeded":
            return LatestPaymentSyncOut(payment=_payment_status_out(synced, user))
    return LatestPaymentSyncOut(payment=None)


@router.post("/yookassa/webhook")
async def yookassa_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    event = payload.get("event")
    obj = payload.get("object") or {}
    yookassa_payment_id = obj.get("id")
    if not yookassa_payment_id:
        return {"ok": True}

    result = await db.execute(select(Payment).where(Payment.yookassa_payment_id == yookassa_payment_id))
    payment = result.scalar_one_or_none()
    if payment is None:
        return {"ok": True}

    if event == "payment.succeeded":
        await _sync_payment_from_yookassa(payment, db)
    elif event == "payment.canceled":
        payment.status = "canceled"
        await db.commit()
    return {"ok": True}
