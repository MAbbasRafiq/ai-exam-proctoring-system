# =============================================================
# database/migrate.py
# Safe-ish migration for existing exam_system DBs.
# Run from backend folder:  python -m database.migrate
# =============================================================

from sqlalchemy import text, inspect
from database.db import engine, Base
import database.models  # noqa: F401 — register models


def column_exists(table: str, column: str) -> bool:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return False
    return any(c["name"] == column for c in insp.get_columns(table))


def main():
    print("Creating any missing tables...")
    Base.metadata.create_all(bind=engine)

    statements = []

    if not column_exists("users", "role"):
        statements.append(
            "ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'student'"
        )

    if not column_exists("questions", "exam_id"):
        statements.append("ALTER TABLE questions ADD COLUMN exam_id INTEGER")

    if not column_exists("attempts", "exam_id"):
        statements.append("ALTER TABLE attempts ADD COLUMN exam_id INTEGER")

    if not column_exists("attempts", "started_at"):
        statements.append("ALTER TABLE attempts ADD COLUMN started_at TIMESTAMP WITH TIME ZONE")

    if not column_exists("attempts", "submitted_at"):
        statements.append(
            "ALTER TABLE attempts ADD COLUMN submitted_at TIMESTAMP WITH TIME ZONE"
        )

    if not column_exists("exams", "starts_at"):
        statements.append(
            "ALTER TABLE exams ADD COLUMN starts_at TIMESTAMP WITH TIME ZONE"
        )

    if not column_exists("exams", "ends_at"):
        statements.append(
            "ALTER TABLE exams ADD COLUMN ends_at TIMESTAMP WITH TIME ZONE"
        )

    if not column_exists("exams", "shuffle_questions"):
        statements.append(
            "ALTER TABLE exams ADD COLUMN shuffle_questions BOOLEAN DEFAULT TRUE"
        )

    if not column_exists("questions", "question_type"):
        statements.append(
            "ALTER TABLE questions ADD COLUMN question_type VARCHAR DEFAULT 'mcq' NOT NULL"
        )

    if not column_exists("questions", "max_points"):
        statements.append("ALTER TABLE questions ADD COLUMN max_points INTEGER")

    if not column_exists("questions", "allow_math_symbols"):
        statements.append(
            "ALTER TABLE questions ADD COLUMN allow_math_symbols BOOLEAN DEFAULT FALSE NOT NULL"
        )

    if not column_exists("exams", "allow_math_symbols"):
        statements.append(
            "ALTER TABLE exams ADD COLUMN allow_math_symbols BOOLEAN DEFAULT FALSE NOT NULL"
        )

    if not column_exists("answers", "points_awarded"):
        statements.append("ALTER TABLE answers ADD COLUMN points_awarded INTEGER")

    if not column_exists("start_approvals", "short_code"):
        statements.append("ALTER TABLE start_approvals ADD COLUMN short_code VARCHAR(4)")

    with engine.connect() as conn:
        for sql in statements:
            print(f"Running: {sql}")
            conn.execute(text(sql))
        conn.commit()

        # Backfill role for existing users
        if column_exists("users", "role"):
            conn.execute(text("UPDATE users SET role = 'student' WHERE role IS NULL"))
            conn.commit()

        # Mark old attempts as submitted if they already have a score
        if column_exists("attempts", "submitted_at"):
            conn.execute(
                text(
                    """
                    UPDATE attempts
                    SET submitted_at = COALESCE(submitted_at, NOW())
                    WHERE score IS NOT NULL AND submitted_at IS NULL
                    """
                )
            )
            conn.commit()

    # Unique constraint for one attempt per user/exam (ignore if exists)
    with engine.connect() as conn:
        try:
            conn.execute(
                text(
                    """
                    ALTER TABLE attempts
                    ADD CONSTRAINT uq_attempt_user_exam UNIQUE (user_id, exam_id)
                    """
                )
            )
            conn.commit()
            print("Added unique constraint uq_attempt_user_exam")
        except Exception as e:
            conn.rollback()
            print(f"Unique constraint skipped (may already exist): {e}")

    print("Migration done.")


if __name__ == "__main__":
    main()
