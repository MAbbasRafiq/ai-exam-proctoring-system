# =============================================================
# database/models.py
# This file defines all the database tables using SQLAlchemy.
# Each class = one table in PostgreSQL.
# =============================================================

from sqlalchemy import Column, Integer, String, ForeignKey
from database.db import Base


# ---------------------------------------------------------------
# Table: users
# Stores registered exam candidates (students)
# ---------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)  # auto ID
    username = Column(String, unique=True)              # must be unique
    password = Column(String)                           # stored as bcrypt hash


# ---------------------------------------------------------------
# Table: questions
# Stores exam questions (text only, options are separate)
# ---------------------------------------------------------------
class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String)  # the question text


# ---------------------------------------------------------------
# Table: options
# Stores answer choices for each question.
# Each question has multiple options; only 1 is correct.
# ---------------------------------------------------------------
class Option(Base):
    __tablename__ = "options"

    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey("questions.id"))  # which question this option belongs to
    text = Column(String)       # the option text
    is_correct = Column(Integer)  # 1 = correct answer, 0 = wrong answer


# ---------------------------------------------------------------
# Table: attempts
# Every time a user submits an exam, an Attempt record is created.
# ---------------------------------------------------------------
class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(Integer, primary_key=True, index=True)
    score = Column(Integer)                             # number of correct answers
    user_id = Column(Integer, ForeignKey("users.id"))  # which user took the exam


# ---------------------------------------------------------------
# Table: answers
# Stores each individual answer the user gave for an attempt.
# ---------------------------------------------------------------
class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"))  # which exam session
    question_id = Column(Integer)                            # which question
    selected_option = Column(String)                         # what the user picked


# ---------------------------------------------------------------
# Table: violations
# Stores AI-detected violations during the exam.
# This is the NEW table added from the AI monitoring system.
# ---------------------------------------------------------------
class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))  # which user was flagged
    session_id = Column(String)                        # exam session identifier
    violation_type = Column(String)                    # e.g. "Mobile Phone Detected"
    severity = Column(String)                          # "High", "Medium", or "Low"
    timestamp = Column(String)                         # when it happened (as string)
    screenshot_path = Column(String, nullable=True)    # path to saved screenshot image
