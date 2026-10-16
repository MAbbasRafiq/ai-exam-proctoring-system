# =============================================================
# services/evaluation.py
# MCQ auto-grade + short answers saved for manual grading.
# =============================================================

from datetime import datetime, timezone, timedelta

from fastapi import HTTPException

from database.db import SessionLocal
from database.models import Option, Attempt, Answer, Question, Exam
from services.exam_helpers import ensure_aware
from services.scoring import (
    breakdown_attempt,
    load_answers_map,
    question_type_of,
    mcq_point_value,
)


def submit_answers(answers: dict, user_id: int, exam_id: int):
    db = SessionLocal()
    try:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam or not exam.is_published:
            raise HTTPException(status_code=404, detail="Exam not found or not published")

        attempt = (
            db.query(Attempt)
            .filter(Attempt.user_id == user_id, Attempt.exam_id == exam_id)
            .with_for_update()
            .first()
        )

        if attempt is None:
            raise HTTPException(
                status_code=400,
                detail="Exam not started. Call /exams/{id}/start first.",
            )

        if attempt.submitted_at is not None:
            raise HTTPException(status_code=409, detail="Exam already submitted")

        now = datetime.now(timezone.utc)
        class_end = ensure_aware(exam.ends_at)
        if class_end and now > class_end + timedelta(seconds=90):
            raise HTTPException(status_code=403, detail="Exam window has closed")

        if attempt.started_at is not None:
            started = ensure_aware(attempt.started_at)
            deadline = started + timedelta(minutes=exam.duration_minutes, seconds=60)
            if now > deadline:
                pass

        questions = db.query(Question).filter(Question.exam_id == exam_id).all()
        exam_question_ids = {q.id for q in questions}
        questions_by_id = {q.id: q for q in questions}

        correct_by_qid = {}
        mcq_ids = [q.id for q in questions if question_type_of(q) == "mcq"]
        if mcq_ids:
            rows = (
                db.query(Option)
                .filter(
                    Option.question_id.in_(mcq_ids),
                    Option.is_correct == 1,
                )
                .all()
            )
            correct_by_qid = {o.question_id: o.text for o in rows}

        submitted = answers or {}
        answer_rows = []

        for q in questions:
            qid = q.id
            qtype = question_type_of(q)
            raw = submitted.get(str(qid), submitted.get(qid))
            if qtype == "short":
                text = "" if raw is None else str(raw)
                answer_rows.append(
                    Answer(
                        attempt_id=attempt.id,
                        question_id=qid,
                        selected_option=text,
                        points_awarded=None,
                    )
                )
            else:
                selected = "" if raw is None else str(raw)
                pts = mcq_point_value(q)
                correct_text = correct_by_qid.get(qid)
                awarded = pts if correct_text is not None and correct_text == selected else 0
                answer_rows.append(
                    Answer(
                        attempt_id=attempt.id,
                        question_id=qid,
                        selected_option=selected,
                        points_awarded=awarded,
                    )
                )

        db.query(Answer).filter(Answer.attempt_id == attempt.id).delete(
            synchronize_session=False
        )
        for row in answer_rows:
            db.add(row)

        attempt.submitted_at = now
        db.flush()
        stats = breakdown_attempt(questions, {r.question_id: r for r in answer_rows})
        attempt.score = stats["score"]

        db.commit()
        db.refresh(attempt)

        return {
            "score": stats["score"],
            "total": stats["total"],
            "mcq_score": stats["mcq_score"],
            "mcq_total": stats["mcq_total"],
            "short_score": stats["short_score"],
            "short_total": stats["short_total"],
            "short_pending": stats["short_pending"],
            "attempt_id": attempt.id,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
