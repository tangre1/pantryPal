# backend/models.py
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FridgeSnapshot(SQLModel, table=True):
    """
    Stores one 'vision' result from an uploaded image.

    We keep the extracted items as a JSON string so we don't
    have to build a complex relational schema yet.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    label: str = Field(index=True)
    items_json: str  # raw JSON text (e.g. {"items":[...]} )
