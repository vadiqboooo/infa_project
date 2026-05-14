"""Schemas for course billing."""

from datetime import datetime

from pydantic import BaseModel


class CheckoutCreateIn(BaseModel):
    plan: str


class CheckoutCreateOut(BaseModel):
    payment_id: int
    yookassa_payment_id: str
    status: str
    confirmation_url: str


class PaymentStatusOut(BaseModel):
    payment_id: int
    status: str
    plan: str
    subscription_plan: str
    subscription_expires_at: datetime | None = None


class LatestPaymentSyncOut(BaseModel):
    payment: PaymentStatusOut | None = None


class PaymentHistoryItem(BaseModel):
    id: int
    plan: str
    amount_value: str
    currency: str
    status: str
    yookassa_payment_id: str | None = None
    confirmation_url: str | None = None
    paid_at: datetime | None = None
    created_at: datetime
