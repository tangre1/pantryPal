# pantryPal/backend/models.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FridgeSnapshot(SQLModel, table=True):
    """
    Stores one 'vision' result from an uploaded image.
    We keep the extracted items as a JSON string for simplicity.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    label: str = Field(index=True)
    items_json: str


class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    name: str = Field(default="User", index=True)
    dietary_prefs_json: str = Field(default='{"diet":"none","allergies":[],"dislikes":[]}')
    budget_style: str = Field(default="balanced")  # cheap / balanced / premium
    household_size: int = Field(default=1)


class Recipe(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    user_id: Optional[int] = Field(default=None, index=True)
    title: str = Field(index=True)
    tags: str = Field(default="")  # comma-separated
    ingredients_json: str = Field(default="[]")
    steps_json: str = Field(default="[]")
    source: str = Field(default="manual")  # manual / ai / import


class ShoppingList(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    user_id: Optional[int] = Field(default=None, index=True)
    title: str = Field(default="Shopping List")
    items_json: str = Field(default='{"items":[]}')
    derived_from: str = Field(default="")
