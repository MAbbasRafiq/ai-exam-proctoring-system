# =============================================================
# auth/dependencies.py
# Used to verify a user's token in protected routes.
# When someone submits the exam, we check their token here
# to find out who they are.
# =============================================================

from fastapi import HTTPException
from jose import jwt
from database.db import SessionLocal
from database.models import User

# Must match the values in auth.py
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"


def get_current_user(token: str):
    """
    Takes a token string, decodes it, and returns the User object.

    Raises 401 error if the token is invalid or expired.
    """
    try:
        # Decode the token to get the payload (e.g. {"user_id": 5})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Extract the user_id from the decoded payload
        user_id = payload.get("user_id")

    except Exception:
        # If decoding fails (bad token, expired, etc.), reject the request
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Open a database session to look up the user
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    db.close()

    return user
