# Combined Online Exam System with AI Monitoring

This project combines two systems:
1. **Online Exam System** — React frontend + FastAPI backend with PostgreSQL
2. **AI Exam Monitoring** — YOLOv8 phone detection + OpenCV face detection

**Class quiz mode (LAN):** Teacher creates an exam + join code; students on the same network open the app on the teacher's laptop IP, join with the code, and submit once. Flags in `frontend/.env`: `VITE_AI_MONITORING_ENABLED` (YOLO analyze), `VITE_WEBCAM_ENABLED` (camera preview). Defaults: AI off, webcam on. Restart Vite after changing flags.

---

## How It Works (Simple Overview)

```
Teacher registers (role=teacher) -> /teacher
    -> Create exam -> Add MCQs -> Publish -> share join code

Student registers/logs in -> enters join code
    -> Starts exam (server timer, one attempt)
    -> Optional webcam AI monitoring (demo)
    -> Submit -> score; teacher sees results / CSV
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
cd backend

# Activate venv if you use one, then:
pip install -r requirements.txt

# Copy env and set your Postgres password
copy .env.example .env
# Edit DATABASE_URL in .env

# Create / migrate tables
python database/init_db.py
python -m database.migrate

# LAN class day (multi-worker recommended for ~100 students):
.\run_lan.ps1 -Workers 4

# AI monitoring demo with a few students: use -Workers 1
```

See **[LAN_CHECKLIST.md](LAN_CHECKLIST.md)** for firewall / IP / dry-run steps.

Local-only: `http://127.0.0.1:8000` · LAN: `http://<YOUR-LAPTOP-IP>:8000`

### Step 3 — Set up the Frontend

```bash
cd frontend
npm install

# For LAN: set VITE_API_URL to your laptop IP (same as backend)
# Example: VITE_API_URL=http://192.168.1.10:8000
copy .env.example .env

npm run dev
```

Vite is configured with `host: true`. Students open `http://<YOUR-LAPTOP-IP>:5173`.

### LAN checklist (first quiz on your laptop)

1. Connect teacher laptop + students to the same network (ethernet preferred).
2. Find laptop IP (`ipconfig` → IPv4).
3. Set `frontend/.env` → `VITE_API_URL=http://<IP>:8000` and restart `npm run dev`.
4. Allow Windows Firewall for ports **8000** and **5173**.
5. Start backend: `uvicorn main:app --host 0.0.0.0 --port 8000`
6. Teacher account → `/teacher` → create exam → add questions → **Publish** → share **join code**.
7. Students register as Student → enter join code → take exam (one attempt).
8. For a large class, keep AI monitoring as demo-only (it loads the laptop heavily).

---

## Adding Exam Questions

Prefer the **Teacher Dashboard** (no SQL). Legacy SQL inserts still work for questions with `exam_id = NULL` (old demo bank).
---

## API Endpoints Reference

| Method | URL | Description | Auth Required |
|--------|-----|-------------|---------------|
| GET | / | Health check | No |
| POST | /auth/register | Create student (teacher only if `ALLOW_TEACHER_REGISTER=true`) | No |
| POST | /auth/login | Login → token + role | No |
| POST | /exams/ | Create exam (teacher) | Yes |
| GET | /exams/mine | List my exams (teacher) | Yes |
| GET | /exams/join/{code} | Resolve join code | Yes |
| POST | /exams/{id}/questions | Add MCQ (teacher) | Yes |
| DELETE | /exams/{id} | Delete exam (teacher) | Yes |
| POST | /exams/{id}/publish | Publish exam | Yes |
| GET | /exams/{id}/questions | Get exam questions | Yes |
| POST | /exams/{id}/start | Start attempt + server timer | Yes |
| GET | /exams/{id}/results | Results table (teacher) | Yes |
| GET | /exams/{id}/results.csv | Export CSV (teacher) | Yes |
| POST | /submit/ | Submit answers (`exam_id` + answers) | Yes |
| GET | /questions/ | Legacy unassigned questions | Yes |
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
