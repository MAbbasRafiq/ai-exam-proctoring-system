# =============================================================
# monitoring/detector.py
# Uses YOLOv8 (an AI object detection model) to detect
# if a mobile phone is visible in the webcam frame.
# =============================================================

from ultralytics import YOLO

# Load the YOLOv8 model once when this file is imported.
# We do this at module level so the model only loads ONE TIME.
# If we loaded it inside the function, it would reload every frame (very slow).
model = YOLO("monitoring/models/yolov8n.pt")


def detect_phone(frame):
    """
    Takes a single video frame (image) and checks if a mobile phone is visible.

    How it works:
    - YOLOv8 scans the entire frame and finds all objects
    - Each detected object has a label (like "person", "cell phone", "laptop")
    - We check if any label is "cell phone"

    Returns:
        True  -> phone was found in the frame
        False -> no phone found
    """
    # Run the AI model on the frame. conf=0.5 means we only accept
    # detections where the model is at least 50% confident.
    results = model(frame, conf=0.5)

    # Assume no phone detected
    phone_found = False

    # Loop through results (usually just 1 result for 1 frame)
    for result in results:
        # Each result has multiple boxes (one per detected object)
        for box in result.boxes:
            # Get the class ID number of this detected object
            class_id = int(box.cls[0])

            # Convert the class ID to a readable label like "cell phone"
            label = model.names[class_id]

            # Check if this detected object is a phone
            if label == "cell phone":
                phone_found = True

    return phone_found
