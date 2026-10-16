from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class SubmitRequest(BaseModel):
    answers: dict
    exam_id: int


class ExamCreate(BaseModel):
    title: str
    duration_minutes: int = Field(default=10, ge=1, le=180)
    starts_at: Optional[str] = None  # ISO datetime
    ends_at: Optional[str] = None
    shuffle_questions: bool = True
    allow_math_symbols: bool = False


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=180)
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    shuffle_questions: Optional[bool] = None
    allow_math_symbols: Optional[bool] = None
    clear_window: bool = False  # if True, null out starts_at/ends_at


class OptionCreate(BaseModel):
    text: str
    is_correct: bool = False


class QuestionCreateBody(BaseModel):
    question: str
    question_type: str = "mcq"
    options: List[OptionCreate] = Field(default_factory=list)
    max_points: Optional[int] = Field(default=None, ge=1, le=100)

    @model_validator(mode="after")
    def normalize_type(self):
        t = (self.question_type or "mcq").lower().strip()
        if t not in ("mcq", "short"):
            raise ValueError("question_type must be 'mcq' or 'short'")
        self.question_type = t
        return self


class ShortGradeItem(BaseModel):
    question_id: int
    points_awarded: int = Field(ge=0, le=100)


class GradeAttemptBody(BaseModel):
    grades: List[ShortGradeItem]


class IntegrityEventBody(BaseModel):
    event_type: str = Field(..., min_length=2, max_length=64)


class StartExamBody(BaseModel):
    """Optional teacher approval token required when start approval is enabled."""

    approval_token: Optional[str] = None


class ApproveByCodeBody(BaseModel):
    code: str = Field(..., min_length=4, max_length=4)
