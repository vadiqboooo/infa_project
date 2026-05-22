"""Schemas for course billing."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CheckoutCreateIn(BaseModel):
    plan: str


class CheckoutCreateOut(BaseModel):
    payment_id: int
    yookassa_payment_id: str
    status: str
    confirmation_url: str


class AdminTestCheckoutCreateIn(BaseModel):
    amount: Decimal = Field(gt=0, le=Decimal("100000.00"), max_digits=8, decimal_places=2)
    description: str | None = None


class AdminTestCheckoutCreateOut(BaseModel):
    yookassa_payment_id: str
    status: str
    amount_value: str
    currency: str
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
