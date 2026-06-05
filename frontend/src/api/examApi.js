// =============================================================
// src/api/examApi.js
// All API calls to the backend are written here.
// This keeps fetch() calls organized and out of the components.
// =============================================================

// Base URL comes from the .env file (VITE_API_URL=http://127.0.0.1:8000)
const BASE_URL = import.meta.env.VITE_API_URL;


// ---------------------------------------------------------------
// fetchQuestions
// Gets all exam questions from the backend (no auth needed)
// Returns: array of { id, question, options[] }
// ---------------------------------------------------------------
export async function fetchQuestions() {
  const res = await fetch(`${BASE_URL}/questions/`);
  return res.json();
}


// ---------------------------------------------------------------
// submitExam
// Sends the user's answers to the backend for grading.
// Requires a valid token stored in localStorage.
// Returns: { score, correct_answers }
// ---------------------------------------------------------------
export async function submitExam(answers) {
  // Get the token that was saved during login
  const token = localStorage.getItem("token");

  const res = await fetch(`${BASE_URL}/submit/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`  // send token in header
    },
    body: JSON.stringify({ answers })  // send answers in body
  });

  // If the token is expired or invalid, log out the user
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    return null;
  }

  return res.json();
}


// ---------------------------------------------------------------
// reportViolation
// Sends a violation report to the backend monitoring endpoint.
// Called when the AI detects a problem (phone, multiple faces, etc.)
//
// Args:
//   sessionId     - the current exam session ID string
//   violationType - e.g. "Mobile Phone Detected"
// ---------------------------------------------------------------
export async function reportViolation(sessionId, violationType) {
  // Get token for authentication
  const token = localStorage.getItem("token");

  if (!token) {
    // If not logged in, don't try to report
    return;
  }

  try {
    await fetch(`${BASE_URL}/monitoring/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        session_id: sessionId,
        violation_type: violationType
      })
    });
  } catch (err) {
    // If reporting fails, just log it — don't crash the exam
    console.error("Failed to report violation:", err);
  }
}


// ---------------------------------------------------------------
// fetchViolations
// Gets all violations for the current user from the backend.
// Used to show the violations panel during/after the exam.
// ---------------------------------------------------------------
export async function fetchViolations() {
  const token = localStorage.getItem("token");

  if (!token) return [];

  try {
    const res = await fetch(`${BASE_URL}/monitoring/list`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    return res.json();
  } catch (err) {
    console.error("Failed to fetch violations:", err);
    return [];
  }
}
