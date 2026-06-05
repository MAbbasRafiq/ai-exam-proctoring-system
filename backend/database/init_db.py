# =============================================================
# database/init_db.py
# Run this file ONCE to create all tables in PostgreSQL.
# Usage: python init_db.py  (from the backend folder)
# =============================================================

from database.db import engine
from database.models import Base

# We must import models so SQLAlchemy knows which tables to create.
# Even if we don't use them directly, this import registers them.
import database.models

print("Creating all database tables...")
Base.metadata.create_all(bind=engine)
print("Done! All tables created.")
