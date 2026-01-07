import os
import base64
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AzureOpenAI
from sqlmodel import Session, select

from database import create_db_and_tables, get_session
from models import FridgeSnapshot

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
    version="0.2.0",
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


@app.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    """
    Simple chat endpoint that forwards the user message to Azure OpenAI
    and returns the model's reply.
    """
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


@app.post("/api/image-to-json", response_model=ImageJsonResponse)
async def image_to_json(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """
    Accepts an image upload, sends it to Azure OpenAI with a vision-style prompt,
    and returns structured JSON describing grocery-related items.
    Also saves a snapshot in the SQLite database.

    Expected JSON schema:

    {
      "items": [
        {
          "name": string,
          "category": string,
          "estimated_quantity": number | null,
          "unit": string | null,
          "notes": string | null
        }
      ]
    }
    """
    try:
        # Read file bytes
        content = await file.read()

        # Encode image as base64 for Azure
        b64_image = base64.b64encode(content).decode("utf-8")
        mime_type = file.content_type or "image/png"

        system_prompt = (
            "You are PantryPal Vision, an assistant that extracts grocery items "
            "from images of refrigerators, receipts, pantry shelves, shopping lists, "
            "or similar. You must respond with STRICT JSON only, no explanation, "
            "matching this exact schema:\n\n"
            "{\n"
            '  \"items\": [\n'
            "    {\n"
            '      \"name\": string,\n'
            '      \"category\": string,\n'
            '      \"estimated_quantity\": number | null,\n'
            '      \"unit\": string | null,\n'
            '      \"notes\": string | null\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "If you cannot read the image or no grocery items are present, "
            "return {\"items\": []}."
        )

        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this image and extract grocery-relevant items.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{b64_image}"
                            },
                        },
                    ],
                },
            ],
        )

        raw_content = response.choices[0].message.content or ""

        # Try to parse JSON from the model's response
        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError:
            print("Failed to parse JSON from model, raw content:", raw_content)
            parsed = {"items": []}

        if not isinstance(parsed, dict):
            parsed = {"items": []}

        # Save snapshot to DB
        label = file.filename or "Fridge snapshot"
        snapshot = FridgeSnapshot(
            label=label,
            items_json=json.dumps(parsed),
        )
        session.add(snapshot)
        session.commit()
        session.refresh(snapshot)

        return ImageJsonResponse(data=parsed, snapshot_id=snapshot.id)

    except Exception as e:
        print("Azure OpenAI image error:", e)
        return ImageJsonResponse(data={"items": []}, snapshot_id=None)


@app.get("/api/snapshots", response_model=List[SnapshotOut])
def list_snapshots(session: Session = Depends(get_session)):
    """
    Return all saved fridge/image snapshots, newest first.
    """
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
