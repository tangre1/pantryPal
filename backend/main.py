import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AzureOpenAI

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
    version="0.1.0",
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


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


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
            model=AZURE_OPENAI_DEPLOYMENT,  # your deployment name, e.g. "pantryPal-gpt-5.2-chat"
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
        # For now, just print the error to the console
        print("Azure OpenAI error:", e)
        return ChatResponse(
            reply=(
                "I had an issue talking to the AI service. "
                "Double-check your Azure settings and try again."
            )
        )
