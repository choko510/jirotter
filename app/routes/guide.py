from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.utils.ai_responder import ask_ai_guide

router = APIRouter()

class GuideQuestion(BaseModel):
    question: str

@router.post("/guide/ask")
async def ask_guide_question(body: GuideQuestion):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="質問内容が空です")
    
    answer = await ask_ai_guide(body.question)
    return {"answer": answer}
