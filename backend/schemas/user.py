from pydantic import BaseModel, field_validator


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "student"

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v or len(v) < 4:
            raise ValueError("Password must be at least 4 characters")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        v = (v or "student").lower().strip()
        if v not in ("student", "teacher"):
            raise ValueError("role must be 'student' or 'teacher'")
        return v


class UserLogin(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Username is required")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Password is required")
        return v
