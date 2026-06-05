# =============================================================
# schemas/user.py
# Pydantic schemas for user-related requests.
# Pydantic automatically validates that incoming data
# has the correct types and fields.
# =============================================================

from pydantic import BaseModel


# Used for POST /auth/register
class UserCreate(BaseModel):
    username: str  # must be a string
    password: str  # must be a string


# Used for POST /auth/login
class UserLogin(BaseModel):
    username: str
    password: str
