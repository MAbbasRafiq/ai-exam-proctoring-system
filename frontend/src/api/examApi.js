// =============================================================
// src/api/examApi.js
// All backend fetch helpers.
// =============================================================

const BASE_URL = import.meta.env.VITE_API_URL;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function handleUnauthorized(res) {
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "/login";
    return true;
  }
  return false;
}

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  const detail = err.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  return "Request failed";
}

export async function loginRequest(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return res.json().then((data) => ({ ok: res.ok, status: res.status, data }));
}

export async function registerRequest(username, password, role) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  });
  return res.json().then((data) => ({ ok: res.ok, status: res.status, data }));
}

export async function fetchQuestions() {
  const res = await fetch(`${BASE_URL}/questions/`, {
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return [];
  return res.json();
}

export async function fetchExamQuestions(examId) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/questions`, {
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function startExamSession(examId, approvalToken = null) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/start`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(
      approvalToken ? { approval_token: approvalToken } : {}
    ),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createStartApproval(examId) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/start-approval`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function pollStartApprovalStatus(token) {
  const res = await fetch(
    `${BASE_URL}/exams/start-approval/${encodeURIComponent(token)}/status`,
    { headers: authHeaders() }
  );
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchStartApprovalDetail(token) {
  const res = await fetch(
    `${BASE_URL}/exams/start-approval/${encodeURIComponent(token)}`,
    { headers: authHeaders() }
  );
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function approveStartApproval(token) {
  const res = await fetch(
    `${BASE_URL}/exams/start-approval/${encodeURIComponent(token)}/approve`,
    { method: "POST", headers: authHeaders() }
  );
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function approveStartByCode(code) {
  const res = await fetch(`${BASE_URL}/exams/start-approval/approve-by-code`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ code: String(code).trim() }),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function submitExam(answers, examId) {
  const res = await fetch(`${BASE_URL}/submit/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ answers, exam_id: examId }),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function joinExamByCode(code) {
  const res = await fetch(`${BASE_URL}/exams/join/${encodeURIComponent(code)}`, {
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createExam(payload) {
  const res = await fetch(`${BASE_URL}/exams/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function updateExam(examId, payload) {
  const res = await fetch(`${BASE_URL}/exams/${examId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function listMyExams() {
  const res = await fetch(`${BASE_URL}/exams/mine`, { headers: authHeaders() });
  if (handleUnauthorized(res)) return [];
  return res.json();
}

export async function publishExam(examId) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/publish`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function unpublishExam(examId) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/unpublish`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteExam(examId) {
  const res = await fetch(`${BASE_URL}/exams/${examId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function addExamQuestion(examId, payload) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/questions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function updateExamQuestion(examId, questionId, payload) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/questions/${questionId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchAttemptGrading(examId, attemptId) {
  const res = await fetch(
    `${BASE_URL}/exams/${examId}/attempts/${attemptId}/grading`,
    { headers: authHeaders() }
  );
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function saveAttemptGrades(examId, attemptId, grades) {
  const res = await fetch(
    `${BASE_URL}/exams/${examId}/attempts/${attemptId}/grade`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ grades }),
    }
  );
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteExamQuestion(examId, questionId) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/questions/${questionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function logIntegrityEvent(examId, eventType) {
  try {
    await fetch(`${BASE_URL}/exams/${examId}/integrity`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ event_type: eventType }),
    });
  } catch (err) {
    console.error("Integrity log failed:", err);
  }
}

export async function fetchExamResults(examId) {
  const res = await fetch(`${BASE_URL}/exams/${examId}/results`, {
    headers: authHeaders(),
  });
  if (handleUnauthorized(res)) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export function resultsCsvUrl(examId) {
  return `${BASE_URL}/exams/${examId}/results.csv`;
}

export async function reportViolation(sessionId, violationType) {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    await fetch(`${BASE_URL}/monitoring/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        violation_type: violationType,
      }),
    });
  } catch (err) {
    console.error("Failed to report violation:", err);
  }
}

export async function fetchViolations() {
  const token = localStorage.getItem("token");
  if (!token) return [];
  try {
    const res = await fetch(`${BASE_URL}/monitoring/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (handleUnauthorized(res)) return [];
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to fetch violations:", err);
    return [];
  }
}
