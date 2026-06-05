# =============================================================
# auth/utils.py
# Helper functions for password hashing and verification.
# We never store plain text passwords — always hashed.
# =============================================================

from passlib.context import CryptContext

# Setup bcrypt as the hashing algorithm
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str):
    """
    Converts a plain text password into a secure bcrypt hash.
    Example: "mypassword123" -> "$2b$12$..."
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    """
    Checks if a plain text password matches a stored hash.
    Returns True if they match, False if not.
    Used during login.
    """
    return pwd_context.verify(plain_password, hashed_password)
