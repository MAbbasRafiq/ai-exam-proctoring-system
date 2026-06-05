# =============================================================
# schemas/exam.py
# Pydantic schema for the exam submission request.
# =============================================================

from pydantic import BaseModel


# Used for POST /submit/
class SubmitRequest(BaseModel):
    # answers is a dictionary: question_id (string) -> selected option (string)
    # Example: {"1": "Paris", "2": "Newton", "3": "DNA"}
    answers: dict
