// =============================================================
// Exam page — one question at a time + fullscreen lockdown
// AI analyze gated by AI_MONITORING_ENABLED; webcam by WEBCAM_ENABLED.
// =============================================================

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import {
  fetchExamQuestions,
  startExamSession,
  submitExam,
  logIntegrityEvent,
  createStartApproval,
  pollStartApprovalStatus,
} from "../api/examApi";
import {
  AI_MONITORING_ENABLED,
  WEBCAM_ENABLED,
  QR_START_APPROVAL_ENABLED,
  CODE_START_APPROVAL_ENABLED,
  START_APPROVAL_REQUIRED,
} from "../config";
import QuestionCard from "../components/QuestionCard";
import Result from "../components/Result";
import MonitoringPanel from "../components/MonitoringPanel";

async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    ) {
      return true;
    }

    // Avoid navigationUI:"hide" — it flickers and can drop FS right after enter on Chrome.
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    } else {
      return false;
    }

    // Wait one frame so fullscreenElement is settled after the transition
    await new Promise((r) => requestAnimationFrame(() => r()));

    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  } catch (err) {
    console.warn("Fullscreen failed:", err);
    return false;
  }
}

async function exitFullscreenSafe() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msFullscreenElement && document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } catch {
    // ignore
  }
}

function isFullscreenActive() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
}

function Exam() {
  const { examId } = useParams();
  const numericExamId = Number(examId);
  const loggedInUsername = localStorage.getItem("username") || "";

  const [examMeta, setExamMeta] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [total, setTotal] = useState(null);
  const [mcqScore, setMcqScore] = useState(null);
  const [mcqTotal, setMcqTotal] = useState(null);
  const [shortScore, setShortScore] = useState(null);
  const [shortTotal, setShortTotal] = useState(null);
  const [shortPending, setShortPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [examStarted, setExamStarted] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [cameraError, setCameraError] = useState(null);
  /** idle = not asked yet; ready = stream ok; denied = user blocked; not_required = flag off */
  const [cameraGateStatus, setCameraGateStatus] = useState(
    WEBCAM_ENABLED ? "idle" : "not_required"
  );
  const [pendingResume, setPendingResume] = useState(false);
  const [resumeTimeLeft, setResumeTimeLeft] = useState(null);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inSecureFs, setInSecureFs] = useState(false);
  const [fsWarningSecs, setFsWarningSecs] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [submittingUi, setSubmittingUi] = useState(false);
  const [awaitingQr, setAwaitingQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [qrStatus, setQrStatus] = useState(""); // pending | approved | expired
  const [qrError, setQrError] = useState("");
  /** Token after teacher approves — start only on student click (needs user gesture for FS). */
  const [approvedStartToken, setApprovedStartToken] = useState(null);

  const videoRef = useRef(null);
  const approvalPollRef = useRef(null);
  const welcomeVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const submittingRef = useRef(false);
  const examRootRef = useRef(null);
  const allowFsExitRef = useRef(false);
  const fsWarnAtRef = useRef(0);
  const fsCountdownRef = useRef(null);
  const fsAutoSubmitTimerRef = useRef(null);
  const fsExitCountRef = useRef(0);
  const handleSubmitRef = useRef(null);
  const answersRef = useRef({});
  const wasSecureRef = useRef(false);
  const gateStartedRef = useRef(false);
  /** Ignore FS/tab leave until this timestamp (camera permission grace). */
  const ignoreFsLeaveUntilRef = useRef(0);
  const examStartedRef = useRef(false);
  /** Require consecutive insecure polls before treating as FS leave (avoids enter flicker). */
  const insecureStreakRef = useRef(0);

  const sessionId = useRef(
    "SESSION_" + new Date().toISOString().replace(/[:.]/g, "-")
  );

  function ignoreLeaveTemporarily(ms = 15000) {
    ignoreFsLeaveUntilRef.current = Date.now() + ms;
  }

  function isIgnoringLeave() {
    return Date.now() < ignoreFsLeaveUntilRef.current;
  }

  useEffect(() => {
    examStartedRef.current = examStarted;
  }, [examStarted]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    if (!numericExamId) {
      setLoadError("Invalid exam link");
      return;
    }

    fetchExamQuestions(numericExamId)
      .then((data) => {
        if (!data) return;
        setExamMeta(data.exam);
        setQuestions(data.questions || []);
        setTimeLeft((data.exam?.duration_minutes || 10) * 60);

        if (data.attempt?.status === "submitted") {
          setAlreadyDone(true);
          setSubmitted(true);
          applyAttemptScores(data.attempt, data.questions?.length);
        } else if (data.attempt?.status === "in_progress") {
          // Do not enter fullscreen until camera + resume (avoids permission prompt in FS).
          setPendingResume(true);
          startExamSession(numericExamId)
            .then((session) => {
              if (!session) return;
              setResumeTimeLeft(session.time_left_seconds);
              setTimeLeft(session.time_left_seconds);
            })
            .catch((err) => setLoadError(err.message));
        }
      })
      .catch((err) => setLoadError(err.message || "Failed to load exam"));
  }, [numericExamId]);

  useEffect(() => {
    if (!examStarted || !WEBCAM_ENABLED) return;
    // Delay attach: mounting/autoplaying <video> right after requestFullscreen
    // can make Chrome exit fullscreen immediately.
    const t = setTimeout(() => {
      attachStreamToVideo(videoRef.current);
    }, 1000);
    return () => clearTimeout(t);
  }, [examStarted, WEBCAM_ENABLED]);

  useEffect(() => {
    if (!examStarted || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [examStarted, submitted]);

  useEffect(() => {
    if (timeLeft === 0 && examStarted && !submitted) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, examStarted, submitted]);

  useEffect(() => {
    if (!AI_MONITORING_ENABLED || !WEBCAM_ENABLED || !examStarted || submitted) {
      return;
    }
    const monitoringInterval = setInterval(() => {
      runMonitoringCheck();
    }, 3000);
    return () => clearInterval(monitoringInterval);
  }, [examStarted, submitted]);

  // Fullscreen lockdown — ignores leave while camera permission is open.
  useEffect(() => {
    if (!examStarted || submitted) return;

    function clearLeaveTimers() {
      if (fsCountdownRef.current) {
        clearInterval(fsCountdownRef.current);
        fsCountdownRef.current = null;
      }
      if (fsAutoSubmitTimerRef.current) {
        clearTimeout(fsAutoSubmitTimerRef.current);
        fsAutoSubmitTimerRef.current = null;
      }
    }

    function forceSubmit(reason) {
      if (allowFsExitRef.current || submittingRef.current) return;
      if (isIgnoringLeave()) return;
      clearLeaveTimers();
      setFsWarningSecs(0);
      setInSecureFs(false);
      logIntegrityEvent(numericExamId, reason);
      const submitFn = handleSubmitRef.current;
      if (typeof submitFn === "function") {
        submitFn();
      } else {
        alert("Auto-submit: " + reason);
      }
    }

    function startWarningCountdown() {
      if (fsCountdownRef.current) return;
      clearLeaveTimers();
      setFsWarningSecs(3);
      setInSecureFs(false);

      let left = 3;
      fsCountdownRef.current = setInterval(() => {
        left -= 1;
        setFsWarningSecs(left);
        if (left <= 0) {
          clearLeaveTimers();
          if (allowFsExitRef.current || submittingRef.current) return;
          if (isIgnoringLeave()) return;
          if (!isFullscreenActive() || document.hidden) {
            forceSubmit("leave_warning_timeout_autosubmit");
          }
        }
      }, 1000);
    }

    function registerLeave(kind) {
      if (allowFsExitRef.current || submittingRef.current) return;
      if (isIgnoringLeave()) return;

      const now = Date.now();
      if (now - fsWarnAtRef.current < 500) return;
      fsWarnAtRef.current = now;

      setInSecureFs(false);

      if (fsCountdownRef.current) {
        forceSubmit("leave_second_offense_autosubmit");
        return;
      }

      fsExitCountRef.current += 1;
      const n = fsExitCountRef.current;
      logIntegrityEvent(numericExamId, `leave_${kind}_${n}`);

      if (n >= 2) {
        forceSubmit("leave_second_exit_autosubmit");
        return;
      }

      startWarningCountdown();
    }

    function syncSecureState() {
      if (allowFsExitRef.current || submittingRef.current) return;

      // Only FS matters for "secure". document.hidden flickers during FS enter
      // on Chrome and was falsely treating start as a leave.
      const ok = isFullscreenActive();

      if (isIgnoringLeave()) {
        setInSecureFs(ok);
        if (ok) {
          wasSecureRef.current = true;
          insecureStreakRef.current = 0;
        }
        return;
      }

      setInSecureFs(ok);

      if (ok) {
        insecureStreakRef.current = 0;
        wasSecureRef.current = true;
        gateStartedRef.current = false;
        if (fsCountdownRef.current) {
          clearLeaveTimers();
          setFsWarningSecs(0);
        }
        return;
      }

      // Debounce: need ~1s (2 polls) of real FS loss — not enter-transition blip
      insecureStreakRef.current += 1;
      if (wasSecureRef.current && insecureStreakRef.current >= 2) {
        wasSecureRef.current = false;
        registerLeave("fullscreen");
        return;
      }

      if (
        !wasSecureRef.current &&
        !gateStartedRef.current &&
        !fsCountdownRef.current &&
        insecureStreakRef.current >= 2
      ) {
        gateStartedRef.current = true;
        fsExitCountRef.current = Math.max(fsExitCountRef.current, 1);
        logIntegrityEvent(numericExamId, "fullscreen_required_gate");
        startWarningCountdown();
      }
    }

    function onVisibility() {
      if (isIgnoringLeave()) return;
      if (document.hidden) {
        // Wait — FS enter can fire a brief hidden=true. Only count real tab leave.
        setTimeout(() => {
          if (isIgnoringLeave() || allowFsExitRef.current || submittingRef.current) {
            return;
          }
          if (document.hidden && !isFullscreenActive()) {
            registerLeave("tab");
          }
        }, 400);
      } else {
        syncSecureState();
      }
    }

    function onFullscreenChange() {
      syncSecureState();
    }

    syncSecureState();
    const pollId = setInterval(syncSecureState, 500);

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    return () => {
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [examStarted, submitted, numericExamId]);

  function attachStreamToVideo(videoEl) {
    if (!videoEl || !streamRef.current) return;
    videoEl.srcObject = streamRef.current;
  }

  /** Call only from welcome / resume (before fullscreen). User gesture required. */
  async function requestCameraBeforeExam() {
    if (!WEBCAM_ENABLED) {
      setCameraGateStatus("not_required");
      return true;
    }
    if (streamRef.current) {
      setCameraGateStatus("ready");
      attachStreamToVideo(welcomeVideoRef.current);
      setCameraError(null);
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      attachStreamToVideo(welcomeVideoRef.current);
      setCameraError(null);
      setCameraGateStatus("ready");
      return true;
    } catch (err) {
      console.error("Webcam error:", err);
      setCameraError(
        "Camera blocked or denied. You can still take the exam; monitoring preview may be off."
      );
      setCameraGateStatus("denied");
      return false;
    }
  }

  function stopWebcam() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  /** Full AI pipeline — kept for recovery. Not invoked when flags are off. */
  async function runMonitoringCheck() {
    if (!AI_MONITORING_ENABLED || !WEBCAM_ENABLED) return;
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg", 0.7);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/monitoring/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_id: sessionId.current,
            image: imageData,
          }),
        }
      );

      await res.json().catch(() => ({}));
    } catch (err) {
      console.error("Monitoring check failed:", err);
    }
  }

  function applyAttemptScores(attempt, fallbackTotal) {
    setScore(attempt.score);
    setTotal(attempt.total ?? fallbackTotal);
    setMcqScore(attempt.mcq_score ?? null);
    setMcqTotal(attempt.mcq_total ?? null);
    setShortScore(attempt.short_score ?? null);
    setShortTotal(attempt.short_total ?? null);
    setShortPending(!!attempt.short_pending);
  }

  function handleSelect(questionId, option) {
    const key = String(questionId);
    setAnswers((prev) => {
      const next = { ...prev, [key]: option };
      answersRef.current = next;
      return next;
    });
  }

  function handleShortChange(questionId, text) {
    const key = String(questionId);
    setAnswers((prev) => {
      const next = { ...prev, [key]: text };
      answersRef.current = next;
      return next;
    });
  }

  /** Normalize answer keys to strings before submit (API question ids are strings). */
  function answersPayload() {
    const src = answersRef.current || answers || {};
    const out = {};
    for (const [k, v] of Object.entries(src)) {
      out[String(k)] = v == null ? "" : v;
    }
    return out;
  }

  async function handleSubmit() {
    if (submitted || submittingRef.current) return;
    submittingRef.current = true;
    setSubmittingUi(true);
    setSubmitError("");
    // Pause leave auto-submit while request is in flight
    allowFsExitRef.current = true;
    setFsWarningSecs(0);
    if (fsCountdownRef.current) {
      clearInterval(fsCountdownRef.current);
      fsCountdownRef.current = null;
    }

    try {
      const data = await submitExam(answersPayload(), numericExamId);
      if (!data) {
        setSubmitError(
          "Submit failed (session or network). Your answers are still here — retry."
        );
        submittingRef.current = false;
        setSubmittingUi(false);
        allowFsExitRef.current = false;
        return;
      }
      // Only mark done after server confirms
      setSubmitted(true);
      applyAttemptScores(data, questions.length);
      setSubmitError("");
      stopWebcam();
      await exitFullscreenSafe();
    } catch (err) {
      const msg = err.message || "Submit failed";
      if (String(msg).toLowerCase().includes("already submitted")) {
        setSubmitted(true);
        setAlreadyDone(true);
        setScore((prev) => prev ?? 0);
        setTotal((prev) => prev ?? questions.length);
        stopWebcam();
        await exitFullscreenSafe();
        return;
      }
      setSubmitError(`${msg} — Your answers are still here. Tap Retry submit.`);
      submittingRef.current = false;
      setSubmittingUi(false);
      allowFsExitRef.current = false;
    }
  }

  handleSubmitRef.current = handleSubmit;

  function handleLogout() {
    allowFsExitRef.current = true;
    exitFullscreenSafe();
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "/login";
  }

  function stopApprovalPoll() {
    if (approvalPollRef.current) {
      clearInterval(approvalPollRef.current);
      approvalPollRef.current = null;
    }
  }

  useEffect(() => {
    return () => stopApprovalPoll();
  }, []);

  async function beginExamInFullscreen(tokenForStart = null) {
    insecureStreakRef.current = 0;

    // Must run from a real click — browsers block requestFullscreen without gesture.
    const ok = await enterFullscreen();
    if (ok) {
      // Short grace only: UI/video mount can briefly flicker FS after a real enter.
      ignoreLeaveTemporarily(2500);
    } else {
      ignoreFsLeaveUntilRef.current = 0;
    }

    const session = await startExamSession(numericExamId, tokenForStart);
    if (!session) return;

    stopApprovalPoll();
    setAwaitingQr(false);
    setQrDataUrl("");
    setShortCode("");
    setQrStatus("");
    setApprovedStartToken(null);

    setTimeLeft(session.time_left_seconds);
    setCurrentIndex(0);
    fsExitCountRef.current = 0;
    wasSecureRef.current = ok;
    gateStartedRef.current = false;
    setInSecureFs(ok);
    setPendingResume(false);
    setExamStarted(true);

    if (ok) {
      ignoreLeaveTemporarily(2500);
      // Re-assert once if React remount briefly dropped FS (gesture may still count).
      requestAnimationFrame(() => {
        if (!isFullscreenActive()) {
          enterFullscreen().then((again) => {
            if (again) {
              wasSecureRef.current = true;
              setInSecureFs(true);
              insecureStreakRef.current = 0;
            }
          });
        }
      });
    } else {
      logIntegrityEvent(numericExamId, "fullscreen_denied");
    }
  }

  async function handleEnableCamera() {
    await requestCameraBeforeExam();
  }

  async function requestTeacherApproval() {
    setQrError("");
    setQrStatus("pending");
    setAwaitingQr(true);
    setQrDataUrl("");
    setShortCode("");
    setApprovedStartToken(null);
    stopApprovalPoll();

    const created = await createStartApproval(numericExamId);
    if (!created?.token) {
      throw new Error("Could not create start approval");
    }

    if (CODE_START_APPROVAL_ENABLED && created.short_code) {
      setShortCode(created.short_code);
    }

    if (QR_START_APPROVAL_ENABLED) {
      const approveUrl = `${window.location.origin}/approve/${created.token}`;
      const dataUrl = await QRCode.toDataURL(approveUrl, {
        width: 280,
        margin: 2,
      });
      setQrDataUrl(dataUrl);
    }

    setQrStatus(created.status || "pending");

    approvalPollRef.current = setInterval(async () => {
      try {
        const st = await pollStartApprovalStatus(created.token);
        if (!st) return;
        setQrStatus(st.status);
        if (st.status === "approved") {
          // Do NOT auto-start here: setInterval has no user gesture, so
          // requestFullscreen fails and the exam runs without FS until grace ends.
          stopApprovalPoll();
          setQrStatus("approved");
          setApprovedStartToken(created.token);
        } else if (st.status === "expired" || st.status === "used") {
          stopApprovalPoll();
          setQrError(
            st.status === "expired"
              ? "Code expired — request a new one."
              : "This approval was already used."
          );
        }
      } catch (err) {
        // Keep polling on transient errors
        console.warn("Approval poll:", err);
      }
    }, 2000);
  }

  async function handleStartExam() {
    if (WEBCAM_ENABLED && cameraGateStatus === "idle") {
      alert("Please tap “Allow camera” first, then start the exam.");
      return;
    }
    try {
      if (START_APPROVAL_REQUIRED) {
        await requestTeacherApproval();
        return;
      }
      await beginExamInFullscreen();
    } catch (err) {
      setAwaitingQr(false);
      alert(err.message || "Could not start exam");
    }
  }

  async function handleResumeExam() {
    if (WEBCAM_ENABLED && cameraGateStatus === "idle") {
      alert("Please tap “Allow camera” first, then continue.");
      return;
    }
    try {
      // Resume does not need approval — attempt already started
      await beginExamInFullscreen();
    } catch (err) {
      alert(err.message || "Could not resume exam");
    }
  }

  async function handleCancelQr() {
    stopApprovalPoll();
    setAwaitingQr(false);
    setQrDataUrl("");
    setShortCode("");
    setQrStatus("");
    setQrError("");
    setApprovedStartToken(null);
  }

  async function handleApprovedStartClick() {
    if (!approvedStartToken) return;
    setQrError("");
    try {
      await beginExamInFullscreen(approvedStartToken);
    } catch (err) {
      setQrError(err.message || "Approved but start failed");
    }
  }

  async function handleReturnFullscreen() {
    ignoreLeaveTemporarily(8000);
    insecureStreakRef.current = 0;
    const ok = await enterFullscreen();
    if (ok) {
      if (fsCountdownRef.current) {
        clearInterval(fsCountdownRef.current);
        fsCountdownRef.current = null;
      }
      setFsWarningSecs(0);
      setInSecureFs(true);
      wasSecureRef.current = true;
      gateStartedRef.current = false;
    } else {
      setInSecureFs(false);
      alert(
        "Could not enter fullscreen. Allow permission and click again before the timer ends."
      );
    }
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => {
    const v = answers[String(q.id)] ?? answers[q.id];
    if (v == null) return false;
    if ((q.question_type || "mcq") === "short") return String(v).trim().length > 0;
    return true;
  }).length;
  const isLast = currentIndex >= questions.length - 1;

  if (loadError) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <p className="text-red-600 mb-4">{loadError}</p>
        <a href="/" className="text-blue-600 underline">
          Back to join page
        </a>
      </div>
    );
  }

  if (!examMeta) {
    return <div className="p-8">Loading exam...</div>;
  }

  if (alreadyDone && score !== null) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{examMeta.title}</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
        <div className="border border-green-300 bg-green-50 rounded-lg p-6 mb-4">
          <h2 className="text-xl font-bold mb-2">Already submitted</h2>
          <Result
            score={score}
            total={total}
            mcqScore={mcqScore}
            mcqTotal={mcqTotal}
            shortScore={shortScore}
            shortTotal={shortTotal}
            shortPending={shortPending}
          />
          <p className="text-sm text-gray-600 mt-2">
            One attempt only — cannot retake.
          </p>
        </div>
        <a href="/" className="text-blue-600 underline">
          Back to home
        </a>
      </div>
    );
  }

  return (
    <div ref={examRootRef} className="p-4 min-h-screen bg-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{examMeta.title}</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {!examStarted ? (
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center max-w-2xl">
            {awaitingQr ? (
              <>
                <h2 className="text-3xl font-bold mb-2">
                  {qrStatus === "approved"
                    ? "Approved — start now"
                    : "Waiting for teacher"}
                </h2>
                {loggedInUsername && (
                  <p className="text-lg text-gray-800 mb-4">
                    Student:{" "}
                    <span className="font-semibold">{loggedInUsername}</span>
                  </p>
                )}
                <p className="text-gray-700 mb-4">
                  {qrStatus === "approved"
                    ? "Teacher approved your start. Click the button below to enter fullscreen and begin."
                    : CODE_START_APPROVAL_ENABLED && !QR_START_APPROVAL_ENABLED
                      ? "Tell your teacher this 4-digit code. When they approve, you will get a Start button here."
                      : CODE_START_APPROVAL_ENABLED && QR_START_APPROVAL_ENABLED
                        ? "Show the code or QR to your teacher. After they approve, click Start here."
                        : "Show this QR to your teacher. After they approve, click Start here."}
                </p>
                {CODE_START_APPROVAL_ENABLED && qrStatus !== "approved" && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2">Your code</p>
                    <p className="text-6xl font-bold tracking-[0.25em] text-gray-900 font-mono">
                      {shortCode || "····"}
                    </p>
                  </div>
                )}
                {QR_START_APPROVAL_ENABLED &&
                  qrStatus !== "approved" &&
                  (qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Teacher approval QR"
                      className="mx-auto border rounded-lg bg-white p-2 mb-4"
                      width={280}
                      height={280}
                    />
                  ) : (
                    <p className="mb-4">Generating QR…</p>
                  ))}
                <p className="text-sm text-gray-600 mb-2">
                  Status:{" "}
                  <span className="font-semibold uppercase">
                    {qrStatus || "pending"}
                  </span>
                </p>
                {qrError && (
                  <p className="text-red-600 text-sm mb-3">{qrError}</p>
                )}
                {qrStatus === "approved" && approvedStartToken && (
                  <button
                    type="button"
                    onClick={handleApprovedStartClick}
                    className="bg-green-500 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-green-600 mb-4"
                  >
                    Enter fullscreen & start exam
                  </button>
                )}
                <div className="flex gap-3 justify-center flex-wrap">
                  <button
                    type="button"
                    onClick={handleCancelQr}
                    className="bg-gray-200 text-gray-800 px-5 py-2 rounded font-semibold hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  {(qrError || qrStatus === "expired") && (
                    <button
                      type="button"
                      onClick={() =>
                        requestTeacherApproval().catch((err) =>
                          setQrError(err.message || "Could not refresh code")
                        )
                      }
                      className="bg-blue-600 text-white px-5 py-2 rounded font-semibold hover:bg-blue-700"
                    >
                      New code
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-8">
                  <p className="text-sm font-semibold tracking-wide uppercase text-slate-500 mb-2">
                    {examMeta.title}
                  </p>
                  <h2 className="text-4xl font-bold text-slate-900 tracking-tight">
                    {pendingResume ? "Resume your exam" : "Welcome to the Exam"}
                  </h2>
                </div>
                <div className="mb-8 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm overflow-hidden text-left">
                  <div className="px-6 sm:px-8 pt-6 pb-5 bg-slate-900 text-white">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="inline-flex items-center rounded-md bg-white/15 px-3 py-1 text-sm font-medium">
                        {questions.length} questions
                      </span>
                      <span className="inline-flex items-center rounded-md bg-white/15 px-3 py-1 text-sm font-medium">
                        {examMeta.duration_minutes} minutes
                      </span>
                      {pendingResume && resumeTimeLeft != null && (
                        <span className="inline-flex items-center rounded-md bg-amber-400/90 text-slate-900 px-3 py-1 text-sm font-semibold">
                          Time left ~{Math.ceil(resumeTimeLeft / 60)} min
                        </span>
                      )}
                    </div>
                    <p className="text-slate-200 text-base leading-relaxed mb-2">
                      Questions appear{" "}
                      <span className="font-semibold text-white">
                        one at a time
                      </span>
                      . You cannot go back to a previous question.
                    </p>
                    <p className="text-slate-200 text-base leading-relaxed mb-2">
                      Exam runs in{" "}
                      <span className="font-semibold text-white">fullscreen</span>
                      . Leave once: 3s then auto-submit. Leave again: instant
                      auto-submit.
                    </p>
                    {START_APPROVAL_REQUIRED && !pendingResume && (
                      <p className="text-slate-200 text-base leading-relaxed mb-2">
                        {CODE_START_APPROVAL_ENABLED &&
                        !QR_START_APPROVAL_ENABLED ? (
                          <>
                            A{" "}
                            <span className="font-semibold text-white">
                              teacher 4-digit code
                            </span>{" "}
                            is required before the exam starts.
                          </>
                        ) : QR_START_APPROVAL_ENABLED &&
                          !CODE_START_APPROVAL_ENABLED ? (
                          <>
                            A{" "}
                            <span className="font-semibold text-white">
                              teacher QR scan
                            </span>{" "}
                            is required before the exam starts.
                          </>
                        ) : (
                          <>
                            Teacher approval (code or QR) is required before the
                            exam starts.
                          </>
                        )}
                      </p>
                    )}
                    <p className="text-slate-300 text-sm">
                      AI monitoring is enabled for this session.
                    </p>
                  </div>
                  <div className="px-6 sm:px-8 py-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                      <p className="text-lg font-semibold text-slate-900">
                        Before you start — read carefully
                      </p>
                    </div>
                    <ol className="space-y-3">
                      <li className="flex gap-3 text-base text-slate-700 leading-relaxed">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold">
                          1
                        </span>
                        <span>
                          Exam runs in{" "}
                          <span className="font-semibold">fullscreen</span>. Do{" "}
                          <span className="font-semibold">not press ESC</span> —
                          leaving fullscreen can{" "}
                          <span className="font-semibold">auto-submit</span> your
                          exam.
                        </span>
                      </li>
                      <li className="flex gap-3 text-base text-slate-700 leading-relaxed">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold">
                          2
                        </span>
                        <span>
                          Do not open other{" "}
                          <span className="font-semibold">tabs / windows</span> or
                          use Alt+Tab. Leaving again = instant submit.
                        </span>
                      </li>
                      <li className="flex gap-3 text-base text-slate-700 leading-relaxed">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold">
                          3
                        </span>
                        <span>
                          Questions appear{" "}
                          <span className="font-semibold">one at a time</span>.
                          After <span className="font-semibold">Next</span> you
                          cannot go back — check your answer before Next.
                        </span>
                      </li>
                      <li className="flex gap-3 text-base text-slate-700 leading-relaxed">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold">
                          4
                        </span>
                        <span>
                          The timer is on the{" "}
                          <span className="font-semibold">server</span>. Refresh
                          does not reset your time.
                        </span>
                      </li>
                      <li className="flex gap-3 text-base text-slate-700 leading-relaxed">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold">
                          5
                        </span>
                        <span>
                          Use{" "}
                          <span className="font-semibold">Submit early</span> only
                          when you want to finish — do not tap it by mistake.
                        </span>
                      </li>
                      <li className="flex gap-3 text-base text-slate-700 leading-relaxed">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold">
                          6
                        </span>
                        <span>
                          Keep Wi‑Fi stable and plug in your charger. Disconnecting
                          before submit may risk losing unsaved answers.
                        </span>
                      </li>
                    </ol>
                  </div>
                </div>

                {WEBCAM_ENABLED && (
                  <div className="mb-6 p-4 border rounded-lg bg-gray-50 text-left">
                    <p className="font-semibold mb-2">
                      Step 1 — Camera (before fullscreen)
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      Allow the camera here first. Chrome cannot show the
                      permission dialog while you are in fullscreen.
                    </p>
                    {cameraGateStatus === "ready" && (
                      <p className="text-sm text-green-700 font-medium mb-2">
                        Camera enabled
                      </p>
                    )}
                    {cameraGateStatus === "denied" && (
                      <p className="text-sm text-orange-700 mb-2">
                        {cameraError}
                      </p>
                    )}
                    <video
                      ref={welcomeVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-40 h-28 border rounded object-cover mb-3 ${
                        cameraGateStatus === "ready" ? "" : "hidden"
                      }`}
                    />
                    {cameraGateStatus !== "ready" && (
                      <button
                        type="button"
                        onClick={handleEnableCamera}
                        className="bg-gray-800 text-white px-5 py-2 rounded font-semibold hover:bg-gray-900"
                      >
                        Allow camera
                      </button>
                    )}
                  </div>
                )}

                <p className="text-sm text-gray-600 mb-3">
                  {WEBCAM_ENABLED
                    ? START_APPROVAL_REQUIRED && !pendingResume
                      ? CODE_START_APPROVAL_ENABLED && !QR_START_APPROVAL_ENABLED
                        ? "Step 2 — Show code for teacher approval"
                        : "Step 2 — Show approval for teacher"
                      : "Step 2 — Start in fullscreen (only after camera step above)"
                    : START_APPROVAL_REQUIRED && !pendingResume
                      ? "Show approval code/QR when ready"
                      : "Start in fullscreen when you are ready"}
                </p>
                <button
                  onClick={pendingResume ? handleResumeExam : handleStartExam}
                  disabled={
                    questions.length === 0 ||
                    (WEBCAM_ENABLED && cameraGateStatus === "idle")
                  }
                  className="bg-green-500 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {pendingResume
                    ? "Continue exam (fullscreen)"
                    : START_APPROVAL_REQUIRED
                      ? CODE_START_APPROVAL_ENABLED && !QR_START_APPROVAL_ENABLED
                        ? "Start exam (show code)"
                        : "Start exam (show approval)"
                      : "Start exam (fullscreen)"}
                </button>
                {WEBCAM_ENABLED && cameraGateStatus === "idle" && (
                  <p className="text-amber-700 text-sm mt-2">
                    Tap “Allow camera” before starting.
                  </p>
                )}
                {questions.length === 0 && (
                  <p className="text-red-500 mt-3 text-sm">
                    No questions in this exam yet.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-6 relative">
          {examStarted && score === null && !inSecureFs && !isIgnoringLeave() && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
              <div className="bg-white rounded-xl max-w-md w-full p-8 text-center shadow-xl">
                <h2 className="text-2xl font-bold text-red-700 mb-3">
                  Fullscreen required
                </h2>
                <p className="text-gray-700 mb-2">
                  You cannot take the exam without fullscreen. Enter fullscreen
                  within <span className="font-bold">3 seconds</span> or the exam
                  will be{" "}
                  <span className="font-bold text-red-700">auto-submitted</span>.
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Leaving again (tab / ESC) = immediate auto-submit.
                </p>
                {fsWarningSecs > 0 ? (
                  <p className="text-3xl font-bold text-orange-600 mb-4">
                    {fsWarningSecs}
                  </p>
                ) : (
                  <p className="text-sm text-red-600 mb-4 font-medium">
                    Time up — submitting…
                  </p>
                )}
                <button
                  onClick={handleReturnFullscreen}
                  className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-red-700 w-full"
                >
                  Return to fullscreen now
                </button>
              </div>
            </div>
          )}

          <div className="flex-1">
            {WEBCAM_ENABLED && (
              <div className="mb-4">
                {cameraError ? (
                  <p className="text-red-500 text-sm">{cameraError}</p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      Webcam (AI Monitoring Active)
                    </p>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-48 h-36 border rounded object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}
              </div>
            )}

            {!WEBCAM_ENABLED && score === null && (
              <p className="text-sm text-gray-600 mb-4">
                AI monitoring is active for this session.
              </p>
            )}

            {score === null ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2
                    className={`text-xl font-bold ${
                      timeLeft < 30 ? "text-red-600" : ""
                    }`}
                  >
                    Time Left: {formatTime(timeLeft)}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Question {currentIndex + 1} of {questions.length}
                    {" · "}
                    Answered {answeredCount}/{questions.length}
                  </p>
                </div>

                {currentQuestion && (
                  <QuestionCard
                    key={currentQuestion.id}
                    question={currentQuestion}
                    selected={
                      answers[String(currentQuestion.id)] ??
                      answers[currentQuestion.id]
                    }
                    onSelect={handleSelect}
                    onShortChange={handleShortChange}
                    disabled={!inSecureFs && !isIgnoringLeave()}
                    indexLabel={`Q${currentIndex + 1}`}
                  />
                )}

                {submitError && (
                  <div className="mb-4 p-3 border border-red-300 bg-red-50 rounded text-sm text-red-800">
                    <p className="mb-2">{submitError}</p>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submittingUi}
                      className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700 disabled:opacity-50"
                    >
                      {submittingUi ? "Submitting…" : "Retry submit"}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-4 mb-8">
                  {!isLast ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentIndex((i) =>
                          Math.min(questions.length - 1, i + 1)
                        )
                      }
                      disabled={submittingUi}
                      className="bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submittingUi}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                    >
                      {submittingUi ? "Submitting…" : "Submit Exam"}
                    </button>
                  )}

                  {!isLast && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submittingUi}
                      className="ml-auto text-sm text-gray-600 underline disabled:opacity-50"
                    >
                      {submittingUi ? "Submitting…" : "Submit early"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <Result
                  score={score}
                  total={total ?? questions.length}
                  mcqScore={mcqScore}
                  mcqTotal={mcqTotal}
                  shortScore={shortScore}
                  shortTotal={shortTotal}
                  shortPending={shortPending}
                />
                <a
                  href="/"
                  className="inline-block mt-4 text-blue-600 underline"
                >
                  Back to home
                </a>
              </div>
            )}
          </div>

          {score === null && (
            <div className="w-72">
              <MonitoringPanel />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Exam;
