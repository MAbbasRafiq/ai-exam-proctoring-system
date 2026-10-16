# =============================================================
# Score breakdown for mixed MCQ + manually graded short questions.
# =============================================================

from database.models import Question, Answer, Option


def question_type_of(q: Question) -> str:
    t = getattr(q, "question_type", None) or "mcq"
    return t if t in ("mcq", "short") else "mcq"


def mcq_point_value(q: Question) -> int:
    if question_type_of(q) != "mcq":
        return 0
    mp = getattr(q, "max_points", None)
    return int(mp) if mp is not None else 1


def short_max_points(q: Question):
    """Preset max for short Q, or None if teacher sets marks only when grading."""
    if question_type_of(q) != "short":
        return None
    mp = getattr(q, "max_points", None)
    return int(mp) if mp is not None else None


def breakdown_attempt(questions: list, answers_by_qid: dict) -> dict:
    mcq_score = 0
    mcq_total = 0
    short_score = 0
    short_total = 0
    short_total_is_partial = False
    short_pending = False

    for q in questions:
        qtype = question_type_of(q)
        ans = answers_by_qid.get(q.id)
        awarded = ans.points_awarded if ans else None

        if qtype == "short":
            preset_max = short_max_points(q)
            if preset_max is not None:
                short_total += preset_max
            elif awarded is not None:
                short_total += awarded
            else:
                short_total_is_partial = True

            if awarded is None:
                short_pending = True
            else:
                short_score += awarded
        else:
            pts = mcq_point_value(q)
            mcq_total += pts
            if awarded is not None:
                mcq_score += awarded

    exam_total = mcq_total + short_total
    if short_total_is_partial and short_pending:
        # Total unknown until all short Q graded (when no preset max on some)
        exam_total_display = mcq_total + short_total
    else:
        exam_total_display = exam_total

    total_score = mcq_score + short_score

    return {
        "mcq_score": mcq_score,
        "mcq_total": mcq_total,
        "short_score": short_score,
        "short_total": short_total,
        "short_pending": short_pending,
        "score": total_score,
        "total": exam_total_display,
        "exam_total": exam_total,
    }


def load_answers_map(db, attempt_id: int) -> dict:
    rows = db.query(Answer).filter(Answer.attempt_id == attempt_id).all()
    return {a.question_id: a for a in rows}


def recompute_attempt_score(db, attempt) -> dict:
    questions = (
        db.query(Question).filter(Question.exam_id == attempt.exam_id).all()
    )
    answers_by_qid = load_answers_map(db, attempt.id)
    stats = breakdown_attempt(questions, answers_by_qid)
    attempt.score = stats["score"]
    return stats
