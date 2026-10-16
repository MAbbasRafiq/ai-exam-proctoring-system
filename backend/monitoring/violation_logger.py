# =============================================================
# monitoring/violation_logger.py
# When the AI detects a violation (phone, multiple faces, absent),
# this module:
#   1. Saves the violation to PostgreSQL database
#   2. Also writes it to a CSV file as backup
#   3. Saves a screenshot of the violation moment
# =============================================================

import os
import cv2
import pandas as pd
from datetime import datetime
from database.db import SessionLocal
from database.models import Violation

# Folder where screenshot images will be saved
SCREENSHOT_DIR = "monitoring/screenshots"

# CSV file path (backup log, easy to open in Excel)
CSV_LOG_FILE = "monitoring/logs/violations.csv"

# Make sure the folders exist (create them if not)
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
os.makedirs("monitoring/logs", exist_ok=True)


def log_violation(violation_type: str, user_id: int, session_id: str, frame=None):
    """
    Records a violation in the database and CSV, and saves a screenshot.

    Args:
        violation_type : What happened, e.g. "Mobile Phone Detected"
        user_id        : The database ID of the user being monitored
        session_id     : A unique string for this exam session (e.g. "SESSION_20250503_120000")
        frame          : The webcam image at the time of violation (optional)
    """

    # ---------------------------------------------------------------
    # Step 1: Determine severity based on violation type
    # ---------------------------------------------------------------
    if violation_type in ["Mobile Phone Detected", "Multiple Faces Detected"]:
        severity = "High"    # These are serious cheating indicators
    elif violation_type == "Candidate Absent":
        severity = "Medium"  # Could be accidental (looking away, bathroom break)
    else:
        severity = "Low"     # Any other minor violations

    # Get the current date and time as a readable string
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ---------------------------------------------------------------
    # Step 2: Save screenshot if a frame was provided
    # ---------------------------------------------------------------
    screenshot_path = None  # Default: no screenshot

    if frame is not None:
        # Create a safe filename by replacing : and spaces with - and _
        safe_time = timestamp.replace(":", "-").replace(" ", "_")
        filename = f"{session_id}_{violation_type}_{safe_time}.jpg"
        screenshot_path = os.path.join(SCREENSHOT_DIR, filename)

        # Save the image to disk
        cv2.imwrite(screenshot_path, frame)

    # ---------------------------------------------------------------
    # Step 3: Save to PostgreSQL database
    # ---------------------------------------------------------------
    db = SessionLocal()

    # Create a new Violation record
    new_violation = Violation(
        user_id=user_id,
        session_id=session_id,
        violation_type=violation_type,
        severity=severity,
        timestamp=timestamp,
        screenshot_path=screenshot_path
    )

    db.add(new_violation)
    db.commit()
    db.close()

    # ---------------------------------------------------------------
    # Step 4: Also write to CSV (backup / easy to view in Excel)
    # ---------------------------------------------------------------
    row_data = [[user_id, session_id, violation_type, severity, timestamp, screenshot_path or ""]]

    df = pd.DataFrame(
        row_data,
        columns=["UserID", "SessionID", "Violation", "Severity", "Time", "Screenshot"]
    )

    if os.path.exists(CSV_LOG_FILE):
        # Append to existing CSV (don't write header again)
        df.to_csv(CSV_LOG_FILE, mode='a', header=False, index=False)
    else:
        # Create new CSV with header
        df.to_csv(CSV_LOG_FILE, index=False)
