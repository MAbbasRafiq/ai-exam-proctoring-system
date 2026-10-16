# =============================================================
# routes/analyze.py
# NEW ENDPOINT: Receives a webcam frame from the browser (as
# a base64 image), runs AI detection on it, and returns which
# violations were found.
#
# The frontend sends a frame every 3 seconds.
# This route:
#   1. Decodes the base64 image
#   2. Runs phone detection (YOLOv8)
#   3. Runs face detection (OpenCV Haar Cascade)
#   4. Checks for violations and logs them
#   5. Returns a list of violation names found
# =============================================================

import base64
import numpy as np
import cv2
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from auth.dependencies import get_current_user
from monitoring.detector import detect_phone
from monitoring.face_detector import count_faces
from monitoring.violation_logger import log_violation

router = APIRouter()

# How many consecutive checks must detect the same issue
# before it counts as a real violation (reduces false positives)
FRAMES_BEFORE_VIOLATION = 2

# In-memory counters per user session.
# Format: { session_id: { "phone": 0, "absent": 0, "multi_face": 0 } }
# These reset when the server restarts (that's fine for our use case).
frame_counters = {}

# Tracks whether we already logged a violation for the current run
# to avoid logging the same violation over and over
logged_state = {}


# ---------------------------------------------------------------
# Schema: AnalyzeRequest
# What the frontend must send:
#   session_id - the unique exam session ID
#   image      - the webcam frame as a base64-encoded JPEG string
# ---------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    session_id: str
    image: str  # base64 data URL: "data:image/jpeg;base64,/9j/4AAQ..."


# ---------------------------------------------------------------
# POST /monitoring/analyze
# Receives a webcam frame and runs AI detection on it.
# ---------------------------------------------------------------
@router.post("/analyze")
def analyze_frame(data: AnalyzeRequest, authorization: str = Header(...)):
    # Verify the user's token
    token = authorization.split(" ")[1]
    user = get_current_user(token)

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    # -------------------------------------------------------
    # Step 1: Decode the base64 image into a numpy array
    # (OpenCV and YOLO both work with numpy arrays)
    # -------------------------------------------------------

    # Remove the "data:image/jpeg;base64," prefix if it exists
    image_str = data.image
    if "," in image_str:
        image_str = image_str.split(",")[1]

    # Decode base64 string to raw bytes
    image_bytes = base64.b64decode(image_str)

    # Convert bytes to numpy array
    np_array = np.frombuffer(image_bytes, dtype=np.uint8)

    # Decode numpy array into an OpenCV image (BGR format)
    frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

    if frame is None:
        # Image decoding failed
        return {"violations": []}

    # -------------------------------------------------------
    # Step 2: Run AI detections on the frame
    # -------------------------------------------------------
    phone_found = detect_phone(frame)    # True/False
    face_count = count_faces(frame)      # 0, 1, 2, ...

    # -------------------------------------------------------
    # Step 3: Initialize counters for this session if needed
    # -------------------------------------------------------
    session_id = data.session_id

    if session_id not in frame_counters:
        frame_counters[session_id] = {
            "phone": 0,
            "absent": 0,
            "multi_face": 0
        }
        logged_state[session_id] = {
            "phone": False,
            "absent": False,
            "multi_face": False
        }

    counters = frame_counters[session_id]
    logged = logged_state[session_id]

    # -------------------------------------------------------
    # Step 4: Update counters and detect violations
    # -------------------------------------------------------
    violations_found = []  # list of violation names to return to frontend

    # ---- Check for phone ----
    if phone_found:
        counters["phone"] += 1
    else:
        counters["phone"] = 0
        logged["phone"] = False  # reset: phone is gone, allow logging again next time

    if counters["phone"] >= FRAMES_BEFORE_VIOLATION and not logged["phone"]:
        # Phone has been seen for enough consecutive frames — it's real
        log_violation("Mobile Phone Detected", user.id, session_id, frame)
        violations_found.append("Mobile Phone Detected")
        logged["phone"] = True  # don't log again until it disappears and comes back

    # ---- Check for multiple faces ----
    if face_count > 1:
        counters["multi_face"] += 1
    else:
        counters["multi_face"] = 0
        logged["multi_face"] = False

    if counters["multi_face"] >= FRAMES_BEFORE_VIOLATION and not logged["multi_face"]:
        log_violation("Multiple Faces Detected", user.id, session_id, frame)
        violations_found.append("Multiple Faces Detected")
        logged["multi_face"] = True

    # ---- Check for absent candidate ----
    if face_count == 0:
        counters["absent"] += 1
    else:
        counters["absent"] = 0
        logged["absent"] = False

    if counters["absent"] >= FRAMES_BEFORE_VIOLATION and not logged["absent"]:
        log_violation("Candidate Absent", user.id, session_id, frame)
        violations_found.append("Candidate Absent")
        logged["absent"] = True

    # -------------------------------------------------------
    # Step 5: Return the list of violations found (if any)
    # -------------------------------------------------------
    return {"violations": violations_found}
