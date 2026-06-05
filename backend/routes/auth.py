# =============================================================
# routes/auth.py
# Handles user registration and login.
#
# Endpoints:
#   POST /auth/register  -> create a new account
#   POST /auth/login     -> login and get a JWT token
# =============================================================

from fastapi import APIRouter
from database.db import SessionLocal
from database.models import User
from schemas.user import UserCreate, UserLogin
from auth.utils import hash_password, verify_password
from auth.auth import create_token

router = APIRouter()


# ---------------------------------------------------------------
# POST /auth/register
# Creates a new user with a hashed password.
# ---------------------------------------------------------------
@router.post("/register")
def register(user: UserCreate):
    db = SessionLocal()

    # Hash the password before saving (never store plain text)
    new_user = User(
        username=user.username,
        password=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    db.close()

    return {"message": "User created"}


# ---------------------------------------------------------------
# POST /auth/login
# Verifies credentials and returns a JWT token on success.
# ---------------------------------------------------------------
@router.post("/login")
def login(user: UserLogin):
    db = SessionLocal()

    # Look up user by username
    db_user = db.query(User).filter(User.username == user.username).first()

    # Check if user exists and password is correct
    if not db_user or not verify_password(user.password, db_user.password):
        db.close()
        return {"error": "Invalid credentials"}

    # Create and return a token with the user's ID inside
    token = create_token({"user_id": db_user.id})
    db.close()

    return {"token": token}
