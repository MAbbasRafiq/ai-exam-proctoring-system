# =============================================================
# main.py
# The entry point for the FastAPI backend server.
# Run this with: uvicorn main:app --reload
#
# This file:
#   1. Creates the FastAPI app
#   2. Configures CORS (so the React frontend can talk to it)
#   3. Registers all route groups (auth, questions, submit, monitoring)
# =============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import all route modules
from routes import questions, submit, auth, monitoring, analyze

# Import this so it runs the init_db when server starts
from database.init_db import *

# Create the FastAPI application
app = FastAPI(title="Online Exam System with AI Monitoring")

# ---------------------------------------------------------------
# CORS Configuration
# CORS allows the frontend (running on a different port) to make
# requests to this backend. Without this, browsers block requests.
# ---------------------------------------------------------------
origins = [
    "http://localhost:5173",  # Vite dev server (React frontend)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # which frontend URLs are allowed
    allow_credentials=True,       # allow cookies / auth headers
    allow_methods=["*"],          # allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],          # allow all headers (including Authorization)
)


# ---------------------------------------------------------------
# Health check route
# Visit http://localhost:8000/ to confirm the server is running
# ---------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Exam system backend is running"}


# ---------------------------------------------------------------
# Register all route groups with their URL prefixes
# ---------------------------------------------------------------

# Auth routes: /auth/register, /auth/login
app.include_router(auth.router, prefix="/auth")

# Question routes: /questions/
app.include_router(questions.router, prefix="/questions")

# Submit routes: /submit/
app.include_router(submit.router, prefix="/submit")

# Monitoring routes (NEW): /monitoring/report, /monitoring/list
app.include_router(monitoring.router, prefix="/monitoring")

# Analyze route (NEW): /monitoring/analyze — receives webcam frame, runs AI detection
app.include_router(analyze.router, prefix="/monitoring")
