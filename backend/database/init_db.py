# =============================================================
# database/init_db.py
# Creates tables. For existing DBs also run: python -m database.migrate
# =============================================================

from database.db import engine, Base
import database.models  # noqa: F401


def init():
    print("Creating all database tables...")
    Base.metadata.create_all(bind=engine)
    print("Done! All tables created.")


if __name__ == "__main__":
    init()

# When imported from main.py, create missing tables quietly
init()
