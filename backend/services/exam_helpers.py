# =============================================================
# Shared exam helpers: time windows + per-student shuffle.
# =============================================================

import random
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException


def ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def parse_iso_dt(value: Optional[str]) -> Optional[datetime]:
    if value is None or value == "":
        return None
    # datetime-local from browsers is often "YYYY-MM-DDTHH:MM" (no tz)
    raw = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        # Treat naive values as the laptop/server local timezone (LAN class)
        local_tz = datetime.now().astimezone().tzinfo
        dt = dt.replace(tzinfo=local_tz)
    return dt


def assert_exam_window_open(exam, now: Optional[datetime] = None, *, action: str = "access"):
    """Raise 403 if outside optional starts_at / ends_at window."""
    now = ensure_aware(now) or datetime.now(timezone.utc)
    starts = ensure_aware(getattr(exam, "starts_at", None))
    ends = ensure_aware(getattr(exam, "ends_at", None))

    if starts and now < starts:
        raise HTTPException(
            status_code=403,
            detail=f"Exam has not started yet. Opens at {starts.isoformat()}",
        )
    if ends and now > ends:
        raise HTTPException(
            status_code=403,
            detail=f"Exam window closed at {ends.isoformat()}. Cannot {action}.",
        )


def shuffle_question_payload(questions: list, user_id: int, exam_id: int) -> list:
    """Stable per-student shuffle of question order and option order."""
    rng = random.Random(f"{user_id}:{exam_id}")
    items = list(questions)
    rng.shuffle(items)
    out = []
    for q in items:
        opts = list(q.get("options") or [])
        rng.shuffle(opts)
        out.append({**q, "options": opts})
    return out
