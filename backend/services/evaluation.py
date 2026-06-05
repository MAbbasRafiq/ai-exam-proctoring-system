# =============================================================
# services/evaluation.py
# Core logic for evaluating submitted exam answers.
#
# Steps:
#   1. Compare each answer to the correct option in DB
#   2. Count the score
#   3. Save the attempt record
#   4. Save each individual answer
#   5. Return score and correct answers
# =============================================================

from database.db import SessionLocal
from database.models import Option, Attempt, Answer


def submit_answers(answers: dict, user_id: int):
    """
    Evaluates the user's answers and saves everything to the database.

    Args:
        answers : dict like {"1": "Paris", "2": "Newton", ...}
                  Key = question_id (as string), Value = selected option text
        user_id : the ID of the logged-in user

    Returns:
        dict with:
            score           -> number of correct answers
            correct_answers -> dict of question_id -> correct option text
    """
    db = SessionLocal()

    score = 0
    correct_answers = {}  # We'll collect correct answers to send back to frontend

    # ---------------------------------------------------------------
    # Step 1: Loop through each answer and check if it's correct
    # ---------------------------------------------------------------
    for question_id, selected_option in answers.items():
        # Look up the correct option for this question in the database
        correct_option = db.query(Option).filter(
            Option.question_id == int(question_id),  # match the question
            Option.is_correct == True                # only the correct option
        ).first()

        if correct_option:
            # Save the correct answer so we can return it to the user
            correct_answers[question_id] = correct_option.text

            # Check if the user's answer matches the correct option
            if correct_option.text == selected_option:
                score += 1  # Increment score for correct answer

    # ---------------------------------------------------------------
    # Step 2: Create an Attempt record (one per exam submission)
    # ---------------------------------------------------------------
    attempt = Attempt(
        score=score,
        user_id=user_id  # links this attempt to the user
    )
    db.add(attempt)
    db.commit()         # Save attempt first so we get attempt.id
    db.refresh(attempt) # Refresh to load the auto-generated attempt.id

    # ---------------------------------------------------------------
    # Step 3: Save each individual answer
    # ---------------------------------------------------------------
    for question_id, selected_option in answers.items():
        answer = Answer(
            attempt_id=attempt.id,          # link to this attempt
            question_id=int(question_id),   # which question
            selected_option=selected_option  # what the user picked
        )
        db.add(answer)

    db.commit()
    db.close()

    # Return the score and correct answers to the frontend
    return {
        "score": score,
        "correct_answers": correct_answers
    }
