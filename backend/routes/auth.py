# =============================================================
# routes/auth.py
# Registration and login (with roles).
# =============================================================

from fastapi import APIRouter, HTTPException
from database.db import SessionLocal
from database.models import User
from schemas.user import UserCreate, UserLogin
from auth.utils import hash_password, verify_password
from auth.auth import create_token
from config import ALLOW_TEACHER_REGISTER

router = APIRouter()


@router.post("/register")
def register(user: UserCreate):
    role = (user.role or "student").lower().strip()
    if role == "teacher" and not ALLOW_TEACHER_REGISTER:
        raise HTTPException(
            status_code=403,
            detail="Teacher registration is disabled. Contact the admin.",
        )
    if role not in ("student", "teacher"):
        role = "student"

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == user.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")

        new_user = User(
            username=user.username,
            password=hash_password(user.password),
            role=role,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {
            "message": "User created",
            "role": new_user.role,
            "user_id": new_user.id,
        }
    finally:
        db.close()


@router.post("/login")
def login(user: UserLogin):
    db = SessionLocal()
    try:
        db_user = db.query(User).filter(User.username == user.username).first()
        if not db_user or not verify_password(user.password, db_user.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        role = db_user.role or "student"
        if not db_user.role:
            db_user.role = "student"
            db.commit()

        token = create_token({"user_id": db_user.id, "role": role})
        return {
            "token": token,
            "role": role,
            "username": db_user.username,
            "user_id": db_user.id,
        }
    finally:
        db.close()
