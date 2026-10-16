# =============================================================
# routes/exams.py
# Teacher creates/publishes exams; students join by code.
# =============================================================

import secrets
import string
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from auth.dependencies import user_from_auth_header, require_teacher
from database.db import SessionLocal
from database.models import (
    Exam,
    Question,
    Option,
    Attempt,
    Answer,
    User,
    IntegrityEvent,
    StartApproval,
)
from config import (
    SHORT_QUESTIONS_ENABLED,
    QR_START_APPROVAL_ENABLED,
    CODE_START_APPROVAL_ENABLED,
    START_APPROVAL_REQUIRED,
)
from schemas.exam import (
    ExamCreate,
    ExamUpdate,
    QuestionCreateBody,
    IntegrityEventBody,
    GradeAttemptBody,
    StartExamBody,
    ApproveByCodeBody,
)
from services.exam_helpers import (
    parse_iso_dt,
    assert_exam_window_open,
    shuffle_question_payload,
    ensure_aware,
)
from services.scoring import (
    breakdown_attempt,
    load_answers_map,
    recompute_attempt_score,
    question_type_of,
    short_max_points,
)

router = APIRouter()


def _join_code(length: int = 6) -> str:
    # Avoid 0/O and 1/I/L — easy to confuse when reading aloud or on a board.
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _exam_dict(exam: Exam, question_count: int = None):
    data = {
        "id": exam.id,
        "title": exam.title,
        "join_code": exam.join_code,
        "duration_minutes": exam.duration_minutes,
        "is_published": exam.is_published,
        "created_by": exam.created_by,
        "starts_at": exam.starts_at.isoformat() if exam.starts_at else None,
        "ends_at": exam.ends_at.isoformat() if exam.ends_at else None,
        "shuffle_questions": bool(getattr(exam, "shuffle_questions", True)),
        "allow_math_symbols": bool(getattr(exam, "allow_math_symbols", False)),
    }
    if question_count is not None:
        data["question_count"] = question_count
    return data


def _validate_options(options):
    if len(options) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 options")
    if sum(1 for o in options if o.is_correct) != 1:
        raise HTTPException(status_code=400, detail="Exactly one option must be marked correct")


def _validate_question_body(body: QuestionCreateBody):
    qtype = (body.question_type or "mcq").lower()
    if qtype == "short":
        if not SHORT_QUESTIONS_ENABLED:
            raise HTTPException(
                status_code=403,
                detail="Short questions are disabled on this server",
            )
        return
    _validate_options(body.options)


def _serialize_question(q: Question, options, is_owner: bool, exam_allow_math: bool = False):
    qtype = question_type_of(q)
    base = {
        "id": str(q.id),
        "question": q.question,
        "question_type": qtype,
        "max_points": getattr(q, "max_points", None),
        # Driven by exam setting (not per-question)
        "allow_math_symbols": bool(exam_allow_math) and qtype == "short",
    }
    if qtype == "short":
        base["options"] = []
        return base
    if is_owner:
        base["options"] = [
            {"text": opt.text, "is_correct": bool(opt.is_correct)} for opt in options
        ]
    else:
        base["options"] = [opt.text for opt in options]
    return base


def _attempt_score_payload(db, attempt, questions):
    if not attempt or not attempt.submitted_at:
        return None
    answers_by_qid = load_answers_map(db, attempt.id)
    stats = breakdown_attempt(questions, answers_by_qid)
    return {
        "status": "submitted",
        "score": stats["score"],
        "total": stats["total"],
        "mcq_score": stats["mcq_score"],
        "mcq_total": stats["mcq_total"],
        "short_score": stats["short_score"],
        "short_total": stats["short_total"],
        "short_pending": stats["short_pending"],
    }


def _get_owned_exam(db, exam_id: int, user: User) -> Exam:
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.created_by == user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.post("/")
def create_exam(body: ExamCreate, user: User = Depends(user_from_auth_header)):
    require_teacher(user)
    db = SessionLocal()
    try:
        code = _join_code()
        for _ in range(5):
            if not db.query(Exam).filter(Exam.join_code == code).first():
                break
            code = _join_code()

        starts = parse_iso_dt(body.starts_at)
        ends = parse_iso_dt(body.ends_at)
        if starts and ends and ends <= starts:
            raise HTTPException(status_code=400, detail="ends_at must be after starts_at")

        exam = Exam(
            title=body.title.strip(),
            join_code=code,
            duration_minutes=body.duration_minutes,
            is_published=False,
            created_by=user.id,
            starts_at=starts,
            ends_at=ends,
            shuffle_questions=body.shuffle_questions,
            allow_math_symbols=bool(body.allow_math_symbols),
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)
        return _exam_dict(exam, 0)
    finally:
        db.close()


@router.patch("/{exam_id}")
def update_exam(
    exam_id: int,
    body: ExamUpdate,
    user: User = Depends(user_from_auth_header),
):
    require_teacher(user)
    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        if body.title is not None:
            exam.title = body.title.strip()
        if body.duration_minutes is not None:
            exam.duration_minutes = body.duration_minutes
        if body.shuffle_questions is not None:
            exam.shuffle_questions = body.shuffle_questions
        if body.allow_math_symbols is not None:
            exam.allow_math_symbols = bool(body.allow_math_symbols)
        if body.clear_window:
            exam.starts_at = None
            exam.ends_at = None
        else:
            if body.starts_at is not None:
                exam.starts_at = parse_iso_dt(body.starts_at)
            if body.ends_at is not None:
                exam.ends_at = parse_iso_dt(body.ends_at)
        starts = ensure_aware(exam.starts_at)
        ends = ensure_aware(exam.ends_at)
        if starts and ends and ends <= starts:
            raise HTTPException(status_code=400, detail="ends_at must be after starts_at")
        db.commit()
        db.refresh(exam)
        count = db.query(Question).filter(Question.exam_id == exam.id).count()
        return _exam_dict(exam, count)
    finally:
        db.close()


@router.get("/mine")
def list_my_exams(user: User = Depends(user_from_auth_header)):
    require_teacher(user)
    db = SessionLocal()
    try:
        exams = (
            db.query(Exam)
            .filter(Exam.created_by == user.id)
            .order_by(Exam.id.desc())
            .all()
        )
        result = []
        for exam in exams:
            count = db.query(Question).filter(Question.exam_id == exam.id).count()
            result.append(_exam_dict(exam, count))
        return result
    finally:
        db.close()


@router.get("/join/{code}")
def join_exam_by_code(code: str, user: User = Depends(user_from_auth_header)):
    db = SessionLocal()
    try:
        exam = (
            db.query(Exam)
            .filter(Exam.join_code == code.strip().upper())
            .first()
        )
        if not exam or not exam.is_published:
            raise HTTPException(status_code=404, detail="Invalid join code or exam not published")

        qcount = db.query(Question).filter(Question.exam_id == exam.id).count()
        attempt = (
            db.query(Attempt)
            .filter(Attempt.user_id == user.id, Attempt.exam_id == exam.id)
            .first()
        )
        status = "not_started"
        if attempt and attempt.submitted_at:
            status = "submitted"
        elif attempt and attempt.started_at:
            status = "in_progress"

        window_ok = True
        window_message = None
        try:
            if status != "submitted":
                assert_exam_window_open(exam, action="join")
        except HTTPException as e:
            window_ok = False
            window_message = e.detail

        return {
            **_exam_dict(exam, qcount),
            "attempt_status": status,
            "score": attempt.score if attempt and attempt.submitted_at else None,
            "total": qcount if attempt and attempt.submitted_at else None,
            "window_ok": window_ok,
            "window_message": window_message,
        }
    finally:
        db.close()


@router.post("/{exam_id}/publish")
def publish_exam(exam_id: int, user: User = Depends(user_from_auth_header)):
    require_teacher(user)
    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        qcount = db.query(Question).filter(Question.exam_id == exam.id).count()
        if qcount < 1:
            raise HTTPException(status_code=400, detail="Add at least one question before publishing")
        exam.is_published = True
        db.commit()
        return _exam_dict(exam, qcount)
    finally:
        db.close()


@router.post("/{exam_id}/unpublish")
def unpublish_exam(exam_id: int, user: User = Depends(user_from_auth_header)):
    require_teacher(user)
    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        exam.is_published = False
        db.commit()
        count = db.query(Question).filter(Question.exam_id == exam.id).count()
        return _exam_dict(exam, count)
    finally:
        db.close()


@router.delete("/{exam_id}")
def delete_exam(exam_id: int, user: User = Depends(user_from_auth_header)):
    """Delete an exam owned by the teacher, including questions/attempts/results."""
    require_teacher(user)
    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)

        questions = db.query(Question).filter(Question.exam_id == exam.id).all()
        question_ids = [q.id for q in questions]
        if question_ids:
            db.query(Option).filter(Option.question_id.in_(question_ids)).delete(
                synchronize_session=False
            )
            db.query(Question).filter(Question.id.in_(question_ids)).delete(
                synchronize_session=False
            )

        attempts = db.query(Attempt).filter(Attempt.exam_id == exam.id).all()
        attempt_ids = [a.id for a in attempts]
        if attempt_ids:
            db.query(Answer).filter(Answer.attempt_id.in_(attempt_ids)).delete(
                synchronize_session=False
            )
            db.query(Attempt).filter(Attempt.id.in_(attempt_ids)).delete(
                synchronize_session=False
            )

        db.query(IntegrityEvent).filter(IntegrityEvent.exam_id == exam.id).delete(
            synchronize_session=False
        )

        db.delete(exam)
        db.commit()
        return {"message": "Exam deleted", "id": exam_id}
    finally:
        db.close()


@router.post("/{exam_id}/questions")
def add_question(
    exam_id: int,
    body: QuestionCreateBody,
    user: User = Depends(user_from_auth_header),
):
    require_teacher(user)
    _validate_question_body(body)
    qtype = body.question_type

    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        q = Question(
            question=body.question.strip(),
            exam_id=exam.id,
            question_type=qtype,
            max_points=body.max_points if qtype == "short" else (body.max_points or 1),
        )
        db.add(q)
        db.commit()
        db.refresh(q)

        if qtype == "mcq":
            for opt in body.options:
                db.add(
                    Option(
                        question_id=q.id,
                        text=opt.text.strip(),
                        is_correct=1 if opt.is_correct else 0,
                    )
                )
            db.commit()
        return {
            "id": q.id,
            "question": q.question,
            "exam_id": exam.id,
            "question_type": qtype,
            "allow_math_symbols": bool(getattr(exam, "allow_math_symbols", False))
            and qtype == "short",
        }
    finally:
        db.close()


@router.put("/{exam_id}/questions/{question_id}")
def update_question(
    exam_id: int,
    question_id: int,
    body: QuestionCreateBody,
    user: User = Depends(user_from_auth_header),
):
    require_teacher(user)
    _validate_question_body(body)
    qtype = body.question_type

    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        q = (
            db.query(Question)
            .filter(Question.id == question_id, Question.exam_id == exam.id)
            .first()
        )
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")

        q.question = body.question.strip()
        q.question_type = qtype
        if qtype == "short":
            q.max_points = body.max_points
            db.query(Option).filter(Option.question_id == q.id).delete()
        else:
            q.max_points = body.max_points or 1
            db.query(Option).filter(Option.question_id == q.id).delete()
            for opt in body.options:
                db.add(
                    Option(
                        question_id=q.id,
                        text=opt.text.strip(),
                        is_correct=1 if opt.is_correct else 0,
                    )
                )
        db.commit()
        return {
            "id": q.id,
            "question": q.question,
            "exam_id": exam.id,
            "question_type": qtype,
            "allow_math_symbols": bool(getattr(exam, "allow_math_symbols", False))
            and qtype == "short",
        }
    finally:
        db.close()


@router.delete("/{exam_id}/questions/{question_id}")
def delete_question(
    exam_id: int,
    question_id: int,
    user: User = Depends(user_from_auth_header),
):
    require_teacher(user)
    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        q = (
            db.query(Question)
            .filter(Question.id == question_id, Question.exam_id == exam.id)
            .first()
        )
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")

        db.query(Option).filter(Option.question_id == q.id).delete()
        db.delete(q)
        db.commit()
        return {"message": "Question deleted", "id": question_id}
    finally:
        db.close()


@router.get("/{exam_id}/questions")
def get_exam_questions(exam_id: int, user: User = Depends(user_from_auth_header)):
    db = SessionLocal()
    try:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        is_owner = exam.created_by == user.id and user.role == "teacher"
        if not exam.is_published and not is_owner:
            raise HTTPException(status_code=403, detail="Exam not published")

        attempt = (
            db.query(Attempt)
            .filter(Attempt.user_id == user.id, Attempt.exam_id == exam_id)
            .first()
        )
        attempt_status = "not_started"
        if attempt and attempt.submitted_at:
            attempt_status = "submitted"
        elif attempt and attempt.started_at:
            attempt_status = "in_progress"

        # Students outside window cannot load (except already submitted review)
        if not is_owner and attempt_status != "submitted":
            assert_exam_window_open(exam, action="load questions")

        questions = db.query(Question).filter(Question.exam_id == exam_id).all()
        exam_math = bool(getattr(exam, "allow_math_symbols", False))
        result = []
        for q in questions:
            options = db.query(Option).filter(Option.question_id == q.id).all()
            result.append(_serialize_question(q, options, is_owner, exam_math))

        if (
            not is_owner
            and getattr(exam, "shuffle_questions", True)
            and attempt_status != "submitted"
        ):
            result = shuffle_question_payload(result, user.id, exam.id)

        attempt_payload = {"status": attempt_status}
        if attempt and attempt.submitted_at:
            score_info = _attempt_score_payload(db, attempt, questions)
            if score_info:
                attempt_payload = score_info
        elif attempt and attempt.started_at:
            attempt_payload = {"status": "in_progress"}

        return {
            "exam": _exam_dict(exam, len(result)),
            "questions": result,
            "attempt": attempt_payload,
            "short_questions_enabled": SHORT_QUESTIONS_ENABLED,
            "qr_start_approval_enabled": QR_START_APPROVAL_ENABLED,
            "code_start_approval_enabled": CODE_START_APPROVAL_ENABLED,
            "start_approval_required": START_APPROVAL_REQUIRED,
        }
    finally:
        db.close()


APPROVAL_TOKEN_TTL_MINUTES = 10


def _approval_public(row: StartApproval, now: datetime) -> dict:
    status = row.status
    expires = ensure_aware(row.expires_at)
    if status == "pending" and expires and expires <= now:
        status = "expired"
    return {
        "token": row.token,
        "short_code": row.short_code,
        "exam_id": row.exam_id,
        "status": status,
        "expires_at": expires.isoformat() if expires else None,
        "approved_at": (
            ensure_aware(row.approved_at).isoformat() if row.approved_at else None
        ),
    }


def _generate_short_code(db, now: datetime) -> str:
    """4-digit code unique among still-active pending/approved rows."""
    for _ in range(40):
        code = f"{secrets.randbelow(10000):04d}"
        clash = (
            db.query(StartApproval)
            .filter(
                StartApproval.short_code == code,
                StartApproval.status.in_(("pending", "approved")),
                StartApproval.expires_at > now,
            )
            .first()
        )
        if not clash:
            return code
    raise HTTPException(status_code=500, detail="Could not allocate approval code")


def _apply_teacher_approve(db, row: StartApproval, exam: Exam, user: User, now: datetime):
    expires = ensure_aware(row.expires_at)
    if row.status == "used":
        raise HTTPException(status_code=409, detail="Already used")
    if row.status == "expired" or (expires and expires <= now):
        row.status = "expired"
        db.commit()
        raise HTTPException(
            status_code=410,
            detail="Approval expired — student must request again",
        )
    if row.status == "approved":
        student = db.query(User).filter(User.id == row.student_id).first()
        payload = _approval_public(row, now)
        payload.update(
            {
                "exam_title": exam.title,
                "student_username": student.username if student else None,
            }
        )
        return payload

    if row.status != "pending":
        raise HTTPException(status_code=409, detail=f"Cannot approve status={row.status}")

    row.status = "approved"
    row.approved_at = now
    row.approved_by = user.id
    db.commit()
    db.refresh(row)

    student = db.query(User).filter(User.id == row.student_id).first()
    payload = _approval_public(row, now)
    payload.update(
        {
            "exam_title": exam.title,
            "student_username": student.username if student else None,
        }
    )
    return payload


@router.post("/{exam_id}/start-approval")
def create_start_approval(exam_id: int, user: User = Depends(user_from_auth_header)):
    """Student: create a pending approval (QR token and/or 4-digit code)."""
    if not START_APPROVAL_REQUIRED:
        raise HTTPException(status_code=400, detail="Start approval is disabled")
    if user.role == "teacher":
        raise HTTPException(status_code=403, detail="Students only")

    db = SessionLocal()
    try:
        exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_published == True).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found or not published")

        assert_exam_window_open(exam, action="request start approval")

        attempt = (
            db.query(Attempt)
            .filter(Attempt.user_id == user.id, Attempt.exam_id == exam_id)
            .first()
        )
        if attempt and attempt.submitted_at is not None:
            raise HTTPException(status_code=409, detail="Exam already submitted")
        if attempt and attempt.started_at is not None:
            raise HTTPException(
                status_code=409,
                detail="Exam already started — resume without approval",
            )

        now = datetime.now(timezone.utc)
        # Invalidate older pending tokens for this student+exam
        stale = (
            db.query(StartApproval)
            .filter(
                StartApproval.exam_id == exam_id,
                StartApproval.student_id == user.id,
                StartApproval.status == "pending",
            )
            .all()
        )
        for row in stale:
            row.status = "expired"

        token = secrets.token_urlsafe(24)
        short_code = (
            _generate_short_code(db, now) if CODE_START_APPROVAL_ENABLED else None
        )
        row = StartApproval(
            token=token,
            short_code=short_code,
            exam_id=exam_id,
            student_id=user.id,
            status="pending",
            expires_at=now + timedelta(minutes=APPROVAL_TOKEN_TTL_MINUTES),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _approval_public(row, now)
    finally:
        db.close()


@router.get("/start-approval/{token}/status")
def start_approval_status(token: str, user: User = Depends(user_from_auth_header)):
    """Student polls until teacher approves."""
    db = SessionLocal()
    try:
        row = db.query(StartApproval).filter(StartApproval.token == token).first()
        if not row:
            raise HTTPException(status_code=404, detail="Approval token not found")
        if row.student_id != user.id:
            raise HTTPException(status_code=403, detail="Not your approval token")

        now = datetime.now(timezone.utc)
        expires = ensure_aware(row.expires_at)
        if row.status == "pending" and expires and expires <= now:
            row.status = "expired"
            db.commit()

        return _approval_public(row, now)
    finally:
        db.close()


@router.get("/start-approval/{token}")
def start_approval_detail(token: str, user: User = Depends(user_from_auth_header)):
    """Teacher views who is waiting for approval."""
    require_teacher(user)
    db = SessionLocal()
    try:
        row = (
            db.query(StartApproval, Exam, User)
            .join(Exam, Exam.id == StartApproval.exam_id)
            .join(User, User.id == StartApproval.student_id)
            .filter(StartApproval.token == token)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Approval token not found")

        approval, exam, student = row
        if exam.created_by != user.id:
            raise HTTPException(status_code=403, detail="Not your exam")

        now = datetime.now(timezone.utc)
        expires = ensure_aware(approval.expires_at)
        if approval.status == "pending" and expires and expires <= now:
            approval.status = "expired"
            db.commit()

        payload = _approval_public(approval, now)
        payload.update(
            {
                "exam_title": exam.title,
                "student_username": student.username,
                "student_id": student.id,
            }
        )
        return payload
    finally:
        db.close()


@router.post("/start-approval/{token}/approve")
def approve_start_approval(token: str, user: User = Depends(user_from_auth_header)):
    """Teacher approves via QR / token — student may then call /start."""
    require_teacher(user)
    if not START_APPROVAL_REQUIRED:
        raise HTTPException(status_code=400, detail="Start approval is disabled")

    db = SessionLocal()
    try:
        row = db.query(StartApproval).filter(StartApproval.token == token).first()
        if not row:
            raise HTTPException(status_code=404, detail="Approval token not found")

        exam = db.query(Exam).filter(Exam.id == row.exam_id).first()
        if not exam or exam.created_by != user.id:
            raise HTTPException(status_code=403, detail="Not your exam")

        now = datetime.now(timezone.utc)
        return _apply_teacher_approve(db, row, exam, user, now)
    finally:
        db.close()


@router.post("/start-approval/approve-by-code")
def approve_start_by_code(
    body: ApproveByCodeBody,
    user: User = Depends(user_from_auth_header),
):
    """Teacher types the student's 4-digit code to approve start."""
    require_teacher(user)
    if not CODE_START_APPROVAL_ENABLED:
        raise HTTPException(status_code=400, detail="Code start approval is disabled")

    code = (body.code or "").strip()
    if not code.isdigit() or len(code) != 4:
        raise HTTPException(status_code=400, detail="Code must be exactly 4 digits")

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        row = (
            db.query(StartApproval)
            .filter(
                StartApproval.short_code == code,
                StartApproval.status.in_(("pending", "approved")),
            )
            .order_by(StartApproval.created_at.desc())
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="No matching approval code")

        exam = db.query(Exam).filter(Exam.id == row.exam_id).first()
        if not exam or exam.created_by != user.id:
            raise HTTPException(status_code=403, detail="Not your exam")

        return _apply_teacher_approve(db, row, exam, user, now)
    finally:
        db.close()


@router.post("/{exam_id}/start")
def start_exam(
    exam_id: int,
    body: StartExamBody = StartExamBody(),
    user: User = Depends(user_from_auth_header),
):
    db = SessionLocal()
    try:
        exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_published == True).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found or not published")

        assert_exam_window_open(exam, action="start")

        attempt = (
            db.query(Attempt)
            .filter(Attempt.user_id == user.id, Attempt.exam_id == exam_id)
            .first()
        )

        now = datetime.now(timezone.utc)
        approval_token = (body.approval_token or "").strip() or None

        if attempt and attempt.submitted_at is not None:
            raise HTTPException(status_code=409, detail="Exam already submitted")

        # First start only: require teacher approval when QR and/or code enabled
        needs_approval = START_APPROVAL_REQUIRED and (
            attempt is None or attempt.started_at is None
        )
        approval_row = None
        if needs_approval:
            if not approval_token:
                raise HTTPException(
                    status_code=403,
                    detail="Teacher approval required before starting",
                )
            approval_row = (
                db.query(StartApproval)
                .filter(StartApproval.token == approval_token)
                .first()
            )
            if not approval_row:
                raise HTTPException(status_code=403, detail="Invalid approval token")
            if approval_row.student_id != user.id or approval_row.exam_id != exam_id:
                raise HTTPException(status_code=403, detail="Approval token mismatch")
            expires = ensure_aware(approval_row.expires_at)
            if approval_row.status == "used":
                raise HTTPException(status_code=403, detail="Approval already used")
            if approval_row.status == "expired" or (expires and expires <= now):
                approval_row.status = "expired"
                db.commit()
                raise HTTPException(status_code=410, detail="Approval expired")
            if approval_row.status != "approved":
                raise HTTPException(
                    status_code=403,
                    detail="Waiting for teacher to approve",
                )

        if attempt is None:
            attempt = Attempt(
                user_id=user.id,
                exam_id=exam_id,
                score=None,
                started_at=now,
                submitted_at=None,
            )
            db.add(attempt)
            try:
                if approval_row is not None:
                    approval_row.status = "used"
                    approval_row.used_at = now
                db.commit()
                db.refresh(attempt)
            except IntegrityError:
                # Parallel double-start: return the existing attempt
                db.rollback()
                attempt = (
                    db.query(Attempt)
                    .filter(Attempt.user_id == user.id, Attempt.exam_id == exam_id)
                    .first()
                )
                if attempt is None:
                    raise HTTPException(status_code=500, detail="Could not start exam")
                if attempt.submitted_at is not None:
                    raise HTTPException(status_code=409, detail="Exam already submitted")
        elif attempt.started_at is None:
            attempt.started_at = now
            if approval_row is not None:
                approval_row.status = "used"
                approval_row.used_at = now
            db.commit()
            db.refresh(attempt)

        started = ensure_aware(attempt.started_at)
        ends_at = started + timedelta(minutes=exam.duration_minutes)

        # Also respect class ends_at if sooner
        class_end = ensure_aware(exam.ends_at)
        if class_end and class_end < ends_at:
            ends_at = class_end

        remaining = max(0, int((ends_at - now).total_seconds()))

        return {
            "exam_id": exam.id,
            "attempt_id": attempt.id,
            "started_at": started.isoformat(),
            "ends_at": ends_at.isoformat(),
            "duration_minutes": exam.duration_minutes,
            "time_left_seconds": remaining,
        }
    finally:
        db.close()


@router.post("/{exam_id}/integrity")
def log_integrity_event(
    exam_id: int,
    body: IntegrityEventBody,
    user: User = Depends(user_from_auth_header),
):
    """Log tab blur / leave events (does not block the exam)."""
    db = SessionLocal()
    try:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam or not exam.is_published:
            raise HTTPException(status_code=404, detail="Exam not found")

        event = IntegrityEvent(
            exam_id=exam_id,
            user_id=user.id,
            event_type=body.event_type.strip()[:64],
        )
        db.add(event)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@router.get("/{exam_id}/results")
def exam_results(exam_id: int, user: User = Depends(user_from_auth_header)):
    require_teacher(user)
    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        total_q = db.query(Question).filter(Question.exam_id == exam_id).count()
        attempts = (
            db.query(Attempt, User)
            .join(User, User.id == Attempt.user_id)
            .filter(Attempt.exam_id == exam_id, Attempt.submitted_at.isnot(None))
            .order_by(Attempt.submitted_at.asc())
            .all()
        )

        counts = dict(
            db.query(IntegrityEvent.user_id, func.count(IntegrityEvent.id))
            .filter(IntegrityEvent.exam_id == exam_id)
            .group_by(IntegrityEvent.user_id)
            .all()
        )

        questions = db.query(Question).filter(Question.exam_id == exam_id).all()
        rows = []
        for attempt, student in attempts:
            stats = breakdown_attempt(questions, load_answers_map(db, attempt.id))
            rows.append(
                {
                    "attempt_id": attempt.id,
                    "user_id": student.id,
                    "username": student.username,
                    "score": stats["score"],
                    "total": stats["total"],
                    "mcq_score": stats["mcq_score"],
                    "mcq_total": stats["mcq_total"],
                    "short_score": stats["short_score"],
                    "short_total": stats["short_total"],
                    "short_pending": stats["short_pending"],
                    "integrity_events": counts.get(student.id, 0),
                    "started_at": attempt.started_at.isoformat() if attempt.started_at else None,
                    "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                }
            )
        return {"exam": _exam_dict(exam, total_q), "results": rows}
    finally:
        db.close()


@router.get("/{exam_id}/results.csv")
def exam_results_csv(exam_id: int, user: User = Depends(user_from_auth_header)):
    """Scores + each short-question answer text for teacher marking/export."""
    import csv
    import io

    require_teacher(user)
    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        attempts = (
            db.query(Attempt, User)
            .join(User, User.id == Attempt.user_id)
            .filter(Attempt.exam_id == exam_id, Attempt.submitted_at.isnot(None))
            .order_by(Attempt.submitted_at.asc())
            .all()
        )
        counts = dict(
            db.query(IntegrityEvent.user_id, func.count(IntegrityEvent.id))
            .filter(IntegrityEvent.exam_id == exam_id)
            .group_by(IntegrityEvent.user_id)
            .all()
        )

        questions = (
            db.query(Question)
            .filter(Question.exam_id == exam_id)
            .order_by(Question.id.asc())
            .all()
        )
        short_qs = [q for q in questions if question_type_of(q) == "short"]

        header = [
            "username",
            "score",
            "total",
            "mcq_score",
            "mcq_total",
            "short_score",
            "short_total",
            "short_pending",
            "integrity_events",
            "started_at",
            "submitted_at",
        ]
        for i, q in enumerate(short_qs, start=1):
            header.append(f"short_q{i}_id")
            header.append(f"short_q{i}_prompt")
            header.append(f"short_q{i}_answer")
            header.append(f"short_q{i}_marks")

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(header)

        for attempt, student in attempts:
            answers_by_qid = load_answers_map(db, attempt.id)
            stats = breakdown_attempt(questions, answers_by_qid)
            started = attempt.started_at.isoformat() if attempt.started_at else ""
            submitted = attempt.submitted_at.isoformat() if attempt.submitted_at else ""
            row = [
                student.username,
                stats["score"],
                stats["total"],
                stats["mcq_score"],
                stats["mcq_total"],
                stats["short_score"],
                stats["short_total"],
                stats["short_pending"],
                counts.get(student.id, 0),
                started,
                submitted,
            ]
            for q in short_qs:
                ans = answers_by_qid.get(q.id)
                row.append(q.id)
                row.append(q.question or "")
                row.append((ans.selected_option if ans else "") or "")
                row.append(
                    "" if ans is None or ans.points_awarded is None else ans.points_awarded
                )
            writer.writerow(row)

        return PlainTextResponse(buf.getvalue(), media_type="text/csv")
    finally:
        db.close()


@router.get("/{exam_id}/attempts/{attempt_id}/grading")
def get_attempt_grading(
    exam_id: int,
    attempt_id: int,
    user: User = Depends(user_from_auth_header),
):
    """Teacher: fetch short answers for manual grading."""
    require_teacher(user)
    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        attempt = (
            db.query(Attempt)
            .filter(Attempt.id == attempt_id, Attempt.exam_id == exam.id)
            .first()
        )
        if not attempt or not attempt.submitted_at:
            raise HTTPException(status_code=404, detail="Submitted attempt not found")

        student = db.query(User).filter(User.id == attempt.user_id).first()
        all_questions = (
            db.query(Question)
            .filter(Question.exam_id == exam.id)
            .order_by(Question.id.asc())
            .all()
        )
        questions = [q for q in all_questions if question_type_of(q) == "short"]
        answers_by_qid = load_answers_map(db, attempt.id)
        items = []
        for q in questions:
            ans = answers_by_qid.get(q.id)
            raw = "" if ans is None or ans.selected_option is None else str(ans.selected_option)
            items.append(
                {
                    "question_id": q.id,
                    "question": q.question,
                    "max_points": short_max_points(q),
                    "answer_text": raw,
                    "points_awarded": ans.points_awarded if ans else None,
                }
            )
        stats = breakdown_attempt(
            db.query(Question).filter(Question.exam_id == exam.id).all(),
            answers_by_qid,
        )
        return {
            "attempt_id": attempt.id,
            "username": student.username if student else "",
            "items": items,
            "stats": stats,
        }
    finally:
        db.close()


@router.patch("/{exam_id}/attempts/{attempt_id}/grade")
def grade_attempt_short(
    exam_id: int,
    attempt_id: int,
    body: GradeAttemptBody,
    user: User = Depends(user_from_auth_header),
):
    require_teacher(user)
    if not SHORT_QUESTIONS_ENABLED:
        raise HTTPException(status_code=403, detail="Short questions are disabled")

    db = SessionLocal()
    try:
        exam = _get_owned_exam(db, exam_id, user)
        attempt = (
            db.query(Attempt)
            .filter(Attempt.id == attempt_id, Attempt.exam_id == exam.id)
            .with_for_update()
            .first()
        )
        if not attempt or not attempt.submitted_at:
            raise HTTPException(status_code=404, detail="Submitted attempt not found")

        short_questions = {
            q.id: q
            for q in db.query(Question)
            .filter(Question.exam_id == exam.id, Question.question_type == "short")
            .all()
        }
        answers_by_qid = load_answers_map(db, attempt.id)

        for item in body.grades:
            q = short_questions.get(item.question_id)
            if not q:
                raise HTTPException(
                    status_code=400,
                    detail=f"Question {item.question_id} is not a short question in this exam",
                )
            preset_max = short_max_points(q)
            if preset_max is not None and item.points_awarded > preset_max:
                raise HTTPException(
                    status_code=400,
                    detail=f"Points for Q{item.question_id} cannot exceed {preset_max}",
                )
            ans = answers_by_qid.get(q.id)
            if ans is None:
                ans = Answer(
                    attempt_id=attempt.id,
                    question_id=q.id,
                    selected_option="",
                    points_awarded=item.points_awarded,
                )
                db.add(ans)
            else:
                ans.points_awarded = item.points_awarded

        stats = recompute_attempt_score(db, attempt)
        db.commit()
        return {"ok": True, "stats": stats}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
