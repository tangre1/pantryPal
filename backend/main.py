from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="PantryPal Backend",
    description="Backend API for the PantryPal grocery assistant.",
    version="0.1.0",
)

# CORS: allow local React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite
        "http://localhost:3000",  # CRA, just in case
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
    return {"status": "ok", "service": "pantryPal backend"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    user_msg = body.message.strip()

    if not user_msg:
        return ChatResponse(
            reply="Tell me what you’re shopping for and I’ll help you build a list or suggest meals."
        )

    # Super simple fake “AI” for now
    lower = user_msg.lower()
    if "taco" in lower:
        reply = (
            "Taco night sounds great! Here’s a simple grocery list:\n"
            "- Tortillas\n- Ground beef or turkey\n- Taco seasoning\n"
            "- Lettuce\n- Tomato\n- Shredded cheese\n- Salsa\n- Sour cream\n"
        )
    elif "list" in lower or "grocery" in lower:
        reply = (
            "Here’s a basic starter grocery list:\n"
            "- Milk\n- Eggs\n- Bread\n- Chicken\n- Rice\n- Frozen veggies\n\n"
            "Tell me what meals you want and I’ll customize it."
        )
    else:
        reply = (
            "I’m PantryPal 👋\n\n"
            "You can ask me things like:\n"
            "- \"Make a grocery list for taco night\"\n"
            "- \"Suggest 3 easy dinners for the week\"\n"
            "- \"Help me shop on a $50 budget\"\n"
        )

    return ChatResponse(reply=reply)
