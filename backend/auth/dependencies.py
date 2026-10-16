# =============================================================
# auth/dependencies.py
# Token verification helpers for protected routes.
# =============================================================

from fastapi import Header, HTTPException
from jose import jwt
from database.db import SessionLocal
from database.models import User
from config import SECRET_KEY, ALGORITHM


def get_current_user(token: str):
    """Decode token and return User, or raise 401."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user


def user_from_auth_header(authorization: str = Header(...)):
    """FastAPI dependency: Authorization: Bearer <token>."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    return get_current_user(token)


def require_teacher(user: User):
    if getattr(user, "role", None) != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    return user
