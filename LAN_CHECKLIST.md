# LAN class quiz checklist (laptop host)

## Before class day
- [ ] Postgres running; `python -m database.migrate` done
- [ ] Strong `SECRET_KEY` in `backend/.env` (not the default)
- [ ] `ALLOW_TEACHER_REGISTER=false` — create teacher account yourself (SQL or brief flag=true)
- [ ] Teacher account created (role = Teacher)
- [ ] Exam created, MCQs added, settings saved (duration / window / shuffle)
- [ ] Exam **Published**; join code written on board
- [ ] Dry-run with 5–10 devices on same network

## Class day — teacher laptop
1. Plug in power; disable sleep / lid sleep
2. Prefer ethernet (or strong Wi‑Fi AP)
3. Get IPv4: `ipconfig` → e.g. `192.168.1.10`
4. Set `frontend/.env`:
   ```
   VITE_API_URL=http://192.168.1.10:8000
   ```
5. Allow Windows Firewall inbound for **TCP 8000** and **5173**
6. Start backend (multi-worker for class quiz):
   ```powershell
   cd backend
   .\run_lan.ps1 -Workers 4
   ```
   If AI monitoring demo is ON for a few students, use `-Workers 1`
7. Start frontend:
   ```powershell
   cd frontend
   npm run dev
   ```
8. Students open: `http://192.168.1.10:5173`

## Student flow
1. Register / login as **Student**
2. Enter join code → Start exam → Submit once
3. If already submitted, score screen shows (no retake)

## Notes
- Default: **camera-only** deterrence — `VITE_AI_MONITORING_ENABLED=false`, `VITE_WEBCAM_ENABLED=true`. Webcam shows; YOLO is not called. Set `VITE_WEBCAM_ENABLED=false` to hide camera entirely.
- Mixed exams: set `SHORT_QUESTIONS_ENABLED=true` (backend) and `VITE_SHORT_QUESTIONS_ENABLED=true` (frontend), then `python -m database.migrate`. MCQ auto-grade; short answers graded via **Grade** in results.
- **Teacher start approval (recommended for phone):** set `CODE_START_APPROVAL_ENABLED=true` (backend) and `VITE_CODE_START_APPROVAL_ENABLED=true` (frontend), restart both. Student taps Start → **4-digit code** → teacher dashboard **Enter code** → Approve → exam starts. No camera/HTTPS needed. Resume skips approval.
- **Optional QR:** set `QR_START_APPROVAL_ENABLED=true` + `VITE_QR_START_APPROVAL_ENABLED=true`. Dashboard **Scan QR** (camera may be blocked on HTTP LAN phones — use Lens or paste). Can run together with code approval.
- To turn real AI back on (few students): set `VITE_AI_MONITORING_ENABLED=true` (+ webcam true), restart `npm run dev`, use backend `-Workers 1`
- Tab leave events appear as **Tab logs** in teacher results / CSV
- Shuffle is per-student when enabled on the exam
