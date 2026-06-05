# =============================================================
# auth/auth.py
# Handles creating JWT (JSON Web Tokens) for logged-in users.
# A token is like a digital key — the user carries it to prove
# they are logged in.
# =============================================================

from jose import jwt
from datetime import datetime, timedelta

# Secret key used to sign the token. Change this in production!
SECRET_KEY = "your-secret-key"

# Algorithm used to encode/decode the token
ALGORITHM = "HS256"


def create_token(data: dict):
    """
    Creates a JWT token that expires in 3 hours.

    Steps:
    1. Copy the data (like user_id) into a new dict
    2. Add an expiry time to that dict
    3. Encode it all into a token string
    """
    # Make a copy so we don't modify the original dict
    to_encode = data.copy()

    # Set the expiry time to 3 hours from now
    expire = datetime.utcnow() + timedelta(hours=3)
    to_encode.update({"exp": expire})

    # Encode and return the token
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
