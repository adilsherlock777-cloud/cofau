from fastapi import APIRouter, Depends
from pydantic import BaseModel
import os
from openai import OpenAI

from routers.auth import get_current_user

router = APIRouter(prefix="/api/utils", tags=["utils"])

# Initialize OpenAI client
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
_openai_client = None

def get_openai_client():
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment")
        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI client initialized for grammar correction")
    return _openai_client


class GrammarRequest(BaseModel):
    text: str


class GrammarResponse(BaseModel):
    original: str
    corrected: str
    was_changed: bool


@router.post("/correct-grammar", response_model=GrammarResponse)
async def correct_grammar(
    request: GrammarRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Correct spelling and grammar in user's review text.
    Uses OpenAI GPT-4o-mini for fast, accurate corrections.
    """

    original_text = request.text.strip()

    # Skip if text is too short
    if len(original_text) < 3:
        return GrammarResponse(
            original=original_text,
            corrected=original_text,
            was_changed=False
        )

    try:
        client = get_openai_client()

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a grammar and spelling correction assistant. Your task is to correct any spelling mistakes and grammar errors in the user's text. Only fix errors - do not change the meaning, tone, or style. If the text is already correct, return it exactly as is. Return ONLY the corrected text, nothing else."
                },
                {
                    "role": "user",
                    "content": original_text
                }
            ],
            max_tokens=1000,
            temperature=0
        )

        corrected_text = response.choices[0].message.content.strip()

        # Check if anything changed
        was_changed = corrected_text != original_text

        print(f"📝 Grammar check: '{original_text[:50]}...' -> Changed: {was_changed}")

        return GrammarResponse(
            original=original_text,
            corrected=corrected_text,
            was_changed=was_changed
        )

    except Exception as e:
        print(f"❌ Grammar correction error: {str(e)}")
        # On error, return original text (don't block posting)
        return GrammarResponse(
            original=original_text,
            corrected=original_text,
            was_changed=False
        )