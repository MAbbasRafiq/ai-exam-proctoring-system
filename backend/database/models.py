# =============================================================
# database/models.py
# SQLAlchemy table definitions.
# =============================================================

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from database.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String, default="student", nullable=False)


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    join_code = Column(String, unique=True, index=True, nullable=False)
    duration_minutes = Column(Integer, default=10, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Optional class window (UTC-aware). Null = always open while published.
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    shuffle_questions = Column(Boolean, default=True, nullable=False)
    # When true, Discrete Math symbol toolbar is available for this exam
    # (teacher question editor + student short answers).
    allow_math_symbols = Column(Boolean, default=False, nullable=False)


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=True, index=True)
    # mcq | short (short = manual grading by teacher)
    question_type = Column(String, default="mcq", nullable=False)
    # MCQ default 1 if null. Short: optional cap set at create; null = marks at grade time only.
    max_points = Column(Integer, nullable=True)
    # Legacy per-question flag; exam.allow_math_symbols is the source of truth.
    allow_math_symbols = Column(Boolean, default=False, nullable=False)


class Option(Base):
    __tablename__ = "options"

    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    text = Column(String)
    is_correct = Column(Integer)  # 1 = correct, 0 = wrong


class Attempt(Base):
    __tablename__ = "attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "exam_id", name="uq_attempt_user_exam"),
    )

    id = Column(Integer, primary_key=True, index=True)
    score = Column(Integer, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=True, index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), index=True)
    question_id = Column(Integer)
    selected_option = Column(String)
    # MCQ: set on submit. Short: null until teacher grades (empty answer allowed).
    points_awarded = Column(Integer, nullable=True)


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(String)
    violation_type = Column(String)
    severity = Column(String)
    timestamp = Column(String)
    screenshot_path = Column(String, nullable=True)


class IntegrityEvent(Base):
    """Lightweight tab-blur / leave logs (not AI monitoring)."""

    __tablename__ = "integrity_events"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    event_type = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StartApproval(Base):
    """One-time teacher approval (QR and/or 4-digit code) before exam start."""

    __tablename__ = "start_approvals"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    short_code = Column(String(4), index=True, nullable=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), index=True, nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    # pending | approved | used | expired
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
