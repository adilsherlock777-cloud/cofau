from fastapi import APIRouter, Depends
from pydantic import BaseModel
import language_tool_python

from routers.auth import get_current_user

router = APIRouter(prefix="/api/utils", tags=["utils"])

# Initialize LanguageTool once (lazy loading)
_language_tool = None

def get_language_tool():
    global _language_tool
    if _language_tool is None:
        print("🔧 Initializing LanguageTool (first time only)...")
        _language_tool = language_tool_python.LanguageTool('en-US')
        print("✅ LanguageTool ready!")
    return _language_tool


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
    Uses LanguageTool - runs locally, no API needed.
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
        tool = get_language_tool()
        
        # Get corrections
        matches = tool.check(original_text)
        
        # Apply corrections
        corrected_text = language_tool_python.utils.correct(original_text, matches)
        
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