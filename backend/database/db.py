
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ---------------------------------------------------------------
# DATABASE_URL format:
#   postgresql://USERNAME:PASSWORD@HOST/DATABASE_NAME
# Change this to match your local PostgreSQL setup.
# ---------------------------------------------------------------
DATABASE_URL = "postgresql://postgres:YourPassword@localhost/exam_system"

# Create the database engine (the actual connection handler)
engine = create_engine(DATABASE_URL)

# SessionLocal is used to open/close database sessions in routes
SessionLocal = sessionmaker(bind=engine)

# Base is the parent class for all our database models/tables
Base = declarative_base()
