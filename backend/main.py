from __future__ import annotations

import os
import base64
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AzureOpenAI
from sqlmodel import Session, select

from database import create_db_and_tables, get_session
from models import FridgeSnapshot, UserProfile, Recipe, ShoppingList

# --------------------------
# Load environment variables
# --------------------------
BASE_DIR = Path(__file__).resolve().parent
dotenv_path = BASE_DIR / ".env"
load_dotenv(dotenv_path)

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")

if not AZURE_OPENAI_API_KEY:
    raise RuntimeError("AZURE_OPENAI_API_KEY is not set. Check your .env file.")
if not AZURE_OPENAI_ENDPOINT:
    raise RuntimeError("AZURE_OPENAI_ENDPOINT is not set. Check your .env file.")
if not AZURE_OPENAI_DEPLOYMENT:
    raise RuntimeError("AZURE_OPENAI_DEPLOYMENT is not set. Check your .env file.")
if not AZURE_OPENAI_API_VERSION:
    raise RuntimeError("AZURE_OPENAI_API_VERSION is not set. Check your .env file.")

# --------------------------
# Azure OpenAI client
# --------------------------
client = AzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_API_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
)

# --------------------------
# FastAPI app setup
# --------------------------
app = FastAPI(
    title="PantryPal Backend",
    description="Backend API for the PantryPal grocery assistant.",
    version="0.3.0",
)

# CORS for local React dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite
        "http://localhost:3000",  # CRA
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create DB tables on startup
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# --------------------------
# Pydantic models
# --------------------------
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


class ImageJsonResponse(BaseModel):
    data: Dict[str, Any]
    snapshot_id: int | None = None


class SnapshotOut(BaseModel):
    id: int
    label: str
    created_at: datetime
    data: Dict[str, Any]


class CreateUser(BaseModel):
    name: str = "User"
    dietary_prefs: Dict[str, Any] = {"diet": "none", "allergies": [], "dislikes": []}
    budget_style: str = "balanced"
    household_size: int = 1


class UpdateUser(BaseModel):
    name: str | None = None
    dietary_prefs: Dict[str, Any] | None = None
    budget_style: str | None = None
    household_size: int | None = None


class CreateRecipe(BaseModel):
    user_id: int | None = None
    title: str
    tags: list[str] = []
    ingredients: list[dict] = []
    steps: list[str] = []
    source: str = "manual"


class RecipeOut(BaseModel):
    id: int
    user_id: int | None
    title: str
    tags: list[str]
    ingredients: list[dict]
    steps: list[str]
    source: str
    created_at: datetime


class UpdateRecipe(BaseModel):
    title: str | None = None
    tags: list[str] | None = None
    ingredients: list[dict] | None = None
    steps: list[str] | None = None
    source: str | None = None


class CreateShoppingList(BaseModel):
    user_id: int | None = None
    title: str = "Shopping List"
    items: Dict[str, Any] = {"items": []}
    derived_from: str = ""


def _recipe_to_out(r: Recipe) -> RecipeOut:
    return RecipeOut(
        id=r.id,
        user_id=r.user_id,
        title=r.title,
        tags=[t for t in (r.tags or "").split(",") if t],
        ingredients=json.loads(r.ingredients_json or "[]"),
        steps=json.loads(r.steps_json or "[]"),
        source=r.source,
        created_at=r.created_at,
    )

# --------------------------
# Endpoints
# --------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "pantryPal backend",
        "azure_endpoint_set": bool(AZURE_OPENAI_ENDPOINT),
        "deployment": AZURE_OPENAI_DEPLOYMENT,
    }

# --------------------------
# Chat
# --------------------------
@app.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    user_msg = body.message.strip()
    if not user_msg:
        return ChatResponse(
            reply=(
                "Tell me what you're shopping for and I'll help you plan "
                "meals or build a grocery list."
            )
        )

    try:
        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are PantryPal, a friendly grocery and meal-planning assistant. "
                        "You help users plan meals, build grocery lists, and optimize for "
                        "budget and simplicity. Be concise but helpful, and format lists "
                        "with bullet points when appropriate."
                    ),
                },
                {"role": "user", "content": user_msg},
            ],
        )

        reply = response.choices[0].message.content
        return ChatResponse(reply=reply)

    except Exception as e:
        print("Azure OpenAI error (chat):", e)
        return ChatResponse(
            reply=(
                "I had an issue talking to the AI service. "
                "Double-check your Azure settings and try again."
            )
        )

# --------------------------
# Vision -> JSON (and save snapshot)
# --------------------------
@app.post("/api/image-to-json", response_model=ImageJsonResponse)
async def image_to_json(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    try:
        content = await file.read()
        b64_image = base64.b64encode(content).decode("utf-8")
        mime_type = file.content_type or "image/png"

        system_prompt = (
            "You are PantryPal Vision, an assistant that extracts grocery items "
            "from images of refrigerators, receipts, pantry shelves, shopping lists, "
            "or similar. You must respond with STRICT JSON only, no explanation, "
            "matching this exact schema:\n\n"
            "{\n"
            '  "items": [\n'
            "    {\n"
            '      "name": string,\n'
            '      "category": string,\n'
            '      "estimated_quantity": number | null,\n'
            '      "unit": string | null,\n'
            '      "notes": string | null\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            'If you cannot read the image or no grocery items are present, return {"items": []}.'
        )

        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Analyze this image and extract grocery-relevant items."},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
                        },
                    ],
                },
            ],
        )

        raw_content = response.choices[0].message.content or ""

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError:
            print("Failed to parse JSON from model, raw content:", raw_content)
            parsed = {"items": []}

        if not isinstance(parsed, dict):
            parsed = {"items": []}

        # Save snapshot to DB
        label = file.filename or "Fridge snapshot"
        snapshot = FridgeSnapshot(label=label, items_json=json.dumps(parsed))
        session.add(snapshot)
        session.commit()
        session.refresh(snapshot)

        return ImageJsonResponse(data=parsed, snapshot_id=snapshot.id)

    except Exception as e:
        print("Azure OpenAI image error:", e)
        return ImageJsonResponse(data={"items": []}, snapshot_id=None)

@app.get("/api/snapshots", response_model=List[SnapshotOut])
def list_snapshots(session: Session = Depends(get_session)):
    snapshots = session.exec(
        select(FridgeSnapshot).order_by(FridgeSnapshot.created_at.desc())
    ).all()

    results: List[SnapshotOut] = []
    for snap in snapshots:
        try:
            data = json.loads(snap.items_json)
        except json.JSONDecodeError:
            data = {"items": []}

        results.append(
            SnapshotOut(
                id=snap.id,
                label=snap.label,
                created_at=snap.created_at,
                data=data,
            )
        )

    return results

@app.get("/api/snapshots/{snapshot_id}")
def get_snapshot(snapshot_id: int, session: Session = Depends(get_session)):
    snap = session.get(FridgeSnapshot, snapshot_id)
    if not snap:
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        data = json.loads(snap.items_json)
    except json.JSONDecodeError:
        data = {"items": []}

    return {
        "id": snap.id,
        "label": snap.label,
        "created_at": snap.created_at,
        "data": data,
    }

@app.delete("/api/snapshots/{snapshot_id}")
def delete_snapshot(snapshot_id: int, session: Session = Depends(get_session)):
    snap = session.get(FridgeSnapshot, snapshot_id)
    if not snap:
        raise HTTPException(status_code=404, detail="Not Found")

    session.delete(snap)
    session.commit()
    return {"ok": True}

# --------------------------
# Users
# --------------------------
@app.post("/api/users")
def create_user(body: CreateUser, session: Session = Depends(get_session)):
    user = UserProfile(
        name=body.name,
        dietary_prefs_json=json.dumps(body.dietary_prefs),
        budget_style=body.budget_style,
        household_size=body.household_size,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"id": user.id}

@app.get("/api/users/{user_id}")
def get_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(UserProfile, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not Found")

    return {
        "id": user.id,
        "name": user.name,
        "dietary_prefs": json.loads(user.dietary_prefs_json),
        "budget_style": user.budget_style,
        "household_size": user.household_size,
        "created_at": user.created_at,
    }

@app.patch("/api/users/{user_id}")
def update_user(user_id: int, body: UpdateUser, session: Session = Depends(get_session)):
    user = session.get(UserProfile, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not Found")

    if body.name is not None:
        user.name = body.name
    if body.dietary_prefs is not None:
        user.dietary_prefs_json = json.dumps(body.dietary_prefs)
    if body.budget_style is not None:
        user.budget_style = body.budget_style
    if body.household_size is not None:
        user.household_size = body.household_size

    session.add(user)
    session.commit()
    session.refresh(user)
    return {"ok": True}

# --------------------------
# Recipes
# --------------------------
@app.post("/api/recipes", response_model=Dict[str, int])
def create_recipe(body: CreateRecipe, session: Session = Depends(get_session)):
    recipe = Recipe(
        user_id=body.user_id,
        title=body.title,
        tags=",".join(body.tags),
        ingredients_json=json.dumps(body.ingredients),
        steps_json=json.dumps(body.steps),
        source=body.source,
    )
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return {"id": recipe.id}

@app.get("/api/recipes", response_model=List[RecipeOut])
def list_recipes(
    q: str | None = None,
    user_id: int | None = None,
    session: Session = Depends(get_session),
):
    stmt = select(Recipe)

    if user_id is not None:
        stmt = stmt.where(Recipe.user_id == user_id)

    if q:
        stmt = stmt.where(Recipe.title.ilike(f"%{q}%"))

    stmt = stmt.order_by(Recipe.created_at.desc())

    recipes = session.exec(stmt).all()
    return [_recipe_to_out(r) for r in recipes]

@app.get("/api/recipes/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int, session: Session = Depends(get_session)):
    r = session.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not Found")
    return _recipe_to_out(r)

@app.patch("/api/recipes/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, body: UpdateRecipe, session: Session = Depends(get_session)):
    r = session.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not Found")

    if body.title is not None:
        r.title = body.title
    if body.tags is not None:
        r.tags = ",".join(body.tags)
    if body.ingredients is not None:
        r.ingredients_json = json.dumps(body.ingredients)
    if body.steps is not None:
        r.steps_json = json.dumps(body.steps)
    if body.source is not None:
        r.source = body.source

    session.add(r)
    session.commit()
    session.refresh(r)
    return _recipe_to_out(r)

@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: int, session: Session = Depends(get_session)):
    r = session.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not Found")

    session.delete(r)
    session.commit()
    return {"ok": True}

# --------------------------
# Shopping Lists (History)
# --------------------------
@app.post("/api/shopping-lists")
def create_shopping_list(body: CreateShoppingList, session: Session = Depends(get_session)):
    sl = ShoppingList(
        user_id=body.user_id,
        title=body.title,
        items_json=json.dumps(body.items),
        derived_from=body.derived_from,
    )
    session.add(sl)
    session.commit()
    session.refresh(sl)
    return {"id": sl.id}

@app.get("/api/shopping-lists")
def list_shopping_lists(user_id: int | None = None, session: Session = Depends(get_session)):
    stmt = select(ShoppingList).order_by(ShoppingList.created_at.desc())
    lists = session.exec(stmt).all()

    out = []
    for sl in lists:
        if user_id is not None and sl.user_id != user_id:
            continue

        out.append(
            {
                "id": sl.id,
                "user_id": sl.user_id,
                "title": sl.title,
                "items": json.loads(sl.items_json or '{"items": []}'),
                "derived_from": sl.derived_from,
                "created_at": sl.created_at,
            }
        )
    return out

@app.get("/api/shopping-lists/{list_id}")
def get_shopping_list(list_id: int, session: Session = Depends(get_session)):
    sl = session.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(status_code=404, detail="Not Found")

    return {
        "id": sl.id,
        "user_id": sl.user_id,
        "title": sl.title,
        "items": json.loads(sl.items_json or '{"items": []}'),
        "derived_from": sl.derived_from,
        "created_at": sl.created_at,
    }
