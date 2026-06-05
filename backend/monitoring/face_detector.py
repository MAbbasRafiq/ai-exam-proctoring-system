# =============================================================
# monitoring/face_detector.py
# Uses OpenCV's built-in Haar Cascade to count how many
# faces are visible in a webcam frame.
#
# Possible results:
#   0 faces -> candidate is absent (not sitting in front of camera)
#   1 face  -> normal, expected
#   2+ faces -> suspicious, someone else may be helping
# =============================================================

import cv2

# Load the face detection model from OpenCV's built-in data files.
# Haar Cascade is a fast, traditional (non-AI) face detector.
# We load it once at module level to avoid reloading every frame.
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def count_faces(frame):
    """
    Counts how many faces are visible in the given frame.

    Steps:
    1. Convert frame to grayscale (face detection works on grayscale)
    2. Run the face detector on the grayscale image
    3. Return how many faces were found

    Args:
        frame: a BGR image (standard webcam frame from OpenCV)

    Returns:
        int: number of faces detected (0, 1, 2, ...)
    """
    # Convert the color image to grayscale
    # Grayscale removes color info and makes detection faster
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detect faces in the grayscale image
    # scaleFactor=1.3  -> scales the image by 30% each step when scanning
    # minNeighbors=5   -> each face must have at least 5 neighbor detections
    #                     (reduces false positives)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.3,
        minNeighbors=5
    )

    # Return the total number of faces found
    return len(faces)
