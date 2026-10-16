# =============================================================
# routes/questions.py
# Legacy endpoint — kept for demo, now requires auth.
# Prefer GET /exams/{id}/questions for class quizzes.
# =============================================================

from fastapi import APIRouter, Depends
from database.db import SessionLocal
from database.models import Question, Option, User
from auth.dependencies import user_from_auth_header

router = APIRouter()


@router.get("/")
def get_questions(user: User = Depends(user_from_auth_header)):
    """
    Returns questions that are NOT tied to a multi-exam (exam_id IS NULL).
    Used only for the old single-bank demo path.
    """
    db = SessionLocal()
    try:
        questions = db.query(Question).filter(Question.exam_id.is_(None)).all()
        result = []
        for q in questions:
            options = db.query(Option).filter(Option.question_id == q.id).all()
            result.append(
                {
                    "id": str(q.id),
                    "question": q.question,
                    "options": [opt.text for opt in options],
                }
            )
        return result
    finally:
        db.close()
