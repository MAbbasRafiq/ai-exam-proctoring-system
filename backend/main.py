# =============================================================
# main.py
# FastAPI entry point. For LAN quiz:
#   uvicorn main:app --host 0.0.0.0 --port 8000
# =============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from routes import questions, submit, auth, monitoring, analyze, exams

# Ensure models are registered / tables exist on startup
from database.init_db import *  # noqa: F401,F403

app = FastAPI(title="Online Exam System with AI Monitoring")

# LAN demo: CORS_ORIGINS=["*"] allows any student device origin.
# When allow_origins is ["*"], credentials must be False per browser rules.
allow_credentials = CORS_ORIGINS != ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Exam system backend is running"}


app.include_router(auth.router, prefix="/auth")
app.include_router(questions.router, prefix="/questions")
app.include_router(submit.router, prefix="/submit")
app.include_router(monitoring.router, prefix="/monitoring")
app.include_router(analyze.router, prefix="/monitoring")
app.include_router(exams.router, prefix="/exams")
