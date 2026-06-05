# =============================================================
# routes/questions.py
# Returns all exam questions with their answer options.
#
# Endpoints:
#   GET /questions/  -> list all questions (no auth required)
# =============================================================

from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Question, Option

router = APIRouter()


# ---------------------------------------------------------------
# GET /questions/
# Fetches all questions from the database.
# For each question, it also fetches the list of options.
# The correct answer is NOT included here (to prevent cheating).
# ---------------------------------------------------------------
@router.get("/")
def get_questions():
    db = SessionLocal()

    # Get all questions from the questions table
    questions = db.query(Question).all()

    result = []

    for q in questions:
        # Get all options for this specific question
        options = db.query(Option).filter(Option.question_id == q.id).all()

        # Build a dict with question text and option texts only
        # We do NOT include is_correct here — that stays on the server
        result.append({
            "id": str(q.id),        # convert to string for frontend compatibility
            "question": q.question,
            "options": [opt.text for opt in options]  # list of option strings
        })

    db.close()
    return result
