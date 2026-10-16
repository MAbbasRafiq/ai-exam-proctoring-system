# =============================================================
# config.py
# Shared settings loaded from environment / .env
# =============================================================

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

# Public /auth/register may only create students unless this is true.
# Create teacher accounts manually (or set true briefly, then turn off).
ALLOW_TEACHER_REGISTER = (
    os.getenv("ALLOW_TEACHER_REGISTER", "false").strip().lower() == "true"
)

# When false, only MCQ questions can be created (legacy class mode).
SHORT_QUESTIONS_ENABLED = (
    os.getenv("SHORT_QUESTIONS_ENABLED", "false").strip().lower() == "true"
)

# When true, student must get a teacher QR scan approval before first /start.
QR_START_APPROVAL_ENABLED = (
    os.getenv("QR_START_APPROVAL_ENABLED", "false").strip().lower() == "true"
)

# When true, student gets a 4-digit code; teacher types it in dashboard to approve.
CODE_START_APPROVAL_ENABLED = (
    os.getenv("CODE_START_APPROVAL_ENABLED", "false").strip().lower() == "true"
)

# Either QR or code approval gates the first /start.
START_APPROVAL_REQUIRED = QR_START_APPROVAL_ENABLED or CODE_START_APPROVAL_ENABLED

# "*" = allow any origin (handy for LAN demo on many student devices)
_raw_cors = os.getenv("CORS_ORIGINS", "*").strip()
if _raw_cors == "*":
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [o.strip() for o in _raw_cors.split(",") if o.strip()]
