"""Topic access granted through a published Telegram link."""

from sqlalchemy import Column, ForeignKey, Integer, Table
from app.database import Base

user_topic_shares = Table(
    "user_topic_shares",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", Integer, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)
