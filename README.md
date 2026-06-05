# Combined Online Exam System with AI Monitoring

This project combines two systems:
1. **Online Exam System** — React frontend + FastAPI backend with PostgreSQL
2. **AI Exam Monitoring** — YOLOv8 phone detection + OpenCV face detection

---

## How It Works (Simple Overview)

```
Student opens browser
    -> Logs in / Registers
    -> Exam page loads questions
    -> Webcam starts automatically
    -> Every 3 seconds: a frame is sent to backend
    -> Backend AI checks for: phone / multiple faces / absent
    -> Violations are saved to database + shown as alerts
    -> Student submits exam -> score is shown
```

---

## Project Folder Structure

```
combined-exam-system/
│
├── backend/                        # FastAPI Python server
│   ├── main.py                     # Server entry point — registers all routes
│   ├── requirements.txt            # All Python packages needed
│   │
│   ├── auth/                       # Login and token system
│   │   ├── auth.py                 # Creates JWT tokens
│   │   ├── dependencies.py         # Verifies tokens in protected routes
│   │   └── utils.py                # Password hashing (bcrypt)
│   │
│   ├── database/                   # PostgreSQL connection and tables
│   │   ├── db.py                   # Database URL and connection setup
│   │   ├── models.py               # Table definitions (User, Question, Violation, etc.)
│   │   └── init_db.py              # Run once to create all tables
│   │
│   ├── routes/                     # API endpoints
│   │   ├── auth.py                 # POST /auth/register, POST /auth/login
│   │   ├── questions.py            # GET /questions/
│   │   ├── submit.py               # POST /submit/
│   │   ├── monitoring.py           # POST /monitoring/report, GET /monitoring/list
│   │   └── analyze.py              # POST /monitoring/analyze  <-- NEW: AI frame analysis
│   │
│   ├── schemas/                    # Request/response data shapes
│   │   ├── user.py                 # UserCreate, UserLogin
│   │   └── exam.py                 # SubmitRequest
│   │
│   ├── services/
│   │   └── evaluation.py           # Exam grading logic
│   │
│   └── monitoring/                 # AI detection modules (from AI project)
│       ├── detector.py             # YOLOv8 phone detection
│       ├── face_detector.py        # OpenCV face counting
│       ├── violation_logger.py     # Saves violations to DB + CSV + screenshot
│       ├── models/
│       │   └── yolov8n.pt          # YOLOv8 neural network weights file
│       ├── logs/
│       │   └── violations.csv      # CSV backup of all violations
│       └── screenshots/            # Saved violation screenshots
│
└── frontend/                       # React + Vite + Tailwind CSS
    ├── .env                        # VITE_API_URL=http://127.0.0.1:8000
    ├── index.html                  # HTML entry point
    ├── package.json                # npm dependencies
    ├── vite.config.js              # Vite build config
    └── src/
        ├── main.jsx                # React app entry point
        ├── App.jsx                 # Page routing setup
        ├── index.css               # Base CSS
        │
        ├── api/
        │   └── examApi.js          # All fetch() calls to backend
        │
        ├── pages/
        │   ├── Login.jsx           # Login form
        │   ├── Register.jsx        # Registration form
        │   └── Exam.jsx            # Main exam page with webcam monitoring
        │
        └── components/
            ├── QuestionCard.jsx    # Renders one question with options
            ├── Result.jsx          # Shows score after submission
            └── MonitoringPanel.jsx # Shows live alerts and violation log
```

---

## Setup Instructions

### Step 1 — Install PostgreSQL and create the database

```bash
# Open PostgreSQL shell
psql -U postgres

# Create the database
CREATE DATABASE exam_system;

# Exit
\q
```

### Step 2 — Set up the Backend

```bash
# Go into the backend folder
cd combined-exam-system/backend

# Install all Python packages
pip install -r requirements.txt

# Open database/db.py and update this line with YOUR PostgreSQL password:
# DATABASE_URL = "postgresql://postgres:yourpassword@localhost/exam_system"

# Create the database tables (run only once)
python database/init_db.py

# Start the backend server
uvicorn main:app --reload
```

The backend will be running at: http://127.0.0.1:8000

### Step 3 — Set up the Frontend

```bash
# Go into the frontend folder
cd combined-exam-system/frontend

# Install npm packages
npm install

# Start the React dev server
npm run dev
```

The frontend will be at: http://localhost:5173

---

## Adding Exam Questions to the Database

The backend has no default questions. You need to add them manually via SQL.

```sql
-- Connect to the database
psql -U postgres -d exam_system

-- Add a question
INSERT INTO questions (question) VALUES ('What is the capital of France?');

-- Add options for that question (question_id = 1, is_correct: 1=yes, 0=no)
INSERT INTO options (question_id, text, is_correct) VALUES (1, 'Paris', 1);
INSERT INTO options (question_id, text, is_correct) VALUES (1, 'London', 0);
INSERT INTO options (question_id, text, is_correct) VALUES (1, 'Berlin', 0);
INSERT INTO options (question_id, text, is_correct) VALUES (1, 'Rome', 0);

-- Add another question
INSERT INTO questions (question) VALUES ('Who discovered gravity?');
INSERT INTO options (question_id, text, is_correct) VALUES (2, 'Isaac Newton', 1);
INSERT INTO options (question_id, text, is_correct) VALUES (2, 'Albert Einstein', 0);
INSERT INTO options (question_id, text, is_correct) VALUES (2, 'Galileo', 0);
INSERT INTO options (question_id, text, is_correct) VALUES (2, 'Charles Darwin', 0);
```

---

## API Endpoints Reference

| Method | URL | Description | Auth Required |
|--------|-----|-------------|---------------|
| GET | / | Health check | No |
| POST | /auth/register | Create new user | No |
| POST | /auth/login | Login, get token | No |
| GET | /questions/ | Get all questions | No |
| POST | /submit/ | Submit exam answers | Yes |
| POST | /monitoring/analyze | Analyze webcam frame | Yes |
| POST | /monitoring/report | Report a violation | Yes |
| GET | /monitoring/list | Get violations for user | Yes |

---

## AI Monitoring — What Gets Detected

| Violation | How Detected | Severity |
|-----------|-------------|----------|
| Mobile Phone Detected | YOLOv8 object detection (yolov8n.pt) | High |
| Multiple Faces Detected | OpenCV Haar Cascade face detection | High |
| Candidate Absent | OpenCV Haar Cascade (0 faces found) | Medium |

### How the Detection Works (Simple)

1. Frontend captures a webcam frame every 3 seconds
2. Frame is converted to base64 (a text representation of the image)
3. Sent to `POST /monitoring/analyze`
4. Backend decodes the image
5. YOLOv8 scans for phones, OpenCV counts faces
6. If 2+ consecutive checks find the same issue → it's logged as a violation
7. Violation saved to PostgreSQL + CSV file + screenshot saved to disk
8. Backend returns a list of violations found
9. Frontend shows alert in the MonitoringPanel

---

## Troubleshooting

**Camera not working in browser?**
- Make sure you open the site via `http://localhost:5173` (not a file path)
- Browser requires HTTPS or localhost for camera access
- Check browser permissions — camera must be allowed

**Backend not connecting to database?**
- Check the password in `backend/database/db.py`
- Make sure PostgreSQL is running: `pg_ctl status` or `sudo service postgresql status`
- Make sure the `exam_system` database exists: `psql -U postgres -l`

**YOLOv8 model not found?**
- The file `backend/monitoring/models/yolov8n.pt` must exist
- If missing, download it: `python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"`

**Frontend shows blank page?**
- Check that `frontend/.env` has `VITE_API_URL=http://127.0.0.1:8000`
- Make sure the backend is running first
- Open browser console (F12) for error messages
