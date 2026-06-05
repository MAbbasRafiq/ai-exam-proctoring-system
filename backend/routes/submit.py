# =============================================================
# routes/submit.py
# Handles exam submission from the frontend.
#
# Endpoints:
#   POST /submit/  -> evaluate answers and save attempt to DB
# =============================================================

from fastapi import APIRouter, Header
from schemas.exam import SubmitRequest
from services.evaluation import submit_answers
from auth.dependencies import get_current_user

router = APIRouter()


# ---------------------------------------------------------------
# POST /submit/
# The user sends their answers (as a dict) along with their token.
# We verify who they are, then evaluate and save their answers.
# ---------------------------------------------------------------
@router.post("/")
def submit(req: SubmitRequest, authorization: str = Header(...)):
    # The Authorization header looks like: "Bearer eyJhbGci..."
    # We split by space and take the second part (the actual token)
    token = authorization.split(" ")[1]

    # Find the user this token belongs to
    user = get_current_user(token)

    # Evaluate their answers and save to DB
    return submit_answers(req.answers, user.id)
