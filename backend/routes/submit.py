# =============================================================
# routes/submit.py
# Exam submission (one attempt per exam per student).
# =============================================================

from fastapi import APIRouter, Depends
from schemas.exam import SubmitRequest
from services.evaluation import submit_answers
from auth.dependencies import user_from_auth_header
from database.models import User

router = APIRouter()


@router.post("/")
def submit(req: SubmitRequest, user: User = Depends(user_from_auth_header)):
    return submit_answers(req.answers, user.id, req.exam_id)
