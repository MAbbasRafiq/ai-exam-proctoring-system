# =============================================================
# routes/monitoring.py
# NEW FILE: API endpoints for the AI exam monitoring system.
#
# The frontend sends violation reports here (via fetch/POST).
# This route is also used to retrieve violation history.
#
# Endpoints:
#   POST /monitoring/report   -> log a new violation
#   GET  /monitoring/list     -> get all violations for a user
# =============================================================

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from auth.dependencies import get_current_user
from monitoring.violation_logger import log_violation
from database.db import SessionLocal
from database.models import Violation

router = APIRouter()


# ---------------------------------------------------------------
# Schema: ViolationReport
# This defines what data the frontend must send when reporting
# a violation. Pydantic validates the data automatically.
# ---------------------------------------------------------------
class ViolationReport(BaseModel):
    session_id: str    # e.g. "SESSION_20250503_120000"
    violation_type: str  # e.g. "Mobile Phone Detected"
    # Note: screenshot is saved by the Python monitoring process directly,
    # not uploaded through this endpoint.


# ---------------------------------------------------------------
# POST /monitoring/report
# Called by the frontend to log a violation detected by the AI.
# Requires a valid Authorization token (user must be logged in).
# ---------------------------------------------------------------
@router.post("/report")
def report_violation(data: ViolationReport, authorization: str = Header(...)):
    # Extract the token from the "Bearer <token>" header
    token = authorization.split(" ")[1]

    # Look up who this token belongs to
    user = get_current_user(token)

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    # Save the violation to database and CSV
    log_violation(
        violation_type=data.violation_type,
        user_id=user.id,
        session_id=data.session_id,
        frame=None  # No screenshot from API (screenshots come from local Python cam process)
    )

    return {"message": "Violation logged successfully"}


# ---------------------------------------------------------------
# GET /monitoring/list
# Returns all violations for the currently logged-in user.
# The frontend can use this to show a "violations tab" to the admin.
# ---------------------------------------------------------------
@router.get("/list")
def get_violations(authorization: str = Header(...)):
    # Extract and verify token
    token = authorization.split(" ")[1]
    user = get_current_user(token)

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    # Open DB and fetch all violations for this user
    db = SessionLocal()
    violations = db.query(Violation).filter(Violation.user_id == user.id).all()
    db.close()

    # Convert each violation object to a plain dictionary for JSON response
    result = []
    for v in violations:
        result.append({
            "id": v.id,
            "session_id": v.session_id,
            "violation_type": v.violation_type,
            "severity": v.severity,
            "timestamp": v.timestamp,
            "screenshot_path": v.screenshot_path
        })

    return result
