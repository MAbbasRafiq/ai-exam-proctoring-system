# =============================================================
# auth/auth.py
# JWT creation for logged-in users.
# =============================================================

from datetime import datetime, timedelta
from jose import jwt
from config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_HOURS


def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
